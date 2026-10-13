import io
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import uuid
from unittest.mock import AsyncMock, patch
from zipfile import ZipFile

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import UPLOAD_DIR, settings
from app.db.database import prisma
from app.main import app
from app.schemas.lectures import LectureCreate
from app.services.auth import create_access_token
from app.services.gemini_service import gemini_service
from app.services.lecture_material import read_attachment


def presentation():
    stream = io.BytesIO()
    with ZipFile(stream, 'w') as archive:
        for n in (10, 2, 1):
            archive.writestr(f'ppt/slides/slide{n}.xml', f'<slide><p><t>Материал слайда {n}</t></p></slide>')
    return stream.getvalue()


class LectureMaterialTests(unittest.IsolatedAsyncioTestCase):
    async def test_reads_content_not_extension_and_preserves_slide_order(self):
        with TemporaryDirectory() as directory, patch('app.services.lecture_material.UPLOAD_DIR', Path(directory)):
            Path(directory, 'lecture.ppt').write_bytes(presentation())
            blocks = await read_attachment('/api/v1/uploads/lecture.ppt')
            text = blocks[0]['text']
            self.assertLess(text.index('Материал слайда 1'), text.index('Материал слайда 2'))
            self.assertLess(text.index('Материал слайда 2'), text.index('Материал слайда 10'))
            Path(directory, 'lecture.txt').write_text('Текст вложения', encoding='utf-8')
            self.assertEqual((await read_attachment('/api/v1/uploads/lecture.txt'))[0]['text'], 'Текст вложения')
            Path(directory, 'scan.pdf').write_bytes(b'%PDF-1.7\nfixture')
            self.assertEqual((await read_attachment('/api/v1/uploads/scan.pdf'))[0]['mimeType'], 'application/pdf')
            Path(directory, 'photo.jpg').write_bytes(b'\xff\xd8\xfffixture')
            self.assertEqual((await read_attachment('/api/v1/uploads/photo.jpg'))[0]['type'], 'image')
            stream = io.BytesIO()
            with ZipFile(stream, 'w') as archive:
                archive.writestr('word/document.xml', '<document><p><t>Текст DOCX</t></p></document>')
            Path(directory, 'document.docx').write_bytes(stream.getvalue())
            self.assertEqual((await read_attachment('/api/v1/uploads/document.docx'))[0]['text'], 'Текст DOCX')

    async def test_rejects_unsafe_missing_empty_or_unsupported_files(self):
        with TemporaryDirectory() as directory, patch('app.services.lecture_material.UPLOAD_DIR', Path(directory)):
            for url in ('https://example.com/file.pdf', '/api/v1/uploads/%2e%2e/.env', '/api/v1/uploads/missing.txt'):
                with self.assertRaises(HTTPException):
                    await read_attachment(url)
            for name, body, expected in [('empty.txt', b'', 422), ('old.ppt', b'old-binary-format', 415), ('broken.docx', b'PKbad', 422)]:
                Path(directory, name).write_bytes(body)
                with self.assertRaises(HTTPException) as caught:
                    await read_attachment('/api/v1/uploads/' + name)
                self.assertEqual(caught.exception.status_code, expected)
            Path(directory, 'large.txt').write_bytes(b'12345')
            with patch('app.services.lecture_material.MAX_FILE_BYTES', 4), self.assertRaises(HTTPException) as caught:
                await read_attachment('/api/v1/uploads/large.txt')
            self.assertEqual(caught.exception.status_code, 413)

    def test_file_only_lecture_is_valid(self):
        LectureCreate(title='Lecture', subjectId='subject', fileUrl='/api/v1/uploads/a.pdf')
        with self.assertRaises(ValidationError):
            LectureCreate(title='Lecture', subjectId='subject', content=' ')


