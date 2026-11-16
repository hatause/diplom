"""Regressions found during the November full-project review."""
import asyncio
import io
import json
import os
from pathlib import Path
import struct
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
import uuid
from unittest.mock import AsyncMock, patch
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException

from app.db.database import prisma
from app.services.auth import auth_service, hash_password, verify_password
from app.services.lecture_material import read_attachment
from app.services.lectures import lectures_service
from app.services.debate import debate_service
from app.services.feynman import feynman_service
from app.services.gemini_service import gemini_service


class AssessmentReviewTests(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_ai_assessments_do_not_complete_or_persist_sessions(self):
        for service in (feynman_service, debate_service):
            for invalid in ({'summary': 'Missing assessment fields'}, {'scores': 'eighty'}, {'overallScore': 101}):
                with self.subTest(service=type(service).__name__, invalid=invalid):
                    session = {
                        'status': 'active', 'topic': 'Science', 'userPosition': 'Useful',
                        'aiPosition': 'Opposing', 'roundNumber': 1,
                        'conversationHistory': [{'role': 'user', 'content': 'My explanation'}],
                    }
                    with patch.object(service, 'get_session', new=AsyncMock(return_value=session)), \
                            patch.object(service, '_update_session', new=AsyncMock()) as save, \
                            patch.object(gemini_service, '_generate', new=AsyncMock(return_value=json.dumps(invalid))):
                        with self.assertRaises(HTTPException) as error:
                            await service.complete_session('student', 'session')
                        self.assertEqual(error.exception.status_code, 502)
                        save.assert_not_awaited()
                        self.assertEqual(session['status'], 'active')


class LectureReviewTests(unittest.IsolatedAsyncioTestCase):
    async def test_malformed_attachment_urls_return_client_errors(self):
        with TemporaryDirectory() as directory, patch('app.services.lecture_material.UPLOAD_DIR', Path(directory)):
            for url in ('//[invalid', '/api/v1/uploads/%00.txt'):
                with self.subTest(url=url):
                    with self.assertRaises(HTTPException) as error:
                        await read_attachment(url)
                    self.assertEqual(error.exception.status_code, 400)

    async def test_invalid_zip_compression_returns_document_error(self):
        stream = io.BytesIO()
        with ZipFile(stream, 'w', compression=ZIP_DEFLATED) as archive:
            archive.writestr('word/document.xml', '<document><p><t>Lecture</t></p></document>')
        original = stream.getvalue()
        unsupported = bytearray(original)
        # Compression identifiers occur in both the local and central headers.
        struct.pack_into('<H', unsupported, 8, 99)
        struct.pack_into('<H', unsupported, unsupported.index(b'PK\x01\x02') + 10, 99)
        corrupt = bytearray(original)
        start = 30 + len('word/document.xml')
        corrupt[start] = 0xff  # Invalid DEFLATE block type.
        with TemporaryDirectory() as directory, patch('app.services.lecture_material.UPLOAD_DIR', Path(directory)):
            for data in (unsupported, corrupt):
                Path(directory, 'lecture.docx').write_bytes(data)
                with self.assertRaises(HTTPException) as error:
                    await read_attachment('/api/v1/uploads/lecture.docx')
                self.assertEqual(error.exception.status_code, 422)

    async def test_existing_long_lecture_titles_can_generate_tests(self):
        lecture = SimpleNamespace(subjectId=str(uuid.uuid4()), title='Лекция ' * 50)
        with patch('app.services.lectures.prisma') as db, \
                patch('app.services.lectures.require_lecture_access', new=AsyncMock()), \
                patch('app.services.lectures.lecture_material', new=AsyncMock(return_value=[{'type': 'text', 'text': 'Material'}])), \
                patch('app.services.lectures.test_service.generate_test', new=AsyncMock(return_value={'id': 'generated'})) as generate:
            db.lecture.find_unique = AsyncMock(return_value=lecture)
            self.assertEqual(await lectures_service.generate_test('lecture', 'student'), {'id': 'generated'})
        self.assertEqual(generate.call_args.kwargs['params'].topic, lecture.title[:200].strip())


@unittest.skipUnless(os.getenv('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1')
class PasswordChangeReviewTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.assertIn('/schedule_test_', os.environ.get('DATABASE_URL', ''))
        await prisma.connect()
        self.user = await prisma.user.create(data={
            'email': 'password-review-' + uuid.uuid4().hex + '@example.com',
            'firstName': 'Review', 'lastName': 'Password',
            'passwordHash': hash_password('old-password'),
        })
        self.tokens = await auth_service.create_tokens(self.user.id, self.user.email, self.user.role)

    async def asyncTearDown(self):
        await prisma.user.delete(where={'id': self.user.id})
        await prisma.disconnect()

    async def test_concurrent_password_changes_only_accept_current_password_once(self):
        results = await asyncio.gather(
            auth_service.change_password(self.user.id, 'old-password', 'new-password-one'),
            auth_service.change_password(self.user.id, 'old-password', 'new-password-two'),
            return_exceptions=True,
        )
        self.assertEqual(sum(result is None for result in results), 1, results)
        failures = [result for result in results if isinstance(result, HTTPException)]
        self.assertEqual([failure.status_code for failure in failures], [400])
        user = await prisma.user.find_unique(where={'id': self.user.id})
        successful_password = 'new-password-one' if results[0] is None else 'new-password-two'
        self.assertTrue(verify_password(successful_password, user.passwordHash))
        self.assertEqual(await prisma.refreshtoken.count(where={'userId': self.user.id}), 0)

    async def test_failed_session_revocation_rolls_back_password_change(self):
        token_actions = type(prisma.refreshtoken)
        with patch.object(token_actions, 'delete_many', new=AsyncMock(side_effect=RuntimeError('revocation failed'))):
            with self.assertRaises(RuntimeError):
                await auth_service.change_password(self.user.id, 'old-password', 'new-password')
        user = await prisma.user.find_unique(where={'id': self.user.id})
        self.assertTrue(verify_password('old-password', user.passwordHash))
        self.assertEqual(await prisma.refreshtoken.count(where={'userId': self.user.id}), 1)
