from fastapi import APIRouter, Depends, Path, Body
from app.core.security import get_current_user, TokenData
from app.services.messages import messages_service
from app.schemas.messages import SendMessageRequest

router = APIRouter(prefix="/messages", tags=["Messages"])

@router.get("/contacts")
async def get_contacts(current_user: TokenData = Depends(get_current_user)):
    data = await messages_service.get_contacts(current_user.userId, current_user.role)
    return {"success": True, "data": data}

@router.get("/search")
async def search_users(
    q: str = "",
    current_user: TokenData = Depends(get_current_user)
):
    data = await messages_service.search_users(current_user.userId, q)
    return {"success": True, "data": data}


@router.get("/{user_id}")
async def get_messages(
    user_id: str = Path(...),
    current_user: TokenData = Depends(get_current_user)
):
    data = await messages_service.get_messages(current_user.userId, user_id)
    return {"success": True, "data": data}

@router.post("")
async def send_message(
    payload: SendMessageRequest = Body(...),
    current_user: TokenData = Depends(get_current_user)
):
    data = await messages_service.send_message(current_user.userId, payload)
    return {"success": True, "data": data}
