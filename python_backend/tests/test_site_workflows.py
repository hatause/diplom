"""Cross-role site regression checks. Only disposable fixture records are removed."""
import json
import asyncio
import os
import unittest
import uuid
from unittest.mock import AsyncMock, patch

import httpx
from prisma import Json

from app.core.config import UPLOAD_DIR
from app.db.database import prisma
from app.main import app
from app.services.auth import create_access_token
from app.services.gemini_service import gemini_service


@unittest.skipUnless(os.getenv('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1')
class SiteWorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await prisma.connect()
        self.prefix='site-test-'+uuid.uuid4().hex
        self.users=[];self.groups=[];self.subjects=[];self.files=[];self.achievements=[]
        self.admin=await prisma.user.create(data={'email':self.prefix+'@example.com','firstName':'Admin','lastName':'Fixture','passwordHash':'unused','role':'ADMIN'})
        self.users.append(self.admin.id)
        self.client=httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test')

    def headers(self,user_id,role='STUDENT'):
        return {'Authorization':'Bearer '+create_access_token({'userId':user_id,'role':role})}

    async def call(self,method,path,user=None,expected=200,**kwargs):
        r=await self.client.request(method,'/api/v1'+path,headers=self.headers(user or self.admin.id,'ADMIN'),**kwargs)
        self.assertEqual(r.status_code,expected,f'{method} {path}: {r.text[:600]}')
        return r.json().get('data')

    async def make_user(self,role='STUDENT',group=None):
        body={'email':self.prefix+'-'+uuid.uuid4().hex[:6]+'@example.com','firstName':'Test','lastName':role,'password':'Testing-123!','role':role,'groupId':group}
        data=await self.call('POST','/admin/users',json=body)
        self.users.append(data['id'])
        return data,body

    async def asyncTearDown(self):
        await self.client.aclose()
        for sid in self.subjects:
            await prisma.lecture.delete_many(where={'subjectId':sid})
            await prisma.test.delete_many(where={'subjectId':sid})
            await prisma.subject.delete(where={'id':sid})
        await prisma.auditlog.delete_many(where={'userId':{'in':self.users}})
        for uid in self.users: await prisma.user.delete(where={'id':uid})
        for gid in self.groups: await prisma.group.delete(where={'id':gid})
        for aid in self.achievements: await prisma.achievement.delete(where={'id':aid})
        for path in self.files:path.unlink(missing_ok=True)
        await prisma.disconnect()

    async def test_admin_accounts_groups_profile_and_messages(self):
        group=await self.call('POST','/admin/groups',json={'name':'Group','code':self.prefix});self.groups.append(group['id'])
        await self.call('POST','/admin/groups',expected=409,json={'name':'Duplicate','code':self.prefix})
        await self.call('POST','/admin/groups',expected=422,json={'name':' ','code':' '})
        teacher,_=await self.make_user('TEACHER');other,_=await self.make_user('TEACHER')
        student,credentials=await self.make_user()
        self.assertIsNotNone(await prisma.studentprofile.find_unique(where={'userId':student['id']}))
        await self.call('POST','/admin/users',expected=409,json=credentials)
        await self.call('POST','/admin/users',expected=422,json={**credentials,'firstName':' '})
        await self.call('PUT','/admin/users/'+student['id'],json={'firstName':'Updated','password':'Testing-new-123!'})
        self.assertEqual(await prisma.auditlog.count(where={'entityId':student['id']}),1)
        await self.call('DELETE','/admin/users/'+self.admin.id,expected=400)
        await self.call('PUT','/admin/users/missing',expected=404,json={'firstName':'Missing'})
        await self.call('POST',f"/admin/groups/{group['id']}/teachers",json={'teacherId':teacher['id']})
        await self.call('POST',f"/admin/groups/{group['id']}/teachers",expected=400,json={'teacherId':student['id']})
        await self.call('POST',f"/groups/{group['id']}/students",user=other['id'],expected=403,json={'studentId':student['id']})
        await self.call('POST',f"/groups/{group['id']}/students",user=teacher['id'],json={'studentId':student['id']})
        students=await self.call('GET','/teacher/students',user=teacher['id'])
        self.assertIn(student['id'],[s['id'] for s in students])
        dashboard=await self.call('GET','/teacher/dashboard',user=teacher['id'])
        self.assertEqual(dashboard['totalStudents'],1)
        self.assertEqual(dashboard['subjects'],[])
        await self.call('GET','/teacher/students/'+student['id'],user=other['id'],expected=403)
        login=await self.client.post('/api/v1/auth/login',json={'email':credentials['email'],'password':'Testing-new-123!'})
        self.assertEqual(login.status_code,200,login.text)
        self.assertEqual(login.json()['data']['user']['studentProfile']['group']['id'],group['id'])
        profile=await self.call('PUT','/auth/profile',user=student['id'],json={'firstName':'Student'})
        self.assertEqual(profile['studentProfile']['group']['id'],group['id'])
        await self.call('PUT','/auth/profile',user=student['id'],expected=422,json={'firstName':' '})
        await self.call('POST','/messages',user=student['id'],expected=422,json={'receiverId':teacher['id'],'content':' '})
        await self.call('POST','/messages',user=student['id'],expected=404,json={'receiverId':'missing','content':'Hello'})
        await self.call('POST','/messages',user=student['id'],json={'receiverId':teacher['id'],'content':'Fixture message'})
        messages=await self.call('GET','/messages/'+student['id'],user=teacher['id'])
        self.assertEqual(messages[0]['content'],'Fixture message')
        self.assertTrue(messages[0]['isRead'])
        self.assertTrue((await prisma.message.find_unique(where={'id':messages[0]['id']})).isRead)
        for path in ['/subjects','/analytics','/analytics/subjects','/analytics/topics','/review','/achievements','/schedule','/schedule/today','/schedule/week','/companion/dashboard','/messages/contacts','/lectures/public']:
            await self.call('GET',path,user=student['id'])
        for path in ['/admin/users','/teacher/students','/groups/my']:
            await self.call('GET',path,user=student['id'],expected=403)

    async def test_private_lectures_downloads_and_subject_ownership(self):
        group=await self.call('POST','/admin/groups',json={'name':'Private','code':self.prefix});self.groups.append(group['id'])
        student,_=await self.make_user(group=group['id']);outsider,_=await self.make_user();teacher,_=await self.make_user('TEACHER')
        subject=await self.call('POST','/admin/subjects',json={'name':'Math','code':self.prefix,'teacherId':teacher['id']});self.subjects.append(subject['id'])
        upload=await self.client.post('/api/v1/upload',headers=self.headers(self.admin.id),files={'file':('fixture.txt',b'Private lecture text','text/plain')})
        file_data=upload.json()['data'];self.files.append(UPLOAD_DIR/file_data['fileUrl'].rsplit('/',1)[1])
        lecture=await self.call('POST','/lectures',json={'title':'Private lesson','groupId':group['id'],'subjectId':subject['id'],**file_data})
        for action in ['', '/explain','/generate-test','/extract-text']:
            await self.call('GET' if not action else 'POST','/lectures/'+lecture['id']+action,user=outsider['id'],expected=403)
        await self.call('GET','/lectures/'+lecture['id'],user=student['id'])
        await self.call('POST','/lectures/'+lecture['id']+'/extract-text',user=student['id'])
        self.assertEqual((await self.client.get(file_data['fileUrl'],headers=self.headers(outsider['id']))).status_code,403)
        downloaded=await self.client.get(file_data['fileUrl'],headers=self.headers(student['id']))
        self.assertEqual(downloaded.content,b'Private lecture text')
        anonymous=await self.client.get(file_data['fileUrl'])
        self.assertIn(anonymous.status_code,(401,403))
        await self.call('DELETE','/groups/'+group['id'],expected=409)
        self.assertEqual((await prisma.studentprofile.find_unique(where={'userId':student['id']})).groupId,group['id'])

    async def test_concurrent_teachers_cannot_take_same_student(self):
        student,_=await self.make_user()
        requests=[]
        for i in range(2):
            teacher,_=await self.make_user('TEACHER')
            group=await self.call('POST','/admin/groups',json={'name':self.prefix+' Group '+str(i),'code':self.prefix+str(i)})
            self.groups.append(group['id'])
            await self.call('POST',f"/admin/groups/{group['id']}/teachers",json={'teacherId':teacher['id']})
            requests.append((group['id'], teacher['id']))
        results=await asyncio.gather(*(self.client.post('/api/v1/groups/'+gid+'/students',headers=self.headers(tid),json={'studentId':student['id']}) for gid,tid in requests))
        self.assertEqual(sorted(r.status_code for r in results),[200,409])

    async def test_ai_analysis_persistence_and_learning_sessions(self):
        student,_=await self.make_user()
        achievement=await prisma.achievement.create(data={'code':self.prefix,'name':'First test','description':'Fixture','iconName':'star','xpReward':37,'condition':Json({'type':'test_count','value':1})})
        self.achievements.append(achievement.id)
        subject=await self.call('POST','/admin/subjects',json={'name':'Math','code':self.prefix});self.subjects.append(subject['id'])
        test=await prisma.test.create(data={'title':'Fixture','subjectId':subject['id'],'difficulty':'easy','questionCount':1,'questionTypes':['short_answer'], 'questions':{'create':[{'type':'short_answer','question':'2+2','correctAnswer':Json('4'),'difficulty':'easy','orderIndex':0}]}},include={'questions':True})
        attempt=await self.call('POST','/tests/'+test.id+'/start',user=student['id'])
        await self.call('POST','/ai/analyze-result',user=student['id'],expected=400,json={'attemptId':attempt['id']})
        await self.call('POST','/tests/'+attempt['id']+'/submit',user=student['id'],json={'answers':[{'questionId':test.questions[0].id,'userAnswer':'4'}],'totalTime':10})
        analysis={'summary':'Correct answer','strengths':['Addition'],'weaknesses':[],'studyPlan':[]}
        with patch.object(gemini_service,'generate_json',new=AsyncMock(return_value=analysis)) as generate:
            first=await self.call('POST','/ai/analyze-result',user=student['id'],json={'attemptId':attempt['id']})
            second=await self.call('POST','/ai/analyze-result',user=student['id'],json={'attemptId':attempt['id']})
            self.assertEqual(first,second);self.assertEqual(generate.await_count,1)
        result=await self.call('GET','/attempts/'+attempt['id']+'/result',user=student['id'])
        self.assertEqual(result['aiAnalysis'],analysis)
        awards=await self.call('GET','/achievements',user=student['id'])
        again=await self.call('GET','/achievements',user=student['id'])
        self.assertTrue(next(a for a in awards['achievements'] if a['id']==achievement.id)['isUnlocked'])
        self.assertGreaterEqual(awards['stats']['xp'],37)
        self.assertEqual(await prisma.userachievement.count(where={'userId':student['id'],'achievementId':achievement.id}),1)
        self.assertEqual(awards['stats']['xp'],again['stats']['xp'])
        for kind,step,body in [('feynman','explain',{'explanation':'A concept'}),('debate','argue',{'argument':'An argument'})]:
            with patch.object(gemini_service,'chat',new=AsyncMock(return_value='A question')):
                created=await self.call('POST',f'/{kind}/sessions',user=student['id'],json={'topic':'Addition','position':'Useful'})
                sid=created['id']
                for _ in range(5):
                    session=await self.call('POST',f'/{kind}/sessions/{sid}/{step}',user=student['id'],json=body)
                if kind=='feynman':self.assertGreater(session['difficulty'],1)
            with patch.object(gemini_service,'generate_json',new=AsyncMock(return_value={'summary':'Good work'})):
                finished=await self.call('POST',f'/{kind}/sessions/{sid}/complete',user=student['id'])
                self.assertEqual(finished['status'],'completed')
            await self.call('GET',f'/{kind}/sessions/{sid}',user=self.admin.id,expected=404)
            await self.call('POST',f'/{kind}/sessions/{sid}/{step}',user=student['id'],expected=400,json=body)
