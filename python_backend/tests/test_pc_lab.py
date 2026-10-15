"""PC lab scoring, revision conflicts, validation and per-user persistence."""
import asyncio
import os
import unittest
import uuid

import httpx
from app.main import app
from app.db.database import prisma
from app.services.pc_lab import calculate_score, empty_progress

PARTS = ['part-cpu', 'part-gpu', 'part-mobo', 'part-ram', 'part-ssd', 'part-psu', 'part-cooler', 'pc-case']
FAULTS = ['TPM_BYPASS', 'INTEL_VMD_DRIVER', 'MBR_TO_GPT_DISKPART', 'OOBE_BYPASSNRO', 'INSUFFICIENT_SPACE', 'BOOT_ORDER']

class ScoreTests(unittest.TestCase):
    def test_partial_and_full_credit(self):
        data = empty_progress()
        self.assertEqual(calculate_score(data), 0)
        data.update(inspected_parts=PARTS, assembly_completed=True, bios_flashed=True, windows_installed=True)
        self.assertEqual(calculate_score(data), 65)  # Disabled faults do not count as solved.
        data['resolved_faults'] = FAULTS
        self.assertEqual(calculate_score(data), 65)  # Six faults alone do not replace the quizzes.
        data['resume']['quiz_answers'] = {'backup': 1, 'uefi': 2, 'efi': 0, 'driver': 1}
        self.assertEqual(calculate_score(data), 100)
        data['assembly_mistakes'] = 2
        self.assertEqual(calculate_score(data), 96)
        data['assembly_mistakes'] = 100
        self.assertEqual(calculate_score(data), 85)

    def test_legacy_completion_keeps_its_score(self):
        data = empty_progress()
        data.update(inspected_parts=PARTS, assembly_completed=True, bios_flashed=True,
                    windows_installed=True, resolved_faults=FAULTS[:4], resume={})
        self.assertEqual(calculate_score(data), 100)
        data['resume']['curriculum_version'] = 2
        self.assertEqual(calculate_score(data), 65)

    def test_each_v2_requirement_is_required(self):
        from copy import deepcopy
        data = empty_progress()
        data.update(windows_installed=True, resolved_faults=FAULTS)
        data['resume']['quiz_answers'] = {'backup': 1, 'uefi': 2, 'efi': 0, 'driver': 1}
        self.assertEqual(calculate_score(data), 35)
        for fault in FAULTS:
            partial = deepcopy(data)
            partial['resolved_faults'].remove(fault)
            self.assertEqual(calculate_score(partial), 0, fault)
        for question in data['resume']['quiz_answers']:
            partial = deepcopy(data)
            partial['resume']['quiz_answers'][question] = (partial['resume']['quiz_answers'][question] + 1) % 3
            self.assertEqual(calculate_score(partial), 0, question)

@unittest.skipUnless(os.environ.get('RUN_DB_TESTS') == '1', 'Set RUN_DB_TESTS=1 for integration')
class ProgressTests(unittest.IsolatedAsyncioTestCase):
    async def test_isolation_validation_partial_save_and_conflicts(self):
        await prisma.connect()
        users = []
        try:
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
                path = '/api/v1/pc-lab/progress'
                self.assertIn((await client.get(path)).status_code, (401, 403))
                self.assertIn((await client.post(path, json={})).status_code, (401, 403))
                headers = []
                for _ in range(2):
                    r = await client.post('/api/v1/auth/register', json={
                        'email': f'pclab-{uuid.uuid4().hex}@example.com', 'password': 'Lab-Test-123!',
                        'firstName': 'PC', 'lastName': 'Lab'})
                    self.assertEqual(r.status_code, 200, r.text[:300])
                    d = r.json()['data']; users.append(d['user']['id'])
                    headers.append({'Authorization': 'Bearer ' + d['accessToken']})
                own, other = headers
                self.assertEqual((await client.get(path, headers=own)).json()['data']['total_score'], 0)
                for body in [{'inspected_parts': ['bogus']}, {'assembly_mistakes': -1}, {'system_drive_gb': 451},
                             {'total_score': 100}, {'user_id': users[1]}, {'resume': {'win_step': 6}}, {'revision': '0'}, {'resume': {'quiz_answers': {'invented': 1}}},
                             {'resume': {'quiz_answers': {'backup': 3}}}, {'resume': {'quiz_mistakes': -1}}]:
                    self.assertEqual((await client.post(path, headers=own, json=body)).status_code, 422, body)
                r = await client.post(path, headers=own, json={'revision': 0, 'inspected_parts': ['part-cpu', 'part-cpu'],
                    'resume': {'mode': 'builder', 'installed': ['part-psu']}})
                self.assertEqual(r.status_code, 200, r.text[:500])
                d = r.json()['data']
                self.assertEqual(d['inspected_parts_count'], 1)
                self.assertEqual(d['resume']['installed'], ['part-psu'])
                self.assertEqual(d['revision'], 1)
                self.assertNotIn('user_id', d)
                competing = await asyncio.gather(*[client.post(path, headers=own, json={'revision': 1, 'bios_flashed': True}) for _ in range(2)])
                self.assertEqual(sorted(r.status_code for r in competing), [200, 409], [r.text[:300] for r in competing])
                d = (await client.get(path, headers=own)).json()['data']
                self.assertEqual(d['inspected_parts'], ['part-cpu'])
                self.assertEqual(d['resume']['installed'], ['part-psu'])
                self.assertEqual(d['total_score'], 21)
                r = await client.post(path, headers=own, json={'revision': d['revision'], 'inspected_parts': PARTS,
                    'assembly_completed': True, 'assembly_mistakes': 2, 'windows_installed': True,
                    'resolved_faults': FAULTS, 'system_drive_gb': 300,
                    'resume': {'curriculum_version': 2, 'quiz_answers': {'backup': 1, 'uefi': 2, 'efi': 0, 'driver': 1}, 'quiz_mistakes': 2, 'diagnostic_mistakes': 1}})
                self.assertEqual(r.status_code, 200, r.text[:500])
                d = r.json()['data']
                self.assertEqual(d['total_score'], 96)
                self.assertIsNotNone(d['completed_at'])
                self.assertEqual(d['resume']['quiz_mistakes'], 2)
                self.assertEqual(d['resume']['diagnostic_mistakes'], 1)
                downgrade = await client.post(path, headers=own, json={'revision': d['revision'], 'resume': {'curriculum_version': 1}, 'resolved_faults': FAULTS[:4]})
                d = downgrade.json()['data']
                self.assertEqual(d['resume']['curriculum_version'], 2)
                self.assertEqual(d['total_score'], 61)
                self.assertEqual((await client.get(path, headers=other)).json()['data']['total_score'], 0)
                reset = await client.post(path, headers=own, json={'revision': d['revision'], 'assembly_completed': False})
                self.assertIsNone(reset.json()['data']['completed_at'])
        finally:
            for user_id in users:
                await prisma.user.delete(where={'id': user_id})
                self.assertIsNone(await prisma.pclabprogress.find_unique(where={'user_id': user_id}))
            await prisma.disconnect()
