from fastapi import APIRouter, Depends
from app.core.security import get_current_user, TokenData
from app.schemas.pc_lab import ProgressUpdate
from app.services.pc_lab import get_progress, save_progress

router = APIRouter(prefix='/pc-lab', tags=['PC Lab'])

@router.get('/progress')
async def read_progress(user: TokenData = Depends(get_current_user)):
    return {'success': True, 'data': await get_progress(user.userId)}

@router.post('/progress')
async def write_progress(body: ProgressUpdate, user: TokenData = Depends(get_current_user)):
    return {'success': True, 'data': await save_progress(user.userId, body)}
