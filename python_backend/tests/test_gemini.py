import asyncio
import json
import unittest
from unittest.mock import patch

import httpx
from pydantic import BaseModel
from app.core.config import settings
from app.core.errors import ApiError
from app.services.gemini_service import GeminiService


class Result(BaseModel):
    answer: str


def response(text='A clear explanation', reason='STOP'):
    return httpx.Response(200, json={'candidates': [{'finishReason': reason, 'content': {'parts': [{'text': text}]}}]})


class GeminiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.service = GeminiService()
        self.key = patch.object(settings, 'GEMINI_API_KEY', 'test-secret-never-log')
        self.key.start()
        self.addCleanup(self.key.stop)

    async def asyncTearDown(self):
        await self.service.close()

    def transport(self, handler):
        self.service._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    async def test_system_history_images_and_key_header(self):
        def handler(request):
            self.assertNotIn('test-secret', str(request.url))
            self.assertEqual(request.headers['x-goog-api-key'], 'test-secret-never-log')
            body = json.loads(request.content)
            self.assertEqual(body['systemInstruction']['parts'], [{'text': 'Explain in German'}])
            self.assertEqual(body['contents'][1]['role'], 'model')
            self.assertEqual(body['contents'][-1]['parts'][0], {'inlineData': {'mimeType': 'image/png', 'data': 'YWJj'}})
            return response()
        self.transport(handler)
        result = await self.service.chat('Explain in German', [
            {'role': 'user', 'content': 'First question'}, {'role': 'assistant', 'content': 'First answer'},
            {'role': 'user', 'content': [{'type': 'image', 'mimeType': 'image/png', 'data': 'YWJj'}, {'type': 'text', 'text': 'Help me'}]},
        ])
        self.assertEqual(result, 'A clear explanation')

    async def test_structured_output_and_validation(self):
        def handler(request):
            self.assertEqual(json.loads(request.content)['generationConfig']['responseMimeType'], 'application/json')
            self.assertEqual(json.loads(request.content)['generationConfig']['responseJsonSchema'], Result.model_json_schema())
            return response('{"answer":"four"}')
        self.transport(handler)
        result = await self.service.generate_json('Tutor', '2+2', response_model=Result)
        self.assertEqual(result.answer, 'four')

    async def test_pdf_is_passed_to_structured_generation(self):
        def handler(request):
            body = json.loads(request.content)
            self.assertEqual(body['contents'][0]['parts'][1],
                             {'inlineData': {'mimeType': 'application/pdf', 'data': 'YWJj'}})
            return response('{"answer":"document answer"}')
        self.transport(handler)
        result = await self.service.generate_json('Tutor', 'Use the attached lecture', response_model=Result,
            input_blocks=[{'type': 'document', 'mimeType': 'application/pdf', 'data': 'YWJj'}])
        self.assertEqual(result.answer, 'document answer')

    async def test_invalid_schema_rejected(self):
        self.transport(lambda request: response('{"wrong":"field"}'))
        with self.assertRaises(ApiError) as cm:
            await self.service.generate_json('Tutor', '2+2', response_model=Result)
        self.assertEqual(cm.exception.status_code, 502)

    async def test_blocked_attachment_is_not_reported_as_server_failure(self):
        self.transport(lambda request: httpx.Response(200, json={'promptFeedback': {'blockReason': 'OTHER'}}))
        with self.assertRaises(ApiError) as caught:
            await self.service.generate_text('Tutor', 'Explain attachment')
        self.assertEqual(caught.exception.status_code, 422)
        self.assertIn('отклонил', caught.exception.detail)

    async def test_truncation_not_saved_as_valid_json(self):
        self.transport(lambda request: response('{"answer":"four"}', 'MAX_TOKENS'))
        with self.assertRaises(ApiError) as cm:
            await self.service.generate_json('Tutor', '2+2', response_model=Result)
        self.assertEqual(cm.exception.status_code, 502)

    async def test_thinking_has_separate_allowance_for_25_models(self):
        for model in ('gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'):
            def handler(request):
                config = json.loads(request.content)['generationConfig']
                self.assertEqual(config['thinkingConfig'], {'thinkingBudget': 1024})
                self.assertEqual(config['maxOutputTokens'], 5120)
                return response()
            self.transport(handler)
            with self.subTest(model=model), patch.object(settings, 'GEMINI_MODEL', model):
                self.assertEqual(await self.service.generate_text('Tutor', 'Hello'), 'A clear explanation')
            await self.service.close()

    async def test_unknown_model_does_not_receive_25_thinking_config(self):
        def handler(request):
            config = json.loads(request.content)['generationConfig']
            self.assertNotIn('thinkingConfig', config)
            self.assertEqual(config['maxOutputTokens'], 4096)
            return response()
        self.transport(handler)
        with patch.object(settings, 'GEMINI_MODEL', 'gemini-future-model'):
            await self.service.generate_text('Tutor', 'Hello')

    async def test_truncated_text_is_regenerated_with_larger_allowance(self):
        calls = []
        def handler(request):
            calls.append(json.loads(request.content))
            return response('private-partial-answer', 'MAX_TOKENS') if len(calls) == 1 else response('Complete answer')
        self.transport(handler)
        with patch.object(settings, 'GEMINI_MODEL', 'gemini-2.5-flash'):
            with self.assertLogs('app.services.gemini_service', level='WARNING') as logs:
                answer = await self.service.generate_text('private-system', 'private-user-question')
        self.assertEqual(answer, 'Complete answer')
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[1]['generationConfig']['maxOutputTokens'], 10240)
        self.assertEqual(calls[0]['contents'], calls[1]['contents'])
        for private in ('private-partial-answer', 'private-system', 'private-user-question', 'test-secret-never-log'):
            self.assertNotIn(private, str(logs.output))

    async def test_thought_only_truncation_recovers(self):
        calls = []
        def handler(request):
            calls.append(request)
            if len(calls) == 1:
                return httpx.Response(200, json={'candidates': [{'finishReason': 'MAX_TOKENS',
                    'content': {'parts': [{'text': 'private-thought', 'thought': True}]}}],
                    'usageMetadata': {'thoughtsTokenCount': 4096, 'candidatesTokenCount': 0}})
            return response('Final explanation')
        self.transport(handler)
        with self.assertLogs('app.services.gemini_service', level='WARNING') as logs:
            self.assertEqual(await self.service.generate_text('Tutor', 'Explain'), 'Final explanation')
        self.assertEqual(len(calls), 2)
        self.assertNotIn('private-thought', str(logs.output))
        self.assertIn('4096', str(logs.output))

    async def test_persistent_json_truncation_stays_rejected(self):
        calls = []
        def handler(request):
            calls.append(json.loads(request.content))
            return response('{"answer":"looks complete but truncated"}', 'MAX_TOKENS')
        self.transport(handler)
        with self.assertRaises(ApiError) as caught:
            await self.service.generate_json('Tutor', 'Question', response_model=Result)
        self.assertEqual(caught.exception.status_code, 502)
        self.assertEqual(len(calls), 2)
        self.assertTrue(all(c['generationConfig']['responseMimeType'] == 'application/json' for c in calls))
        self.assertTrue(all(c['generationConfig']['responseJsonSchema'] == Result.model_json_schema() for c in calls))

    async def test_output_ceiling_is_not_exceeded_or_retried_uselessly(self):
        calls = []
        def handler(request):
            calls.append(json.loads(request.content))
            return response('Partial', 'MAX_TOKENS')
        self.transport(handler)
        with self.assertRaises(ApiError):
            await self.service.generate_text('Tutor', 'Explain', max_output_tokens=16000)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]['generationConfig']['maxOutputTokens'], 16000)

    async def test_safety_rejection_is_not_retried(self):
        calls = []
        def handler(request):
            calls.append(request)
            return response('Never return this', 'SAFETY')
        self.transport(handler)
        with self.assertRaises(ApiError) as caught:
            await self.service.generate_text('Tutor', 'Question')
        self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(len(calls), 1)

    async def test_retry_only_transient_errors(self):
        calls = []
        def handler(request):
            calls.append(request)
            return httpx.Response(503) if len(calls) == 1 else response()
        self.transport(handler)
        with patch('app.services.gemini_service.asyncio.sleep', new_callable=unittest.mock.AsyncMock):
            self.assertEqual(await self.service.generate_text('Tutor', 'Hello'), 'A clear explanation')
        self.assertEqual(len(calls), 2)

    async def test_auth_error_is_safe_and_not_retried(self):
        calls = []
        def handler(request):
            calls.append(request)
            return httpx.Response(403, json={'error': 'provider-private-error'})
        self.transport(handler)
        with self.assertRaises(ApiError) as cm:
            await self.service.generate_text('Tutor', 'Hello')
        self.assertEqual(len(calls), 1)
        self.assertNotIn('provider-private-error', str(cm.exception.detail))
        self.assertNotIn('test-secret', str(cm.exception.detail))

    async def test_provider_quota_is_reported_explicitly(self):
        self.transport(lambda request: httpx.Response(429))
        with patch('app.services.gemini_service.asyncio.sleep', new_callable=unittest.mock.AsyncMock):
            with self.assertRaises(ApiError) as caught:
                await self.service.generate_text('Tutor', 'Hello')
        self.assertEqual(caught.exception.status_code, 429)
        self.assertIn('лимит', caught.exception.detail)

    async def test_timeout_releases_slot(self):
        def handler(request):
            raise httpx.ReadTimeout('private network details', request=request)
        self.transport(handler)
        with self.assertRaises(ApiError) as cm:
            await self.service.generate_text('Tutor', 'Hello')
        self.assertEqual(cm.exception.status_code, 504)
        self.assertEqual(self.service._slots._value, 4)

    async def test_missing_key_makes_no_request(self):
        with patch.object(settings, 'GEMINI_API_KEY', ''):
            with self.assertRaises(ApiError) as cm:
                await self.service.generate_text('Tutor', 'Hello')
        self.assertEqual(cm.exception.status_code, 503)
        self.assertIsNone(self.service._client)
