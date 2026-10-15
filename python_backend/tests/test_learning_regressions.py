"""Grading and calendar regressions from the repeated functional audit."""
import os
import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
from prisma import Json

from app.core.config import settings
from app.db.database import prisma
from app.main import app
from app.services.analytics import analytics_service
from app.services.auth import create_access_token
from app.services.companion import companion_service


class AnalyticsCalendarTests(unittest.IsolatedAsyncioTestCase):
    async def test_graph_and_activity_use_the_school_calendar_date(self):
        # A lesson completed at 00:30 in Almaty still has the previous UTC date.
        completed = datetime(2026, 10, 12, 19, 30, tzinfo=timezone.utc)
        db = SimpleNamespace(
            attempt=SimpleNamespace(
                count=AsyncMock(return_value=1),
                find_many=AsyncMock(return_value=[SimpleNamespace(percentage=80, completedAt=completed)]),
            ),
            topicprogress=SimpleNamespace(find_many=AsyncMock(return_value=[])),
            studysession=SimpleNamespace(find_many=AsyncMock(return_value=[
                SimpleNamespace(createdAt=completed, activityType='test', duration=60, xpEarned=50),
            ])),
            studentprofile=SimpleNamespace(find_unique=AsyncMock(return_value=None)),
        )
        with patch('app.services.analytics.prisma', db), patch.object(settings, 'SCHOOL_TIMEZONE', 'Asia/Almaty'), patch('app.services.analytics.datetime', wraps=datetime) as clock:
            clock.now.return_value = datetime(2026, 10, 13, 9, tzinfo=timezone.utc)
            result = await analytics_service.get_overall_analytics('student')
        self.assertEqual(result['progressOverTime'][0]['date'], '2026-10-13')
        self.assertEqual(result['studyActivity'][0]['date'], '2026-10-13')


