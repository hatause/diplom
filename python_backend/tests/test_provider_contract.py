import json
import unittest
from unittest.mock import patch

import httpx

from app.core.config import settings
from app.core.errors import ApiError
from app.services.gemini_service import GeminiService


class ProviderContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_success_payloads_become_safe_gateway_errors(self):
        payloads = [None, [], {'promptFeedback': ['invalid']}, {'candidates': [None]},
                    {'candidates': {}}, {'candidates': [{'finishReason': 'STOP', 'content': None}]},
                    {'candidates': [{'finishReason': 'STOP', 'content': {'parts': None}}]},
                    {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [None]}}]},
                    {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': 42}]}}]}]
        for payload in payloads:
            service = GeminiService()
            service._client = httpx.AsyncClient(transport=httpx.MockTransport(
                lambda request: httpx.Response(200, content=json.dumps(payload))))
            try:
                with self.subTest(payload=payload):
                    with patch.object(settings, 'GEMINI_API_KEY', 'fixture'), self.assertRaises(ApiError) as caught:
                        await service.generate_text('Tutor', 'Explain fractions')
                    self.assertEqual(caught.exception.status_code, 502)
            finally:
                await service.close()
