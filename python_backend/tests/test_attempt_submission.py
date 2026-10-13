"""Resume, grading, rollback and concurrent-submission regressions."""
import asyncio
import os
import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
from pydantic import ValidationError
from prisma import Json

from app.db.database import prisma
from app.main import app
from app.schemas.tests import SubmitTestRequest
from app.services.auth import create_access_token
from app.services.test import test_service
from app.core.config import settings


class SubmissionValidationTests(unittest.TestCase):
    def test_rejects_duplicate_questions_and_negative_time(self):
        question_id = str(uuid.uuid4())
        for payload in (
            {'answers': [{'questionId': question_id}] * 2, 'totalTime': 10},
            {'answers': [], 'totalTime': -1},
            {'answers': [{'questionId': question_id, 'timeSpent': -1}], 'totalTime': 0},
        ):
            with self.assertRaises(ValidationError):
                SubmitTestRequest(**payload)


class GamificationTimezoneTests(unittest.IsolatedAsyncioTestCase):
    async def test_streak_uses_school_midnight_not_utc_midnight(self):
        # 23:30 then 00:30 in Almaty: two school days but the same UTC date.
        previous = datetime(2026, 10, 12, 18, 30, tzinfo=timezone.utc)
        now = datetime(2026, 10, 12, 19, 30, tzinfo=timezone.utc)
        profile = SimpleNamespace(xp=100, streak=2, bestStreak=2, lastStudyDate=previous)
        db = SimpleNamespace(studentprofile=SimpleNamespace(find_unique=AsyncMock(return_value=profile), update=AsyncMock()))
        with patch.object(settings, 'SCHOOL_TIMEZONE', 'Asia/Almaty'), patch('app.services.test.datetime', wraps=datetime) as clock:
            clock.now.return_value = now
            await test_service._update_gamification('student', 0, 0, db)
            self.assertEqual(db.studentprofile.update.call_args.kwargs['data']['streak'], 3)
            # Crossing UTC midnight later in the same school day adds no streak.
            profile.lastStudyDate = now
            profile.streak = 3
            clock.now.return_value = datetime(2026, 10, 13, 1, 0, tzinfo=timezone.utc)
            await test_service._update_gamification('student', 0, 0, db)
            self.assertEqual(db.studentprofile.update.call_args.kwargs['data']['streak'], 3)


