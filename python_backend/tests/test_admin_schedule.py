"""Schedule CRUD integration tests for a disposable database only.

RUN_SCHEDULE_DB_TESTS=1 DATABASE_URL=postgresql://.../schedule_test...
The bulk-clear test deletes every schedule item, so a database whose name
starts with schedule_test is required. Never run it against working data.
"""
import logging
import os
import unittest
import uuid
from datetime import datetime
from urllib.parse import urlsplit
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import httpx
from pydantic import ValidationError

from app.db.database import prisma
from app.main import app
from app.schemas.schedule import ScheduleItemWrite, ScheduleClearRequest
from app.services.auth import create_access_token
from app.services.schedule import schedule_service


class ScheduleValidationTests(unittest.TestCase):
    def test_time_and_day_bounds(self):
        valid = dict(subjectId="subject", groupId="group", dayOfWeek=0, startTime="09:00", endTime="10:30")
        self.assertEqual(ScheduleItemWrite(**valid).dayOfWeek, 0)
        for changes in ({"dayOfWeek": -1}, {"dayOfWeek": 7}, {"dayOfWeek": True},
                        {"startTime": "9:00"}, {"startTime": "24:00"}, {"endTime": "10:60"},
                        {"endTime": "09:00"}, {"endTime": "08:00"}, {"subjectId": " "}):
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                ScheduleItemWrite(**{**valid, **changes})

    def test_bulk_clear_requires_explicit_confirmation(self):
        for payload in ({}, {"confirmation": False}, {"confirmation": ""}, {"confirmation": "clear"}):
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                ScheduleClearRequest(**payload)
        self.assertEqual(ScheduleClearRequest(confirmation="CLEAR_SCHEDULE").confirmation, "CLEAR_SCHEDULE")


