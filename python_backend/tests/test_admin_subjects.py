"""Subject creation regression tests; opt-in DB tests remove their own records."""
import os
import unittest
import uuid

import httpx
from pydantic import ValidationError

from app.db.database import prisma
from app.main import app
from app.schemas.admin import SubjectCreate
from app.services.auth import create_access_token


class SubjectValidationTests(unittest.TestCase):
    def test_optional_teacher_and_trimmed_fields(self):
        for teacher in (None, "", "  "):
            data = SubjectCreate(name=" Math ", code=" MATH ", teacherId=teacher)
            self.assertIsNone(data.teacherId)
            self.assertEqual((data.name, data.code), ("Math", "MATH"))
        for field in ("name", "code"):
            with self.assertRaises(ValidationError):
                SubjectCreate(**{**dict(name="Math", code="MATH"), field: "  "})


@unittest.skipUnless(os.getenv("RUN_DB_TESTS") == "1", "Set RUN_DB_TESTS=1 for database integration")
class AdminSubjectTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_subjects_and_reject_invalid_requests(self):
        await prisma.connect()
        prefix = "subject-test-" + uuid.uuid4().hex
        users = []
        try:
            for role in ("ADMIN", "TEACHER", "STUDENT"):
                users.append(await prisma.user.create(data={
                    "email": f"{prefix}-{role}@example.com", "firstName": "Test", "lastName": role,
                    "role": role, "passwordHash": "unused",
                }))
            admin, teacher, student = users
            headers = {"Authorization": "Bearer " + create_access_token({"userId": admin.id, "role": "ADMIN"})}
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test", headers=headers) as client:
                for index, teacher_id in enumerate(("", None, teacher.id)):
                    payload = {"name": " New subject ", "code": f"{prefix}-{index}", "teacherId": teacher_id}
                    response = await client.post("/api/v1/admin/subjects", json=payload)
                    self.assertEqual(response.status_code, 200, response.text)
                    saved = await prisma.subject.find_unique(where={"id": response.json()["data"]["id"]})
                    self.assertEqual(saved.teacherId, teacher_id or None)
                    self.assertEqual(saved.name, "New subject")
                    duplicate = await client.post("/api/v1/admin/subjects", json=payload)
                    self.assertEqual(duplicate.status_code, 409, duplicate.text)
                listed = await client.get("/api/v1/admin/subjects")
                entries = [s for s in listed.json()["data"] if s["code"].startswith(prefix)]
                self.assertEqual(len(entries), 3)
                assigned = next(s for s in entries if s["teacherId"])
                self.assertEqual(assigned["teacher"]["id"], teacher.id)
                self.assertNotIn("passwordHash", assigned["teacher"])
                for invalid_id in ("missing", student.id):
                    response = await client.post("/api/v1/admin/subjects", json={"name": "Test", "code": prefix, "teacherId": invalid_id})
                    self.assertEqual(response.status_code, 400, response.text)
                await prisma.user.update(where={"id": teacher.id}, data={"isActive": False})
                response = await client.post("/api/v1/admin/subjects", json={"name": "Test", "code": prefix, "teacherId": teacher.id})
                self.assertEqual(response.status_code, 400)
                response = await client.post("/api/v1/admin/subjects", json={"name": " ", "code": prefix})
                self.assertEqual(response.status_code, 422)
                response = await client.post("/api/v1/admin/subjects", headers={"Authorization": "Bearer " + create_access_token({"userId": student.id, "role": "STUDENT"})}, json={"name": "Test", "code": prefix})
                self.assertEqual(response.status_code, 403)
        finally:
            await prisma.subject.delete_many(where={"code": {"startsWith": prefix}})
            for user in users:
                await prisma.user.delete(where={"id": user.id})
            await prisma.disconnect()
