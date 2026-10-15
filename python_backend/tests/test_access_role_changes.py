"""A role change must revoke staff access even when historical relations remain."""
import os
import unittest
import uuid

import httpx

from app.core.config import UPLOAD_DIR
from app.db.database import prisma
from app.main import app
from app.services.auth import create_access_token


@unittest.skipUnless(os.getenv('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1')
class RoleChangeAccessTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.assertIn('/schedule_test_', os.environ.get('DATABASE_URL', ''))
        await prisma.connect()
        self.prefix = 'role-audit-' + uuid.uuid4().hex
        self.users = []
        for role in ('ADMIN', 'TEACHER'):
            self.users.append(await prisma.user.create(data={
                'email': self.prefix + role + '@example.com', 'passwordHash': 'unused',
                'firstName': 'Audit', 'lastName': role, 'role': role,
            }))
        self.admin, self.teacher = self.users
        self.group = await prisma.group.create(data={
            'name': self.prefix, 'code': self.prefix,
            'teachers': {'connect': [{'id': self.teacher.id}]},
        })
        self.subject = await prisma.subject.create(data={
            'name': self.prefix, 'code': self.prefix, 'teacherId': self.teacher.id,
        })
        self.path = UPLOAD_DIR / (self.prefix + '.txt')
        self.path.write_text('Private group material', encoding='utf-8')
        self.file_url = '/api/v1/uploads/' + self.path.name
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test')

    def headers(self, user):
        return {'Authorization': 'Bearer ' + create_access_token({'userId': user.id, 'role': user.role})}

    async def asyncTearDown(self):
        await self.client.aclose()
        await prisma.subject.delete(where={'id': self.subject.id})
        await prisma.auditlog.delete_many(where={'userId': self.admin.id})
        await prisma.user.delete_many(where={'id': {'in': [u.id for u in self.users]}})
        await prisma.group.delete(where={'id': self.group.id})
        self.path.unlink(missing_ok=True)
        await prisma.disconnect()

    async def check_demotion(self, author):
        lecture = await prisma.lecture.create(data={
            'title': 'Private', 'content': '', 'subjectId': self.subject.id,
            'groupId': self.group.id, 'teacherId': author.id, 'fileUrl': self.file_url,
        })
        paths = ['/api/v1/lectures/group/' + self.group.id,
                 '/api/v1/lectures/' + lecture.id, self.file_url]
        for path in paths:
            self.assertEqual((await self.client.get(path, headers=self.headers(self.teacher))).status_code, 200)
        changed = await self.client.put('/api/v1/admin/users/' + self.teacher.id,
                                        headers=self.headers(self.admin), json={'role': 'STUDENT'})
        self.assertEqual(changed.status_code, 200, changed.text)
        # Reuse the old access token: authorization must use the current DB role.
        for path in paths:
            response = await self.client.get(path, headers=self.headers(self.teacher))
            self.assertEqual(response.status_code, 403, path + ': ' + response.text[:300])
        # The new student still gains legitimate access when enrolled in this group.
        await prisma.studentprofile.update(where={'userId': self.teacher.id}, data={'groupId': self.group.id})
        for path in paths:
            self.assertEqual((await self.client.get(path, headers=self.headers(self.teacher))).status_code, 200)

    async def test_group_teacher_relation_does_not_grant_student_staff_access(self):
        await self.check_demotion(self.admin)

    async def test_former_lecture_author_does_not_keep_staff_access(self):
        await self.check_demotion(self.teacher)
