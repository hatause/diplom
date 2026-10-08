import time
from collections import defaultdict, deque
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user, TokenData
from app.schemas.companion import ChatRequest, GenerateMaterial, QuizAnswer, CardReview, NoteInput, TaskInput, TaskUpdate
from app.services.companion import companion_service as service
from app.services.gemini_service import gemini_service

router = APIRouter(prefix='/companion', tags=['School companion'])
_requests: dict[str, deque] = defaultdict(deque)


async def ai_user(user: TokenData = Depends(get_current_user)):
    now = time.monotonic()
    for key in list(_requests):
        while _requests[key] and _requests[key][0] < now - 60:
            _requests[key].popleft()
        if not _requests[key]:
            del _requests[key]
    if len(_requests[user.userId]) >= 10:
        raise HTTPException(429, 'Не более 10 AI-запросов в минуту. Попробуйте немного позже.')
    _requests[user.userId].append(now)
    return user


def ok(data):
    return {'success': True, 'data': data}


@router.get('/status')
async def status(user: TokenData = Depends(get_current_user)):
    return ok({'configured': gemini_service.is_configured(), 'provider': 'Gemini'})


@router.get('/dashboard')
async def dashboard(user: TokenData = Depends(get_current_user)):
    return ok(await service.dashboard(user.userId))


@router.post('/chat')
async def chat(body: ChatRequest, user: TokenData = Depends(ai_user)):
    return ok(await service.chat(user.userId, body))


@router.post('/decks')
async def deck(body: GenerateMaterial, user: TokenData = Depends(ai_user)):
    return ok(await service.generate(user.userId, 'DECK', body))


@router.post('/quizzes')
async def quiz(body: GenerateMaterial, user: TokenData = Depends(ai_user)):
    return ok(await service.generate(user.userId, 'QUIZ', body))


@router.post('/quizzes/{record_id}/answer')
async def answer(record_id: str, body: QuizAnswer, user: TokenData = Depends(get_current_user)):
    return ok(await service.answer(user.userId, record_id, body))


@router.post('/decks/{record_id}/review')
async def review(record_id: str, body: CardReview, user: TokenData = Depends(get_current_user)):
    return ok(await service.review(user.userId, record_id, body))


@router.post('/notes')
async def note(body: NoteInput, user: TokenData = Depends(get_current_user)):
    return ok(await service.create(user.userId, 'NOTE', body.title, body.model_dump()))


@router.put('/notes/{record_id}')
async def update_note(record_id: str, body: NoteInput, user: TokenData = Depends(get_current_user)):
    async with service.locked(user.userId, 'NOTE', record_id) as (tx, data):
        await service.save(tx, record_id, body.model_dump())
    return ok({'id': record_id, **body.model_dump()})


@router.post('/tasks')
async def task(body: TaskInput, user: TokenData = Depends(get_current_user)):
    return ok(await service.create(user.userId, 'TASK', body.title, {**body.model_dump(mode='json'), 'done': False}))


@router.patch('/tasks/{record_id}')
async def update_task(record_id: str, body: TaskUpdate, user: TokenData = Depends(get_current_user)):
    async with service.locked(user.userId, 'TASK', record_id) as (tx, data):
        data['done'] = body.done
        await service.save(tx, record_id, data)
    return ok({'id': record_id, **data})


KINDS = {'conversations': 'CONVERSATION', 'decks': 'DECK', 'quizzes': 'QUIZ', 'notes': 'NOTE', 'tasks': 'TASK'}


def kind_of(collection):
    if collection not in KINDS:
        raise HTTPException(404, 'Раздел не найден')
    return KINDS[collection]


@router.get('/{collection}')
async def listing(collection: str, user: TokenData = Depends(get_current_user)):
    return ok(await service.list(user.userId, kind_of(collection)))


@router.get('/{collection}/{record_id}')
async def detail(collection: str, record_id: str, user: TokenData = Depends(get_current_user)):
    return ok(await service.get(user.userId, kind_of(collection), record_id))


@router.delete('/{collection}/{record_id}')
async def delete(collection: str, record_id: str, user: TokenData = Depends(get_current_user)):
    from app.db.database import prisma
    record = await service.record(user.userId, kind_of(collection), record_id)
    await prisma.aiinteraction.delete(where={'id': record.id})
    return ok({'deleted': True})
