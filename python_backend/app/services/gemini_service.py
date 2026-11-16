"""Shared async Gemini REST client for every AI feature.

Uses the existing httpx dependency. Provider credentials, raw errors and image
payloads are never logged. JSON output is validated before it is persisted.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Sequence
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError
from app.core.config import settings
from app.core.errors import ApiError

logger = logging.getLogger(__name__)
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_OUTPUT_TOKENS = 16000
THINKING_BUDGET = 1024
BUDGETED_THINKING_MODELS = frozenset({'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'})


class _TruncatedResponseError(ValueError):
    """The provider exhausted its output budget; partial content is not usable."""


def _usage_count(payload: dict, name: str) -> int | None:
    usage = payload.get('usageMetadata')
    value = usage.get(name) if isinstance(usage, dict) else None
    return value if type(value) is int and 0 <= value <= 100_000_000 else None


def clean_json_text(text: str) -> str:
    candidate = text.strip()
    if candidate.startswith('```') and '\n' in candidate:
        candidate = candidate.split('\n', 1)[1]
        if candidate.rstrip().endswith('```'):
            candidate = candidate.rstrip()[:-3]
    return candidate.strip()


class GeminiService:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._slots = asyncio.Semaphore(4)

    @property
    def model(self) -> str:
        return settings.GEMINI_MODEL

    def is_configured(self) -> bool:
        return bool(settings.GEMINI_API_KEY.strip())

    async def start(self) -> None:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(settings.AI_TIMEOUT_SECONDS, connect=10),
                limits=httpx.Limits(max_connections=4, max_keepalive_connections=4),
            )

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    @staticmethod
    def _contents(messages: Sequence[dict[str, Any]]) -> list[dict]:
        result = []
        for message in messages:
            if message['role'] not in ('user', 'assistant'):
                raise ApiError(400, 'Недопустимая роль сообщения.')
            content = message['content']
            if isinstance(content, str):
                parts = [{'text': content}]
            else:
                parts = []
                for block in content:
                    if block['type'] == 'text':
                        parts.append({'text': block['text']})
                    elif block['type'] in ('image', 'document'):
                        parts.append({'inlineData': {'mimeType': block['mimeType'], 'data': block['data']}})
                    else:
                        raise ApiError(400, 'Недопустимый тип вложения.')
            role = 'model' if message['role'] == 'assistant' else 'user'
            if result and result[-1]['role'] == role:
                result[-1]['parts'].extend(parts)
            else:
                result.append({'role': role, 'parts': parts})
        return result

    async def chat(self, system_prompt: str, messages: Sequence[dict[str, Any]], max_output_tokens: int = 4096) -> str:
        return await self._generate(system_prompt, self._contents(messages), max_output_tokens)

    async def generate_text(self, system_prompt: str, user_prompt: str, max_output_tokens: int = 4096) -> str:
        return await self.chat(system_prompt, [{'role': 'user', 'content': user_prompt}], max_output_tokens)

    async def generate_json(self, system_prompt: str, user_prompt: str, max_output_tokens: int = 4096,
                            response_model: type[BaseModel] | None = None,
                            input_blocks: list[dict] | None = None) -> Any:
        if response_model:
            system_prompt += '\nReturn only JSON conforming to this schema: ' + json.dumps(response_model.model_json_schema(), ensure_ascii=False)
        else:
            system_prompt += '\nReturn only a JSON object matching the requested structure.'
        contents = self._contents([{'role': 'user', 'content': [{'type': 'text', 'text': user_prompt}, *(input_blocks or [])]}])
        text = await self._generate(system_prompt, contents,
                                    max_output_tokens, json_mode=True,
                                    response_schema=response_model.model_json_schema() if response_model else None)
        try:
            data = json.loads(clean_json_text(text))
            if response_model:
                return response_model.model_validate(data)
            if not isinstance(data, dict):
                raise ValueError('Expected an object')
            return data
        except (ValueError, TypeError, ValidationError):
            raise ApiError(502, 'Не удалось проверить учебный материал от AI. Попробуйте ещё раз.') from None

    async def _generate(self, system_prompt: str, contents: list[dict], max_output_tokens: int,
                        json_mode: bool = False, response_schema: dict | None = None) -> str:
        if not self.is_configured():
            raise ApiError.service_unavailable('AI не настроен: администратору нужно добавить GEMINI_API_KEY.')
        try:
            await asyncio.wait_for(self._slots.acquire(), timeout=3)
        except TimeoutError:
            raise ApiError(429, 'AI занят. Повторите запрос через несколько секунд.') from None
        try:
            # One deadline covers retries as well as connection and response reads.
            async with asyncio.timeout(settings.AI_TIMEOUT_SECONDS):
                await self.start()
                return await self._request(system_prompt, contents, max_output_tokens, json_mode, response_schema)
        except (TimeoutError, httpx.TimeoutException):
            raise ApiError(504, 'AI не успел ответить. Попробуйте ещё раз.') from None
        except httpx.TransportError:
            raise ApiError.service_unavailable('Нет соединения с AI. Попробуйте позже.') from None
        finally:
            self._slots.release()

    async def _request(self, system_prompt, contents, max_output_tokens, json_mode, response_schema=None):
        config = {'maxOutputTokens': min(max_output_tokens, MAX_OUTPUT_TOKENS)}
        if self.model in BUDGETED_THINKING_MODELS:
            # Gemini 2.5 counts thinking inside maxOutputTokens. Reserve room for
            # the requested answer instead of letting dynamic thinking consume it.
            config['thinkingConfig'] = {'thinkingBudget': THINKING_BUDGET}
            config['maxOutputTokens'] = min(max_output_tokens + THINKING_BUDGET, MAX_OUTPUT_TOKENS)
        if json_mode:
            config['responseMimeType'] = 'application/json'
        if response_schema:
            config['responseJsonSchema'] = response_schema
        payload = {'systemInstruction': {'parts': [{'text': system_prompt}]},
                   'contents': contents, 'generationConfig': config}
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent'
        for attempt in range(2):
            async with self._client.stream('POST', url, headers={'x-goog-api-key': settings.GEMINI_API_KEY}, json=payload) as response:
                status = response.status_code
                if status == 200:
                    raw = bytearray()
                    async for chunk in response.aiter_bytes():
                        raw.extend(chunk)
                        if len(raw) > MAX_RESPONSE_BYTES:
                            raise ApiError(502, 'AI вернул слишком большой ответ.')
                    try:
                        data = json.loads(raw)
                        return self._response_text(data)
                    except _TruncatedResponseError:
                        # Only numeric counters and a fixed reason are logged.
                        # Do not expose text, thought parts, headers or raw errors.
                        logger.warning(
                            'Gemini response incomplete: reason=MAX_TOKENS max_output_tokens=%s '
                            'thinking_tokens=%s output_tokens=%s',
                            config['maxOutputTokens'], _usage_count(data, 'thoughtsTokenCount'),
                            _usage_count(data, 'candidatesTokenCount'))
                        if attempt == 0 and config['maxOutputTokens'] < MAX_OUTPUT_TOKENS:
                            config['maxOutputTokens'] = min(config['maxOutputTokens'] * 2, MAX_OUTPUT_TOKENS)
                            continue
                        raise ApiError(502, 'AI не смог завершить ответ. Разделите вопрос на несколько частей и повторите.') from None
                    except (ValueError, TypeError, KeyError, IndexError):
                        logger.warning('Gemini response incomplete: reason=INVALID_RESPONSE')
                        raise ApiError(502, 'AI вернул неполный ответ. Уточните запрос и повторите.') from None
            # Log only status, never request headers, URLs containing credentials or provider body.
            logger.warning('Gemini request failed: HTTP %s', status)
            if status in (429, 500, 502, 503, 504) and attempt == 0:
                await asyncio.sleep(1)
                continue
            if status in (400, 401, 403):
                raise ApiError.service_unavailable('Gemini отклонил запрос. Проверьте ключ API и доступ к модели на сервере.')
            if status == 404:
                raise ApiError.service_unavailable('Модель Gemini недоступна. Проверьте GEMINI_MODEL на сервере.')
            if status == 429:
                raise ApiError(429, 'Достигнут лимит запросов Gemini. Подождите немного и повторите. Если ошибка сохраняется, проверьте квоту API.')
            raise ApiError(503, 'AI временно недоступен. Попробуйте позже.')
        raise ApiError.service_unavailable()

    @staticmethod
    def _response_text(payload: dict) -> str:
        if not isinstance(payload, dict):
            raise ValueError('Expected a response object')
        feedback = payload.get('promptFeedback') or {}
        if not isinstance(feedback, dict):
            raise ValueError('Invalid prompt feedback')
        if feedback.get('blockReason'):
            raise ApiError(422, 'AI-провайдер отклонил содержимое запроса или вложения. Используйте другой учебный материал.')
        candidates = payload.get('candidates') or []
        if not isinstance(candidates, list) or not candidates:
            raise ValueError('No answer')
        candidate = candidates[0]
        if not isinstance(candidate, dict):
            raise ValueError('Invalid answer')
        if candidate.get('finishReason') in ('SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'RECITATION', 'SPII', 'IMAGE_SAFETY'):
            raise ApiError(422, 'AI-провайдер не разрешил обработку этого материала. Используйте другой учебный материал.')
        if candidate.get('finishReason') == 'MAX_TOKENS':
            raise _TruncatedResponseError('Output limit reached')
        if candidate.get('finishReason') != 'STOP':
            raise ValueError('Incomplete or blocked answer')
        content = candidate.get('content')
        if not isinstance(content, dict) or not isinstance(content.get('parts'), list):
            raise ValueError('Invalid answer content')
        parts = content['parts']
        if any(not isinstance(part, dict) or not isinstance(part.get('text', ''), str) for part in parts):
            raise ValueError('Invalid answer parts')
        text = ''.join(part.get('text', '') for part in parts if not part.get('thought'))
        if not text.strip():
            raise ValueError('Empty answer')
        return text


gemini_service = GeminiService()