@unittest.skipUnless(os.getenv('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1')
class LectureFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_upload_explain_extract_generate_and_open_test(self):
        await prisma.connect()
        prefix = 'lecture-test-' + uuid.uuid4().hex
        user = subject = None
        uploaded = []
        try:
            user = await prisma.user.create(data={'email':prefix+'@example.com', 'passwordHash':'unused', 'firstName':'Test', 'lastName':'Lecture', 'role':'ADMIN'})
            subject = await prisma.subject.create(data={'name':'Тестовый предмет', 'code':prefix})
            headers = {'Authorization':'Bearer '+create_access_token({'userId':user.id,'role':'ADMIN'})}
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test', headers=headers) as client:
                response = await client.post('/api/v1/upload', files={'file':('slides.ppt', presentation(), 'application/octet-stream')})
                self.assertEqual(response.status_code, 200, response.text)
                file_data = response.json()['data']; uploaded.append(UPLOAD_DIR / file_data['fileUrl'].rsplit('/',1)[1])
                response = await client.post('/api/v1/lectures', json={'title':'Лекция', 'subjectId':subject.id, **file_data})
                self.assertEqual(response.status_code, 200, response.text)
                lecture_id = response.json()['data']['id']; base = '/api/v1/lectures/'+lecture_id
                extracted = await client.post(base+'/extract-text')
                self.assertIn('Материал слайда 10', extracted.json()['data']['text'])
                with patch.object(gemini_service, 'chat', new=AsyncMock(return_value='Понятное объяснение')) as chat:
                    response = await client.post(base+'/explain')
                    self.assertEqual(response.status_code,200,response.text)
                    self.assertIn('Материал слайда 10', str(chat.call_args))
                question = {'id':'q1','type':'single_choice','question':'Вопрос?', 'options':['Да','Нет','Иногда','Никогда'], 'correctAnswer':'Да','explanation':'Ответ', 'difficulty':'medium'}
                generated = {'title':'Тест лекции','subject':'Предмет','topic':'Лекция','difficulty':'medium','questions':[{**question,'id':f'q{i}'} for i in range(5)]}
                def provider(request):
                    body = json.loads(request.content)
                    self.assertIn('Материал слайда 10', str(body['contents']))
                    return httpx.Response(200,json={'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(generated)}]}}]})
                async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as provider_client:
                    with patch.object(gemini_service,'_client',provider_client), patch.object(settings,'GEMINI_API_KEY','test-key'):
                        response = await client.post(base+'/generate-test')
                self.assertEqual(response.status_code,200,response.text)
                test = response.json()['data']
                self.assertEqual(len(test['questions']),5)
                self.assertNotIn('correctAnswer',test['questions'][0])
                response = await client.post('/api/v1/tests/'+test['id']+'/start')
                self.assertEqual(response.status_code,200,response.text)
                self.assertEqual(response.json()['data']['testId'],test['id'])
                # Images must reach both explanation and structured test generation.
                response = await client.post('/api/v1/upload', files={'file':('photo.jpg',b'\xff\xd8\xfffixture','image/jpeg')})
                image_data = response.json()['data']; uploaded.append(UPLOAD_DIR / image_data['fileUrl'].rsplit('/',1)[1])
                response = await client.post('/api/v1/lectures',json={'title':'Фото','subjectId':subject.id, **image_data})
                image_base = '/api/v1/lectures/'+response.json()['data']['id']
                with patch.object(gemini_service,'chat',new=AsyncMock(return_value='Текст фотографии')) as chat:
                    self.assertEqual((await client.post(image_base+'/explain')).status_code,200)
                    self.assertIn('image/jpeg', str(chat.call_args))
                    self.assertEqual((await client.post(image_base+'/extract-text')).status_code,200)
                with patch.object(gemini_service,'generate_json',new=AsyncMock()) as generate:
                    from app.schemas.tests import GeneratedTest
                    generate.return_value = GeneratedTest(**generated)
                    self.assertEqual((await client.post(image_base+'/generate-test')).status_code,200)
                    self.assertEqual(generate.call_args.kwargs['input_blocks'][0]['mimeType'],'image/jpeg')
        finally:
            if user:
                await prisma.aiinteraction.delete_many(where={'userId':user.id})
                await prisma.user.delete(where={'id':user.id})
            if subject:
                await prisma.lecture.delete_many(where={'subjectId':subject.id})
                await prisma.test.delete_many(where={'subjectId':subject.id})
                await prisma.subject.delete(where={'id':subject.id})
            for path in uploaded: path.unlink(missing_ok=True)
            await prisma.disconnect()
