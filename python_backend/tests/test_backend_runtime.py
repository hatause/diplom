"""Contracts retained when the Node backend is removed."""
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
from prisma.models import Achievement

from app.core.security import TokenData, get_current_user
from app.main import app
from app.services.achievements import achievements_service


class BackendRuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_uploaded_file_survives_a_different_launch_directory(self):
        # Tests run from the repo root, unlike `cd python_backend && python run.py`.
        # Files must still land in the same persistent directory and be readable
        # using the URL returned to the frontend.
        target = None
        app.dependency_overrides[get_current_user] = lambda: TokenData(userId="upload-test", role="TEACHER")
        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                uploaded = await client.post("/api/v1/upload", files={"file": ("lesson.txt", b"Migration upload test", "text/plain")})
                self.assertEqual(uploaded.status_code, 200, uploaded.text)
                url = uploaded.json()["data"]["fileUrl"]
                target = Path(__file__).resolve().parents[1] / "uploads" / url.rsplit("/", 1)[1]
                self.assertTrue(target.is_file(), "Uploads must not depend on the launch directory")
                self.assertEqual(target.read_bytes(), b"Migration upload test")
                downloaded = await client.get(url)
                self.assertEqual(downloaded.status_code, 200)
                self.assertEqual(downloaded.content, b"Migration upload test")
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            if target:
                target.unlink(missing_ok=True)

    async def test_seeded_achievements_match_the_frontend_contract(self):
        achievement = Achievement(
            id="first-test", code="FIRST_TEST", name="Первый тест",
            description="Пройдите ваш первый тест", iconName="Trophy", xpReward=50,
            condition='{"type": "test_count", "value": 1}', createdAt=datetime.now(timezone.utc),
        )
        with patch("app.services.achievements.prisma") as db:
            db.achievement.find_many = AsyncMock(return_value=[achievement])
            db.userachievement.find_many = AsyncMock(return_value=[])
            db.studentprofile.find_unique = AsyncMock(return_value=None)
            result = await achievements_service.get_achievements("student")
        entry = result["achievements"][0]
        self.assertEqual(entry["name"], "Первый тест")
        self.assertEqual(entry["condition"], {"type": "test_count", "value": 1})
        self.assertFalse(entry["isUnlocked"])
        self.assertEqual(result["stats"]["totalCount"], 1)
