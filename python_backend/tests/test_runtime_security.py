import unittest

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.core.config import Settings
from app.core.cors import cors_options


class RuntimeSecurityTests(unittest.IsolatedAsyncioTestCase):
    def configuration(self, **overrides):
        return Settings(_env_file=None, NODE_ENV='production',
                        JWT_SECRET='a' * 64, REFRESH_TOKEN_SECRET='b' * 64,
                        CORS_ORIGIN='https://school.example', **overrides)

    def test_production_rejects_predictable_signing_keys(self):
        for key in ('secret', '', 'change-me-to-a-random-64-char-string'):
            with self.subTest(key=key), self.assertRaises(ValidationError):
                Settings(_env_file=None, NODE_ENV='production', JWT_SECRET=key,
                         REFRESH_TOKEN_SECRET='b' * 64)
        with self.assertRaises(ValidationError) as error:
            Settings(_env_file=None, NODE_ENV='production', JWT_SECRET='a' * 64,
                     REFRESH_TOKEN_SECRET='short')
        self.assertNotIn('input_value=', str(error.exception))

    async def test_production_cors_uses_only_configured_origins(self):
        app = FastAPI()
        app.add_middleware(CORSMiddleware, **cors_options(self.configuration()))
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            for origin, allowed in [('https://school.example', True), ('http://localhost:5173', False),
                                    ('http://192.168.1.25:8000', False), ('https://other.example', False)]:
                response = await client.options('/api/v1/auth/refresh', headers={
                    'Origin': origin, 'Access-Control-Request-Method': 'POST'})
                self.assertEqual(response.status_code, 200 if allowed else 400, origin)
                self.assertEqual(response.headers.get('access-control-allow-origin'), origin if allowed else None)

    def test_development_retains_local_network_access(self):
        config = Settings(_env_file=None, NODE_ENV='development')
        options = cors_options(config)
        self.assertIn('http://localhost:5173', options['allow_origins'])
        self.assertIsNotNone(options['allow_origin_regex'])