@unittest.skipUnless(os.getenv('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1')
class ExactChoiceGradingTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.assertIn('/schedule_test_', os.environ.get('DATABASE_URL', ''))
        await prisma.connect()
        prefix = 'grading-' + uuid.uuid4().hex
        self.user = await prisma.user.create(data={
            'email': prefix + '@example.com', 'passwordHash': 'unused',
            'firstName': 'Grading', 'lastName': 'Regression',
            'studentProfile': {'create': {}},
        })
        self.subject = await prisma.subject.create(data={'name': 'Grading', 'code': prefix})
        self.achievement_ids = []
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url='http://test',
            headers={'Authorization': 'Bearer ' + create_access_token({'userId': self.user.id, 'role': 'STUDENT'})},
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        await prisma.user.delete(where={'id': self.user.id})
        for achievement_id in self.achievement_ids:
            await prisma.achievement.delete(where={'id': achievement_id})
        await prisma.test.delete_many(where={'subjectId': self.subject.id})
        await prisma.subject.delete(where={'id': self.subject.id})
        await prisma.disconnect()

    async def test_test_grading_distinguishes_choice_case_and_keeps_free_text_flexible(self):
        definitions = [
            ('single_choice', ['Co', 'CO'], 'Co', 'CO'),
            ('multiple_choice', ['x', 'X', 'y'], ['x', 'y'], ['X', 'y']),
            ('multiple_choice', ['x', 'X', 'y'], ['x', 'y'], ['y', 'x']),
            ('short_answer', [], 'Berlin', '  BERLIN  '),
            ('true_false', ['true', 'false'], 'true', 'TRUE'),
        ]
        test = await prisma.test.create(data={
            'subjectId': self.subject.id, 'title': 'Case-sensitive choices', 'difficulty': 'easy',
            'questionCount': len(definitions), 'questionTypes': list({q[0] for q in definitions}),
            'questions': {'create': [
                {'question': f'Question {i}', 'type': kind, 'options': Json(options),
                 'correctAnswer': Json(correct), 'difficulty': 'easy', 'orderIndex': i}
                for i, (kind, options, correct, _) in enumerate(definitions)
            ]},
        }, include={'questions': {'orderBy': {'orderIndex': 'asc'}}})
        started = await self.client.post(f'/api/v1/tests/{test.id}/start')
        self.assertEqual(started.status_code, 200, started.text)
        attempt_id = started.json()['data']['id']
        response = await self.client.post(f'/api/v1/tests/{attempt_id}/submit', json={
            'answers': [{'questionId': question.id, 'userAnswer': definition[3]} for question, definition in zip(test.questions, definitions)],
            'totalTime': 60,
        })
        self.assertEqual(response.status_code, 200, response.text)
        result = (await self.client.get(f'/api/v1/attempts/{attempt_id}/result')).json()['data']
        self.assertEqual((result['correctCount'], result['wrongCount'], result['percentage']), (3, 2, 60))

    async def test_companion_quiz_keeps_case_and_punctuation_in_choices(self):
        questions = [
            {'type': 'multiple_choice', 'question': 'Symbol for cobalt?', 'options': ['Co', 'CO'], 'answer': 'Co'},
            {'type': 'multiple_choice', 'question': 'Choose the exclamation.', 'options': ['Stop!', 'Stop?'], 'answer': 'Stop!'},
            {'type': 'short_answer', 'question': 'Capital of Germany?', 'options': [], 'answer': 'Berlin'},
        ]
        quiz = await companion_service.create(self.user.id, 'QUIZ', 'Exact choices', {
            'title': 'Exact choices', 'context': {'subject': 'School', 'topic': 'Exact choices'},
            'questions': [{**q, 'explanation': 'Explanation', 'topic': 'Exact choices'} for q in questions],
            'answers': [], 'completed': False,
        })
        for index, answer in enumerate(['CO', 'Stop?', '  BERLIN.  ']):
            response = await self.client.post(f'/api/v1/companion/quizzes/{quiz["id"]}/answer', json={'index': index, 'answer': answer})
            self.assertEqual(response.status_code, 200, response.text)
        result = response.json()['data']
        self.assertTrue(result['completed'])
        self.assertEqual([answer['correct'] for answer in result['answers']], [False, False, True])
        self.assertEqual(result['score'], 1)

    async def test_question_achievement_does_not_count_skipped_questions(self):
        achievement = await prisma.achievement.create(data={
            'code': 'answered-' + uuid.uuid4().hex, 'name': 'Three answers',
            'description': 'Answer three questions', 'iconName': 'HelpCircle',
            'condition': Json({'type': 'question_count', 'value': 3}), 'xpReward': 15,
        })
        self.achievement_ids.append(achievement.id)
        test = await prisma.test.create(data={
            'subjectId': self.subject.id, 'title': 'Skipped questions', 'difficulty': 'easy',
            'questionCount': 3, 'questionTypes': ['short_answer'],
            'questions': {'create': [
                {'question': f'2+2 (question {i})', 'type': 'short_answer',
                 'correctAnswer': Json('4'), 'difficulty': 'easy', 'orderIndex': i}
                for i in range(3)
            ]},
        }, include={'questions': {'orderBy': {'orderIndex': 'asc'}}})
        started = (await self.client.post(f'/api/v1/tests/{test.id}/start')).json()['data']['id']
        submitted = await self.client.post(f'/api/v1/tests/{started}/submit', json={
            'answers': [
                {'questionId': test.questions[0].id, 'userAnswer': '4'},
                {'questionId': test.questions[1].id, 'userAnswer': '5'},
            ], 'totalTime': 60,
        })
        self.assertEqual(submitted.status_code, 200, submitted.text)
        # Correct and incorrect responses count; the omitted third response does not.
        self.assertEqual(await prisma.userachievement.count(where={'userId': self.user.id, 'achievementId': achievement.id}), 0)
        started = (await self.client.post(f'/api/v1/tests/{test.id}/start')).json()['data']['id']
        submitted = await self.client.post(f'/api/v1/tests/{started}/submit', json={
            'answers': [{'questionId': test.questions[0].id, 'userAnswer': '4'}], 'totalTime': 30,
        })
        self.assertEqual(submitted.status_code, 200, submitted.text)
        self.assertEqual(await prisma.userachievement.count(where={'userId': self.user.id, 'achievementId': achievement.id}), 1)
