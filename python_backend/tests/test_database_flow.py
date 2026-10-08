"""Opt-in integration test. Creates two temporary users and deletes only their data.

RUN_DB_TESTS=1 PYTHONPATH=python_backend .venv/bin/python -m unittest discover -s python_backend/tests
AI responses are deterministic fixtures. No provider request or camera access.
"""
import asyncio
import logging
import os
import unittest
import uuid
from unittest.mock import AsyncMock, patch

import httpx
from app.main import app
from app.db.database import prisma
from app.schemas.companion import DeckOutput, QuizOutput
from app.services.gemini_service import gemini_service


@unittest.skipUnless(os.environ.get('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1 for database integration')
class DatabaseFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_learning_flow_ownership_and_atomic_answers(self):
        logging.getLogger('httpx').setLevel(logging.WARNING)
        users=[]
        await prisma.connect()
        try:
            transport=httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport,base_url='http://test') as client:
                self.assertIn((await client.get('/api/v1/companion/dashboard')).status_code,(401,403))
                credentials=[]
                for _ in range(2):
                    body={'email':f'aituto-test-{uuid.uuid4().hex}@example.com','password':'Testing-learning-123!','firstName':'Test','lastName':'Temporary'}
                    registered=await client.post('/api/v1/auth/register',json=body)
                    self.assertEqual(registered.status_code,200,registered.text[:500])
                    data=registered.json()['data'];users.append(data['user']['id'])
                    credentials.append({'Authorization':'Bearer '+data['accessToken']})
                    self.assertIn('Path=/api/v1/auth',registered.headers.get('set-cookie',''))
                    refreshed=await client.post('/api/v1/auth/refresh')
                    self.assertEqual(refreshed.status_code,200,refreshed.text[:300])
                    self.assertNotEqual(data['accessToken'],refreshed.json()['data']['accessToken'])
                own,other=credentials
                denied=await client.post('/api/v1/auth/register',json={'email':f'test-{uuid.uuid4().hex}@example.com','password':'Testing-123!','firstName':'T','lastName':'T','role':'ADMIN'})
                self.assertEqual(denied.status_code,403)
                note=(await client.post('/api/v1/companion/notes',headers=own,json={'title':'A note','content':'Learning is practice'})).json()['data']
                self.assertEqual((await client.get('/api/v1/companion/notes/'+note['id'],headers=other)).status_code,404)
                changed=await client.put('/api/v1/companion/notes/'+note['id'],headers=own,json={'title':'Updated','content':'A better explanation'})
                self.assertEqual(changed.status_code,200,changed.text[:500])
                self.assertEqual((await client.get('/api/v1/companion/notes',headers=own)).json()['data'][0]['title'],'Updated')
                task=await client.post('/api/v1/companion/tasks',headers=own,json={'title':'Homework','kind':'homework','dueAt':'2026-12-01T12:00:00+05:00'})
                self.assertEqual(task.status_code,200,task.text[:500])
                task_id=task.json()['data']['id']
                with patch.object(gemini_service,'chat',new=AsyncMock(return_value='An explanation in Russian.')):
                    chat=await client.post('/api/v1/companion/chat',headers=own,json={'message':'Explain fractions','topic':'Fractions','subject':'Math','language':'ru'})
                    self.assertEqual(chat.status_code,200,chat.text[:500])
                    conversation=chat.json()['data']
                    self.assertEqual(len(conversation['messages']),2)
                    denied=await client.post('/api/v1/companion/chat',headers=other,json={'message':'Steal history','conversationId':conversation['id']})
                    self.assertEqual(denied.status_code,404)
                    follow=await client.post('/api/v1/companion/chat',headers=own,json={'message':'Simpler','conversationId':conversation['id']})
                    self.assertEqual(follow.status_code,200,follow.text[:500])
                    self.assertEqual(len(follow.json()['data']['messages']),4)
                deck=DeckOutput(title='Fractions',cards=[{'question':str(i),'answer':str(i)} for i in range(3)])
                with patch.object(gemini_service,'generate_json',new=AsyncMock(return_value=deck)):
                    generated=await client.post('/api/v1/companion/decks',headers=own,json={'source':'Fractions','count':3,'topic':'Fractions'})
                    self.assertEqual(generated.status_code,200,generated.text[:500])
                deck_id=generated.json()['data']['id']
                review=await client.post(f'/api/v1/companion/decks/{deck_id}/review',headers=own,json={'index':0,'known':True})
                self.assertEqual(review.status_code,200,review.text[:500])
                self.assertEqual(review.json()['data']['known'],[0])
                quiz=QuizOutput(title='Fractions quiz',questions=[
                    {'type':'multiple_choice','question':'Half of 8?','options':['4','6'],'answer':'4','explanation':'8 / 2 = 4','topic':'Halves'},
                    {'type':'true_false','question':'1/2 = 0.5','options':['True','False'],'answer':'True','explanation':'One half','topic':'Decimals'},
                    {'type':'short_answer','question':'Half of 10?','options':[],'answer':'5','explanation':'10 / 2 = 5','topic':'Halves'},
                ])
                with patch.object(gemini_service,'generate_json',new=AsyncMock(return_value=quiz)):
                    generated=await client.post('/api/v1/companion/quizzes',headers=own,json={'source':'Fractions','topic':'Fractions','count':3})
                    self.assertEqual(generated.status_code,200,generated.text[:500])
                quiz_id=generated.json()['data']['id'];answer_path=f'/api/v1/companion/quizzes/{quiz_id}/answer'
                self.assertNotIn('answer',generated.json()['data']['questions'][0])
                competing=await asyncio.gather(*[client.post(answer_path,headers=own,json={'index':0,'answer':'4'}) for _ in range(2)])
                self.assertEqual(sorted(r.status_code for r in competing),[200,409],[r.text[:500] for r in competing])
                saved=(await client.get(f'/api/v1/companion/quizzes/{quiz_id}',headers=own)).json()['data']
                self.assertEqual(len(saved['answers']),1)
                self.assertNotIn('answer',saved['questions'][1])
                for i,answer in [(1,'False'),(2,'5')]:
                    result=await client.post(answer_path,headers=own,json={'index':i,'answer':answer})
                    self.assertEqual(result.status_code,200,result.text[:500])
                self.assertEqual(result.json()['data']['percentage'],67)
                self.assertEqual(result.json()['data']['weakTopics'],['Decimals'])
                dashboard=await client.get('/api/v1/companion/dashboard',headers=own)
                self.assertEqual(dashboard.status_code,200,dashboard.text[:500])
                data=dashboard.json()['data']
                self.assertEqual(data['progress']['completedQuizzes'],1)
                self.assertEqual(data['progress']['quizAccuracy'],67)
                self.assertEqual(data['progress']['streak'],1)
                self.assertEqual(data['tasks'][0]['id'],task_id)
                self.assertEqual((await client.patch('/api/v1/companion/tasks/'+task_id,headers=own,json={'done':True})).status_code,200)
                self.assertEqual((await client.get('/api/v1/companion/dashboard',headers=own)).json()['data']['tasks'],[])
                self.assertEqual((await client.delete('/api/v1/companion/notes/'+note['id'],headers=other)).status_code,404)
                self.assertEqual((await client.delete('/api/v1/companion/notes/'+note['id'],headers=own)).status_code,200)
                self.assertEqual((await client.get('/api/v1/companion/notes',headers=own)).json()['data'],[])
        finally:
            for user_id in users:
                await prisma.user.delete(where={'id':user_id})
            await prisma.disconnect()
