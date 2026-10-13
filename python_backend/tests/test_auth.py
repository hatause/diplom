"""Auth regressions; database tests create and remove only their own records."""
import asyncio
import os
import unittest
import uuid
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from app.db.database import prisma
from app.main import app
from app.schemas.auth import RegisterRequest, ChangePasswordRequest
from app.services.auth import auth_service, verify_password, create_refresh_token
from app.core.config import settings


class AuthValidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_refresh_token_cannot_be_used_as_bearer_access(self):
        with patch.object(settings, 'REFRESH_TOKEN_SECRET', settings.JWT_SECRET):
            token = create_refresh_token({'userId':'fixture','role':'ADMIN'})
        with patch('app.core.security.prisma') as db:
            lookup = db.user.find_unique = AsyncMock()
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                result = await client.get('/api/v1/auth/me', headers={'Authorization':'Bearer '+token})
                self.assertEqual(result.status_code, 401)
                lookup.assert_not_awaited()

    async def test_invalid_registration_returns_422_without_touching_database(self):
        valid = dict(email="Person@example.com", password="password123", firstName=" Test ", lastName=" User ")
        normalized = RegisterRequest(**valid)
        self.assertEqual(normalized.email, "person@example.com")
        self.assertEqual(normalized.firstName, "Test")
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            for change in ({"password": "short"}, {"password": "я" * 37}, {"password": "a" * 73}, {"firstName": " "}, {"email": "invalid"}):
                response = await client.post("/api/v1/auth/register", json={**valid, **change})
                self.assertEqual(response.status_code, 422, response.text)
            for path, payload in [("login", {"email": valid["email"], "password": "я" * 37}),
                                  ("refresh", {} )]:
                response = await client.post("/api/v1/auth/" + path, json=payload)
                self.assertEqual(response.status_code, 422 if path == "login" else 401)
        RegisterRequest(**{**valid, "password": "я" * 36})
        with self.assertRaises(ValidationError):
            ChangePasswordRequest(currentPassword="password123", newPassword="я" * 37)
        self.assertFalse(verify_password("password123", "invalid-hash"))


@unittest.skipUnless(os.getenv("RUN_DB_TESTS") == "1", "Set RUN_DB_TESTS=1 for database integration")
class AuthDatabaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_registration_login_password_and_session(self):
        await prisma.connect()
        prefix = "auth-test-" + uuid.uuid4().hex
        email = prefix + "@example.com"
        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                payload = dict(email=email.upper(), password="password123", firstName="Test", lastName="User", groupCode=prefix)
                results = await asyncio.gather(*(client.post("/api/v1/auth/register", json=payload) for _ in range(2)))
                self.assertEqual(sorted(r.status_code for r in results), [200, 409], [r.text for r in results])
                data = next(r for r in results if r.status_code == 200).json()["data"]
                user_id = data["user"]["id"]
                self.assertEqual(data["user"]["email"], email)
                self.assertNotIn("passwordHash", data["user"])
                headers = {"Authorization": "Bearer " + data["accessToken"]}
                me = await client.get("/api/v1/auth/me", headers=headers)
                self.assertEqual(me.status_code, 200)
                self.assertEqual(me.json()["data"]["studentProfile"]["group"]["code"], prefix)
                wrong = await client.post("/api/v1/auth/login", json={"email": email, "password": "incorrect"})
                self.assertEqual(wrong.status_code, 401)
                # Legacy mixed-case email records must remain usable.
                await prisma.user.update(where={"id": user_id}, data={"email": email.upper()})
                logged = await client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
                self.assertEqual(logged.status_code, 200, logged.text)
                old_cookie = client.cookies.get("refreshToken")
                with patch.object(auth_service, "create_tokens", new=AsyncMock(side_effect=RuntimeError("token storage failed"))):
                    with self.assertRaises(RuntimeError):
                        await auth_service.refresh(old_cookie)
                self.assertIsNotNone(await prisma.refreshtoken.find_unique(where={"token": old_cookie}))
                refreshed = await client.post("/api/v1/auth/refresh")
                self.assertEqual(refreshed.status_code, 200, refreshed.text)
                self.assertIsNone(await prisma.refreshtoken.find_unique(where={"token": old_cookie}))
                current_cookie = client.cookies.get("refreshToken")
                concurrent = await asyncio.gather(auth_service.refresh(current_cookie), auth_service.refresh(current_cookie), return_exceptions=True)
                self.assertEqual(sum(isinstance(r, dict) for r in concurrent), 1)
                self.assertEqual([r.status_code for r in concurrent if isinstance(r, HTTPException)], [401])
                changed = await client.put("/api/v1/auth/password", headers=headers, json={"currentPassword": "password123", "newPassword": "New-password123"})
                self.assertEqual(changed.status_code, 200, changed.text)
                self.assertEqual((await client.post("/api/v1/auth/refresh")).status_code, 401)
                self.assertEqual((await client.post("/api/v1/auth/login", json={"email": email, "password": "New-password123"})).status_code, 200)
                self.assertEqual((await client.post("/api/v1/auth/logout")).status_code, 200)
                self.assertEqual((await client.post("/api/v1/auth/refresh")).status_code, 401)
        finally:
            # Also clean up if an assertion fails before the response is decoded.
            await prisma.user.delete_many(where={"email": {"equals": email, "mode": "insensitive"}})
            await prisma.group.delete_many(where={"code": prefix})
            await prisma.disconnect()

    async def test_token_failure_rolls_back_registration(self):
        await prisma.connect()
        email = "auth-rollback-" + uuid.uuid4().hex + "@example.com"
        try:
            with patch.object(auth_service, "create_tokens", new=AsyncMock(side_effect=RuntimeError("token storage failed"))):
                with self.assertRaises(RuntimeError):
                    await auth_service.register(RegisterRequest(email=email, password="password123", firstName="Test", lastName="User"))
            self.assertIsNone(await prisma.user.find_unique(where={"email": email}))
        finally:
            await prisma.user.delete_many(where={"email": email})
            await prisma.disconnect()