@unittest.skipUnless(os.getenv("RUN_SCHEDULE_DB_TESTS") == "1", "Requires disposable schedule_test database")
class AdminScheduleTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        database = urlsplit(os.environ.get("DATABASE_URL", "")).path.lstrip("/")
        if not database.startswith("schedule_test"):
            raise RuntimeError("Refusing schedule-clear tests outside a disposable schedule_test database")
        logging.getLogger("httpx").setLevel(logging.WARNING)
        await prisma.connect()
        self.prefix = uuid.uuid4().hex
        self.users = {}
        self.headers = {}
        for role in ("ADMIN", "TEACHER", "STUDENT"):
            user = await prisma.user.create(data={"email": f"{self.prefix}-{role}@example.com", "firstName": "Test", "lastName": role, "role": role, "passwordHash": "unused-in-token-tests"})
            self.users[role] = user
            # Even a staff claim must not bypass the user's actual role in DB.
            token = create_access_token({"userId": user.id, "role": "ADMIN"})
            self.headers[role] = {"Authorization": f"Bearer {token}"}
        self.groups = [await prisma.group.create(data={"code": f"{self.prefix}-{i}", "name": f"Schedule test {self.prefix} {i}"}) for i in range(2)]
        self.subject = await prisma.subject.create(data={"code": self.prefix, "name": "Тестовый предмет", "teacherId": self.users["TEACHER"].id})
        self.payload = {"subjectId": self.subject.id, "groupId": self.groups[0].id, "dayOfWeek": 1, "startTime": "09:00", "endTime": "10:30", "room": " А-301 "}
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()
        await prisma.subject.delete(where={"id": self.subject.id})
        for group in self.groups:
            await prisma.group.delete(where={"id": group.id})
        await prisma.auditlog.delete_many(where={"userId": self.users["ADMIN"].id})
        for user in self.users.values():
            await prisma.user.delete(where={"id": user.id})
        await prisma.disconnect()

    async def create(self, **changes):
        response = await self.client.post("/api/v1/admin/schedule", headers=self.headers["ADMIN"], json={**self.payload, **changes})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["data"]

    async def test_crud_visibility_and_sunday(self):
        item = await self.create()
        self.assertEqual(item["room"], "А-301")
        self.assertEqual(item["teacherName"], "Test TEACHER")
        self.assertEqual(item["subject"]["name"], "Тестовый предмет")
        public = await self.client.get("/api/v1/schedule/week", headers=self.headers["STUDENT"], params={"group": self.groups[0].code})
        self.assertEqual(public.json()["data"]["week"]["1"][0]["id"], item["id"])
        updated = {**self.payload, "groupId": self.groups[1].id, "dayOfWeek": 0, "startTime": "11:00", "endTime": "12:30", "teacherName": "Другой преподаватель", "isActive": False}
        path = "/api/v1/admin/schedule/" + item["id"]
        response = await self.client.put(path, headers=self.headers["ADMIN"], json=updated)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["data"]["teacherName"], "Другой преподаватель")
        admin = await self.client.get("/api/v1/admin/schedule", headers=self.headers["ADMIN"])
        self.assertFalse(admin.json()["data"]["items"][0]["isActive"])
        public = await self.client.get("/api/v1/schedule/week", headers=self.headers["STUDENT"], params={"group": self.groups[1].code})
        self.assertEqual(public.json()["data"]["week"]["0"], [])
        response = await self.client.put(path, headers=self.headers["ADMIN"], json={**updated, "isActive": True})
        self.assertEqual(response.status_code, 200)
        public = await self.client.get("/api/v1/schedule/week", headers=self.headers["STUDENT"], params={"group": self.groups[1].code})
        self.assertEqual(public.json()["data"]["week"]["0"][0]["id"], item["id"])
        deleted = await self.client.delete(path, headers=self.headers["ADMIN"])
        self.assertEqual(deleted.json()["data"]["deletedCount"], 1)
        self.assertEqual((await self.client.delete(path, headers=self.headers["ADMIN"])).status_code, 404)
        self.assertEqual((await self.client.put(path, headers=self.headers["ADMIN"], json=updated)).status_code, 404)

    async def test_every_admin_endpoint_rejects_other_roles(self):
        item = await self.create()
        base = "/api/v1/admin/schedule"
        requests = [("GET", base, None), ("POST", base, self.payload), ("PUT", base + "/" + item["id"], self.payload),
                    ("DELETE", base + "/" + item["id"], None), ("DELETE", base, {"confirmation": "CLEAR_SCHEDULE"})]
        for headers in ({}, self.headers["STUDENT"], self.headers["TEACHER"]):
            for method, path, body in requests:
                response = await self.client.request(method, path, headers=headers, json=body)
                self.assertIn(response.status_code, (401, 403), (method, path, response.text))
        self.assertEqual(await prisma.scheduleitem.count(), 1)

    async def test_foreign_keys_and_invalid_times_do_not_write(self):
        for changes, status in [({"subjectId": "missing"}, 400), ({"groupId": "missing"}, 400),
                                ({"endTime": "08:00"}, 422), ({"dayOfWeek": 7}, 422)]:
            response = await self.client.post("/api/v1/admin/schedule", headers=self.headers["ADMIN"], json={**self.payload, **changes})
            self.assertEqual(response.status_code, status, response.text)
        self.assertEqual(await prisma.scheduleitem.count(), 0)

    async def test_clear_all_requires_confirmation_and_only_deletes_schedule(self):
        await self.create()
        await self.create(groupId=self.groups[1].id, dayOfWeek=0, isActive=False)
        lecture = await prisma.lecture.create(data={"title": "Keep this lecture", "content": "Fixture", "subjectId": self.subject.id, "teacherId": self.users["TEACHER"].id})
        for body in (None, {}, {"confirmation": "wrong"}):
            response = await self.client.request("DELETE", "/api/v1/admin/schedule", headers=self.headers["ADMIN"], json=body)
            self.assertEqual(response.status_code, 422)
            self.assertEqual(await prisma.scheduleitem.count(), 2)
        response = await self.client.request("DELETE", "/api/v1/admin/schedule", headers=self.headers["ADMIN"], json={"confirmation": "CLEAR_SCHEDULE"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["data"]["deletedCount"], 2)
        self.assertEqual(await prisma.scheduleitem.count(), 0)
        self.assertIsNotNone(await prisma.lecture.find_unique(where={"id": lecture.id}))
        self.assertEqual(await prisma.group.count(), 2)
        self.assertEqual(await prisma.subject.count(), 1)
        self.assertEqual(await prisma.user.count(), 3)
        audit = await prisma.auditlog.find_first(where={"action": "SCHEDULE_CLEAR", "userId": self.users["ADMIN"].id})
        self.assertIsNotNone(audit)
        response = await self.client.request("DELETE", "/api/v1/admin/schedule", headers=self.headers["ADMIN"], json={"confirmation": "CLEAR_SCHEDULE"})
        self.assertEqual(response.json()["data"]["deletedCount"], 0)

    async def test_failed_audit_rolls_back_bulk_delete(self):
        item = await self.create()
        with patch.object(schedule_service, "_audit", new=AsyncMock(side_effect=RuntimeError("Test audit failure"))):
            response = await self.client.request("DELETE", "/api/v1/admin/schedule", headers=self.headers["ADMIN"], json={"confirmation": "CLEAR_SCHEDULE"})
        self.assertEqual(response.status_code, 500)
        self.assertIsNotNone(await prisma.scheduleitem.find_unique(where={"id": item["id"]}))

    async def test_today_respects_week_parity(self):
        every = await self.create()
        odd = await self.create(weekType="odd")
        even = await self.create(weekType="even")
        for date, expected in (("2026-10-05T09:00:00", odd), ("2026-10-12T09:00:00", even)):
            with patch("app.services.schedule.datetime", wraps=datetime) as clock:
                clock.now.return_value = datetime.fromisoformat(date).replace(tzinfo=ZoneInfo("Asia/Almaty"))
                result = await schedule_service.get_today(self.groups[0].code)
            self.assertEqual({item["id"] for item in result["items"]}, {every["id"], expected["id"]})

    async def test_student_defaults_to_own_group_and_unassigned_is_empty(self):
        own = await self.create()
        await self.create(groupId=self.groups[1].id)
        headers = self.headers["STUDENT"]
        empty = await self.client.get("/api/v1/schedule", headers=headers)
        self.assertEqual(empty.json()["data"]["items"], [])
        await prisma.studentprofile.create(data={"userId": self.users["STUDENT"].id, "groupId": self.groups[0].id})
        assigned = await self.client.get("/api/v1/schedule", headers=headers)
        self.assertEqual([item["id"] for item in assigned.json()["data"]["items"]], [own["id"]])
        week = await self.client.get("/api/v1/schedule/week", headers=headers)
        self.assertEqual([item["id"] for item in week.json()["data"]["week"]["1"]], [own["id"]])
