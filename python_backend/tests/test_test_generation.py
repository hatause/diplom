"""Generated tests must be playable and preserve topic-specific analytics."""
import asyncio
import os
import unittest
import uuid
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from pydantic import ValidationError
from app.db.database import prisma
from app.schemas.tests import GeneratedQuestion, GeneratedTest, GenerateTestRequest
from app.services.gemini_service import gemini_service
from app.services.test import test_service


def question(**changes):
    return {'id':'q1','type':'single_choice','question':'2+2?', 'options':['4','5'],
            'correctAnswer':'4','explanation':'Addition','topic':'Addition','difficulty':'easy',**changes}


class GeneratedQuestionTests(unittest.TestCase):
    def test_rejects_unplayable_answers(self):
        for changes in ({'options':[]}, {'options':['4','4']}, {'correctAnswer':'A'},
                        {'correctAnswer':['4','5']}, {'question':' '},
                        {'type':'multiple_choice','correctAnswer':['4','4']},
                        {'type':'true_false','correctAnswer':'Да'},
                        {'type':'short_answer','correctAnswer':[]}):
            with self.assertRaises(ValidationError, msg=str(changes)):
                GeneratedQuestion(**question(**changes))
        self.assertEqual(GeneratedQuestion(**question(type='multiple_choice')).correctAnswer,['4'])
        self.assertEqual(GeneratedQuestion(**question(type='true_false',correctAnswer='TRUE')).correctAnswer,'true')
        self.assertEqual(GeneratedQuestion(**question(type='short_answer')).correctAnswer,'4')


@unittest.skipUnless(os.getenv('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1')
class TestGenerationDatabaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_missing_subject_bad_provider_result_and_mixed_topics(self):
        await prisma.connect()
        prefix='generation-test-'+uuid.uuid4().hex
        user=subject=None
        try:
            user=await prisma.user.create(data={'email':prefix+'@example.com','firstName':'Test','lastName':'User','passwordHash':'unused'})
            subject=await prisma.subject.create(data={'code':prefix,'name':'Math'})
            params=GenerateTestRequest(subjectId=subject.id,topic=' ',difficulty='easy',questionCount=5,questionTypes=['single_choice'])
            generated=GeneratedTest(title='Mixed test',subject='Math',difficulty='easy',questions=[GeneratedQuestion(**question(id=f'q{i}',topic='Addition' if i%2 else 'Numbers')) for i in range(5)])
            with patch.object(gemini_service,'generate_json',new=AsyncMock(return_value=generated)) as provider:
                with self.assertRaises(HTTPException) as error:
                    await test_service.generate_test(user.id,params.model_copy(update={'subjectId':uuid.uuid4()}))
                self.assertEqual(error.exception.status_code,404)
                provider.assert_not_awaited()
                provider.return_value=generated.model_copy(update={'questions':generated.questions[:1]})
                with self.assertRaises(HTTPException) as error:
                    await test_service.generate_test(user.id,params)
                self.assertEqual(error.exception.status_code,502)
                self.assertEqual(await prisma.test.count(where={'subjectId':subject.id}),0)
                self.assertEqual(await prisma.topic.count(where={'subjectId':subject.id}),0)
                provider.return_value=generated.model_copy(update={'questions':[GeneratedQuestion(**question(type='short_answer'))]*5})
                with self.assertRaises(HTTPException) as error:
                    await test_service.generate_test(user.id,params)
                self.assertEqual(error.exception.status_code,502)
                provider.return_value=generated
                created=await asyncio.gather(test_service.generate_test(user.id,params),test_service.generate_test(user.id,params))
                self.assertEqual(await prisma.topic.count(where={'subjectId':subject.id}),2)
                test=await prisma.test.find_unique(where={'id':created[0]['id']},include={'questions':{'include':{'topic':True}}})
                self.assertEqual({q.topic.name for q in test.questions},{'Addition','Numbers'})
                self.assertTrue(all('correctAnswer' not in q for q in created[0]['questions']))
        finally:
            if user: await prisma.user.delete(where={'id':user.id})
            if subject:
                await prisma.test.delete_many(where={'subjectId':subject.id})
                await prisma.subject.delete(where={'id':subject.id})
            await prisma.disconnect()
