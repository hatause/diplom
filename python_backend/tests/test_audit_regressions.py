"""Additional cross-role regressions; use an isolated schedule_test_ database."""
import os
import uuid
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from prisma import Json
from app.db.database import prisma
from app.main import app
from app.core.config import UPLOAD_DIR
from app.services.auth import create_access_token
from app.services.messages import messages_service
from app.core.utils import parse_db_json


@unittest.skipUnless(os.getenv('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1')
class AuditRegressions(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.assertIn('/schedule_test_', os.environ.get('DATABASE_URL', ''))
        await prisma.connect()
        self.prefix = 'audit-' + uuid.uuid4().hex
        self.users = []; self.groups = []; self.subjects = []; self.files = []
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url='http://test')
        self.admin = await self.user('ADMIN')
        self.student = await self.user()

    async def user(self, role='STUDENT'):
        user = await prisma.user.create(data={'email':self.prefix+str(len(self.users))+'@example.com', 'passwordHash':'unused', 'firstName':'Audit', 'lastName':role, 'role':role})
        self.users.append(user.id)
        return user

    def headers(self, user):
        return {'Authorization':'Bearer '+create_access_token({'userId':user.id,'role':user.role})}

    async def subject(self, teacher=None):
        subject = await prisma.subject.create(data={'name':self.prefix,'code':self.prefix+str(len(self.subjects)), 'teacherId':teacher.id if teacher else None})
        self.subjects.append(subject.id)
        return subject

    async def group(self):
        group = await prisma.group.create(data={'name':self.prefix+str(len(self.groups)), 'code':self.prefix+'-code-'+str(len(self.groups))})
        self.groups.append(group.id)
        return group

    async def asyncTearDown(self):
        await self.client.aclose()
        for sid in self.subjects:
            await prisma.test.delete_many(where={'subjectId':sid})
            await prisma.subject.delete(where={'id':sid})
        for gid in self.groups: await prisma.group.delete(where={'id':gid})
        await prisma.auditlog.delete_many(where={'userId':{'in':self.users}})
        await prisma.user.delete_many(where={'id':{'in':self.users}})
        for path in self.files: path.unlink(missing_ok=True)
        await prisma.disconnect()

    async def test_group_duplicate_names_return_conflict_for_both_roles(self):
        teacher = await self.user('TEACHER'); group = await self.group()
        for route, user in [('/admin/groups',self.admin),('/groups',teacher)]:
            response = await self.client.post('/api/v1'+route, headers=self.headers(user), json={'name':group.name,'code':self.prefix+'-new'})
            self.assertEqual(response.status_code,409,response.text)

    async def test_subject_totals_include_more_than_ten_tests(self):
        subject = await self.subject()
        test = await prisma.test.create(data={'subjectId':subject.id,'title':'Audit','questionCount':1,'questionTypes':['short_answer'],'difficulty':'easy'})
        for i in range(11):
            await prisma.attempt.create(data={'userId':self.student.id,'testId':test.id,'status':'COMPLETED','percentage':100 if i==0 else 0,'completedAt':datetime.now(timezone.utc)})
        response = await self.client.get('/api/v1/subjects',headers=self.headers(self.student))
        record = next(s for s in response.json()['data'] if s['id']==subject.id)
        self.assertEqual(record['attemptsCount'],11)
        self.assertEqual(record['avgScore'],9)

    async def test_review_excludes_deactivated_subjects(self):
        subject=await self.subject()
        topic=await prisma.topic.create(data={'subjectId':subject.id,'name':'Review'})
        await prisma.topicprogress.create(data={'userId':self.student.id,'topicId':topic.id,'masteryScore':20})
        await prisma.subject.update(where={'id':subject.id},data={'isActive':False})
        response=await self.client.get('/api/v1/review',headers=self.headers(self.student))
        self.assertNotIn(topic.id,[t['topicId'] for t in response.json()['data']])

    async def test_teacher_cannot_republish_another_groups_private_attachment(self):
        teacher=await self.user('TEACHER'); group=await self.group(); subject=await self.subject(teacher)
        path=UPLOAD_DIR/(self.prefix+'.txt');path.write_text('Private material');self.files.append(path)
        url='/api/v1/uploads/'+path.name
        await prisma.lecture.create(data={'title':'Private','content':'','subjectId':subject.id,'groupId':group.id,'teacherId':self.admin.id,'fileUrl':url})
        for alias in [url, url+'?download=1', url.replace('/audit-', '/%61udit-')]:
            response=await self.client.post('/api/v1/lectures',headers=self.headers(teacher),json={'title':'Copy','content':'','subjectId':subject.id,'fileUrl':alias})
            self.assertEqual(response.status_code,403,response.text)
        allowed=await self.client.post('/api/v1/lectures',headers=self.headers(self.admin),json={'title':'Authorized copy','content':'','subjectId':subject.id,'fileUrl':url})
        self.assertEqual(allowed.status_code,200,allowed.text)

    async def test_new_message_arriving_during_read_stays_unread(self):
        teacher=await self.user('TEACHER')
        first=await prisma.message.create(data={'senderId':teacher.id,'receiverId':self.student.id,'content':'First'})
        message_actions=prisma.message
        late=[]
        async def racing_read(**kwargs):
            rows=await message_actions.find_many(**kwargs)
            late.append(await message_actions.create(data={'senderId':teacher.id,'receiverId':self.student.id,'content':'Arrived after snapshot'}))
            return rows
        proxy=SimpleNamespace(message=SimpleNamespace(find_many=racing_read,update_many=message_actions.update_many))
        with patch('app.services.messages.prisma',proxy):
            shown=await messages_service.get_messages(self.student.id,teacher.id)
        self.assertEqual([r['id'] for r in shown],[first.id])
        self.assertTrue((await message_actions.find_unique(where={'id':first.id})).isRead)
        self.assertFalse((await message_actions.find_unique(where={'id':late[0].id})).isRead)

    async def test_invalid_saved_progress_is_rejected_without_overwriting(self):
        subject=await self.subject()
        test=await prisma.test.create(data={'subjectId':subject.id,'title':'Audit','questionCount':1,'questionTypes':['short_answer'],'difficulty':'easy','questions':{'create':[{'question':'2+2','type':'short_answer','correctAnswer':Json('4'),'difficulty':'easy','orderIndex':0}]}},include={'questions':True})
        attempt=await prisma.attempt.create(data={'userId':self.student.id,'testId':test.id})
        url='/api/v1/tests/'+attempt.id+'/progress'
        valid={'answers':{test.questions[0].id:'4'},'elapsed':12,'currentIdx':0,'timeSpent':{test.questions[0].id:12}}
        self.assertEqual((await self.client.put(url,headers=self.headers(self.student),json=valid)).status_code,200)
        for body in [[], {'elapsed':-1}, {'answers':{'not-a-question':'4'}}, {'currentIdx':1}, {'timeSpent':{test.questions[0].id:-1}}]:
            response=await self.client.put(url,headers=self.headers(self.student),json=body)
            self.assertIn(response.status_code,(400,422),response.text)
        self.assertEqual(parse_db_json((await prisma.attempt.find_unique(where={'id':attempt.id})).savedProgress),valid)
