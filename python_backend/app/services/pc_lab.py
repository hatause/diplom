from datetime import datetime, timezone
from fastapi import HTTPException
from prisma import Json
from app.db.database import prisma
from app.core.utils import parse_db_json
from app.schemas.pc_lab import LabResume, ProgressUpdate


def empty_progress():
    return dict(inspected_parts=[], inspected_parts_count=0, assembly_completed=False,
                assembly_mistakes=0, bios_flashed=False, windows_installed=False,
                resolved_faults=[], system_drive_gb=200, total_score=0, revision=0,
                resume=LabResume(curriculum_version=2).model_dump(), updated_at=None, completed_at=None)


QUIZ_KEY = {'backup': 1, 'uefi': 2, 'efi': 0, 'driver': 1}
BASE_FAULTS = {'TPM_BYPASS', 'INTEL_VMD_DRIVER', 'MBR_TO_GPT_DISKPART', 'OOBE_BYPASSNRO'}


def windows_credit(data):
    resume = data.get('resume') or {}
    required = BASE_FAULTS
    if resume.get('curriculum_version', 1) == 2:
        required = required | {'INSUFFICIENT_SPACE', 'BOOT_ORDER'}
        if not all(resume.get('quiz_answers', {}).get(key) == answer for key, answer in QUIZ_KEY.items()):
            return False
    return data['windows_installed'] and required.issubset(data['resolved_faults'])


def calculate_score(data):
    parts = len(set(data['inspected_parts']))
    return (15 * parts // 8
            + (max(15, 30 - 2 * data['assembly_mistakes']) if data['assembly_completed'] else 0)
            + (20 if data['bios_flashed'] else 0)
            + (35 if windows_credit(data) else 0))


def serialize(record):
    if not record:
        return empty_progress()
    data = record.model_dump(exclude={'user', 'user_id', 'id'})
    data['resume'] = LabResume(**(parse_db_json(record.resume) or {})).model_dump()
    return data


async def get_progress(user_id):
    return serialize(await prisma.pclabprogress.find_unique(where={'user_id': user_id}))


async def save_progress(user_id, payload: ProgressUpdate):
    async with prisma.tx() as db:
        await db.query_raw('SELECT id FROM "User" WHERE id = $1 FOR UPDATE', user_id)
        current = await db.pclabprogress.find_unique(where={'user_id': user_id})
        data = serialize(current)
        if payload.revision is not None and payload.revision != data['revision']:
            raise HTTPException(409, 'Прогресс изменён в другой вкладке. Загрузите сохранённую версию.')
        version = data['resume']['curriculum_version']
        data.update(payload.model_dump(exclude_none=True, exclude={'revision'}))
        # A v2 attempt cannot silently downgrade its grading through a partial/old client.
        data['resume']['curriculum_version'] = max(version, data['resume']['curriculum_version'])
        data['inspected_parts'] = sorted(set(data['inspected_parts']))
        data['resolved_faults'] = sorted(set(data['resolved_faults']))
        data['inspected_parts_count'] = len(data['inspected_parts'])
        data['total_score'] = calculate_score(data)
        finished = (data['inspected_parts_count'] == 8 and data['assembly_completed']
                    and data['bios_flashed'] and windows_credit(data))
        data['completed_at'] = (data['completed_at'] or datetime.now(timezone.utc)) if finished else None
        data['revision'] += 1
        data.pop('updated_at', None)
        data['resume'] = Json(data['resume'])
        record = await db.pclabprogress.upsert(where={'user_id': user_id}, data={
            'create': {'user_id': user_id, **data}, 'update': data,
        })
    return serialize(record)
