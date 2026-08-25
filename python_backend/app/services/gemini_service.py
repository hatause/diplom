"""Asynchronous Google Gemini REST client used by AiTutor services.

Using the public REST API through ``httpx.AsyncClient`` keeps every network
operation non-blocking and avoids a synchronous SDK hidden inside routes.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Sequence
from typing import Any

import httpx
from json_repair import repair_json

from app.core.config import settings
from app.core.errors import ApiError

logger = logging.getLogger(__name__)

MAX_AI_RETRIES = 3
AI_RETRY_BASE_DELAY_SECONDS = 1.0
_SAFETY_SETTINGS: list[dict[str, str]] = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
]


def clean_json_text(text: str) -> str:
    """Remove common Gemini markdown wrappers while leaving JSON untouched."""

    candidate = text.strip()
    if candidate.startswith("```"):
        first_newline = candidate.find("\n")
        if first_newline >= 0:
            candidate = candidate[first_newline + 1 :]
        if candidate.rstrip().endswith("```"):
            candidate = candidate.rstrip()[:-3]
    return candidate.strip()


def parse_repaired_json(text: str) -> Any:
    """Parse Gemini JSON and repair recoverable syntax defects deterministically."""

    candidate = clean_json_text(text)
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # json-repair handles truncated brackets, trailing commas, bare keys,
        # smart quotes, and similar model-output mistakes before Pydantic checks
        # the semantic contract in the calling service.
        repaired = repair_json(candidate, return_objects=False)
        return json.loads(repaired)


class GeminiService:
    """Minimal retrying async Gemini client with JSON/text/chat helpers."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0))

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def generate_json(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 4096,
    ) -> Any:
        text = await self._generate(
            contents=[{"role": "user", "parts": [{"text": f"{system_prompt}\n\n---\n\n{user_prompt}"}]}],
            max_output_tokens=max_output_tokens,
            response_mime_type="application/json",
        )
        try:
            return parse_repaired_json(text)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            logger.warning("Gemini produced unrecoverable JSON: %s", exc)
            raise ApiError.service_unavailable("AI generated an invalid response. Please try again.") from exc

    async def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 2048,
    ) -> str:
        return await self._generate(
            contents=[{"role": "user", "parts": [{"text": f"{system_prompt}\n\n---\n\n{user_prompt}"}]}],
            max_output_tokens=max_output_tokens,
        )

    async def chat(
        self,
        system_prompt: str,
        messages: Sequence[dict[str, str]],
        max_output_tokens: int = 2048,
    ) -> str:
        contents = [
            {
                "role": "model" if message["role"] == "assistant" else "user",
                "parts": [{"text": message["content"]}],
            }
            for message in messages
        ]
        if contents and contents[0]["role"] == "user":
            contents[0]["parts"][0]["text"] = (
                f"{system_prompt}\n\n---\n\n{contents[0]['parts'][0]['text']}"
            )
        else:
            contents.insert(0, {"role": "user", "parts": [{"text": system_prompt}]})
        return await self._generate(contents=contents, max_output_tokens=max_output_tokens)

    def is_configured(self) -> bool:
        return bool(settings.gemini_api_key)

    async def _generate(
        self,
        *,
        contents: list[dict[str, Any]],
        max_output_tokens: int,
        response_mime_type: str | None = None,
    ) -> str:
        if not settings.gemini_api_key:
            raise ApiError.service_unavailable("AI service not configured. Please set GEMINI_API_KEY.")
        if self._client is None:
            await self.start()
        assert self._client is not None

        generation_config: dict[str, Any] = {
            "maxOutputTokens": max_output_tokens,
            "temperature": 0.7,
        }
        if response_mime_type is not None:
            generation_config["responseMimeType"] = response_mime_type

        payload = {
            "contents": contents,
            "generationConfig": generation_config,
            "safetySettings": _SAFETY_SETTINGS,
        }
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.gemini_model}:generateContent"
        )

        last_error: Exception | None = None
        for attempt in range(MAX_AI_RETRIES):
            try:
                response = await self._client.post(url, params={"key": settings.gemini_api_key}, json=payload)
                response.raise_for_status()
                data = response.json()
                text = self._response_text(data)
                if not text.strip():
                    raise ValueError("Empty response from AI")
                return text
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                last_error = exc
                logger.warning("Gemini generation attempt %s/%s failed: %s", attempt + 1, MAX_AI_RETRIES, exc)
                if attempt < MAX_AI_RETRIES - 1:
                    await asyncio.sleep(AI_RETRY_BASE_DELAY_SECONDS * (2**attempt))

        logger.error("Gemini generation failed after retries: %s", last_error)
        raise ApiError.service_unavailable("AI service temporarily unavailable. Please try again.")

    @staticmethod
    def _response_text(payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates") or []
        if not candidates:
            raise ValueError("Gemini returned no candidates")
        parts = candidates[0].get("content", {}).get("parts", [])
        return "".join(str(part.get("text", "")) for part in parts)


gemini_service = GeminiService()