@unittest.skipUnless(os.getenv('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1')
class AttemptSubmissionTests(unittest.IsolatedAsyncioTestCase):
    async def test_resume_grading_atomic_submission_and_rollback(self):
        await prisma.connect()
        prefix = 'attempt-test-' + uuid.uuid4().hex
        user = other = subject = None
        try:
            user = await prisma.user.create(data={'email':prefix+'@example.com', 'firstName':'Test', 'lastName':'Student', 'passwordHash':'unused', 'studentProfile':{'create':{}}})
            other = await prisma.user.create(data={'email':prefix+'-other@example.com', 'firstName':'Other', 'lastName':'Student', 'passwordHash':'unused'})
            subject = await prisma.subject.create(data={'name':'Math', 'code':prefix})
            topic = await prisma.topic.create(data={'name':'Addition', 'subjectId':subject.id})
            test = await prisma.test.create(data={
                'title':'Addition', 'subjectId':subject.id, 'difficulty':'easy', 'questionCount':2, 'questionTypes':['single_choice'],
                'questions':{'create':[{'type':'single_choice','question':f'Question {i}', 'options':Json(['4','5']),
                                      'correctAnswer':Json('4'), 'explanation':'Addition', 'difficulty':'easy', 'orderIndex':i, 'topicId':topic.id} for i in range(2)]},
            }, include={'questions':{'orderBy':{'orderIndex':'asc'}}})
            headers = {'Authorization':'Bearer '+create_access_token({'userId':user.id,'role':'STUDENT'})}
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test',headers=headers) as client:
                starts = await asyncio.gather(*(client.post('/api/v1/tests/'+test.id+'/start') for _ in range(2)))
                self.assertTrue(all(r.status_code == 200 for r in starts))
                self.assertEqual(starts[0].json()['data']['id'], starts[1].json()['data']['id'])
                started = starts[0]
                self.assertEqual(started.status_code,200,started.text)
                attempt_id = started.json()['data']['id']
                progress = {'answers':{test.questions[0].id:'4'},'currentIdx':1,'elapsed':35,'timeSpent':{test.questions[0].id:35}}
                self.assertEqual((await client.put('/api/v1/tests/'+attempt_id+'/progress',json=progress)).status_code,200)
                detail = (await client.get('/api/v1/attempts/'+attempt_id)).json()['data']
                self.assertEqual(detail['savedProgress'],progress)
                self.assertNotIn('correctAnswer',detail['test']['questions'][0])
                for query in ('limit=0','page=0','status=INVALID'):
                    self.assertEqual((await client.get('/api/v1/attempts?'+query)).status_code,422)
                url = '/api/v1/tests/'+attempt_id+'/submit'
                unknown = await client.post(url,json={'answers':[{'questionId':str(uuid.uuid4()),'userAnswer':'4'}],'totalTime':40})
                self.assertEqual(unknown.status_code,400)
                forbidden = await client.post(url,headers={'Authorization':'Bearer '+create_access_token({'userId':other.id,'role':'STUDENT'})},json={'answers':[],'totalTime':0})
                self.assertEqual(forbidden.status_code,404)
                payload = {'answers':[{'questionId':test.questions[0].id,'userAnswer':'4','timeSpent':35}], 'totalTime':40}
                duplicates = await client.post(url,json={**payload,'answers':payload['answers']*2})
                self.assertEqual(duplicates.status_code,422)
                results = await asyncio.gather(*(client.post(url,json=payload) for _ in range(2)))
                self.assertEqual(sorted(r.status_code for r in results),[200,400],[r.text for r in results])
                self.assertEqual((await client.put('/api/v1/tests/'+attempt_id+'/progress',json=progress)).status_code,400)
                result = (await client.get('/api/v1/attempts/'+attempt_id+'/result')).json()['data']
                self.assertEqual((result['correctCount'],result['wrongCount'],result['skippedCount'],result['percentage']),(1,0,1,50))
                self.assertEqual(len(result['answers']),2)
                profile = await prisma.studentprofile.find_unique(where={'userId':user.id})
                self.assertGreaterEqual(profile.xp,60)
                xp_before = profile.xp
                self.assertEqual(await prisma.studysession.count(where={'userId':user.id}),1)
                topic_progress = await prisma.topicprogress.find_first(where={'userId':user.id,'topicId':topic.id})
                self.assertEqual(topic_progress.totalAttempts,2)
                # A failure after writing answers and progress must roll everything back.
                second = await prisma.attempt.create(data={'testId':test.id,'userId':user.id})
                with patch.object(test_service,'_update_gamification',new=AsyncMock(side_effect=RuntimeError('Test rollback'))):
                    with self.assertRaises(RuntimeError):
                        await test_service.submit_attempt(second.id,user.id,SubmitTestRequest(**payload))
                stored = await prisma.attempt.find_unique(where={'id':second.id})
                self.assertEqual(stored.status,'IN_PROGRESS')
                self.assertEqual(await prisma.answer.count(where={'attemptId':second.id}),0)
                self.assertEqual((await prisma.topicprogress.find_first(where={'userId':user.id,'topicId':topic.id})).totalAttempts,2)
                self.assertEqual((await prisma.studentprofile.find_unique(where={'userId':user.id})).xp,xp_before)
                await prisma.attempt.update(where={'id':second.id},data={'status':'ABANDONED'})
                rejected=await client.post('/api/v1/tests/'+second.id+'/submit',json=payload)
                self.assertEqual(rejected.status_code,400)
        finally:
            for item in (user,other):
                if item: await prisma.user.delete(where={'id':item.id})
            if subject:
                await prisma.test.delete_many(where={'subjectId':subject.id})
                await prisma.subject.delete(where={'id':subject.id})
            await prisma.disconnect()
