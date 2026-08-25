from fastapi import APIRouter, Depends, Body
from app.core.security import get_current_user, TokenData
from app.services.ai_features import ai_service
from app.schemas.ai import AIChatRequest, AIAnalyzeRequest, AIExplainRequest

router = APIRouter(prefix="/ai", tags=["AI"])

@router.post("/chat")
async def ai_chat(payload: AIChatRequest = Body(...), current_user: TokenData = Depends(get_current_user)):
    data = await ai_service.chat(current_user.userId, payload)
    return {"success": True, "data": data}

@router.post("/analyze-result")
async def analyze_result(payload: AIAnalyzeRequest = Body(...), current_user: TokenData = Depends(get_current_user)):
    data = await ai_service.analyze_result(current_user.userId, payload.attemptId)
    return {"success": True, "data": data}

@router.post("/explain")
async def explain(payload: AIExplainRequest = Body(...), current_user: TokenData = Depends(get_current_user)):
    data = await ai_service.explain(current_user.userId, payload.questionId, payload.attemptId)
    return {"success": True, "data": data}

@router.get("/recommendations")
async def get_recommendations(current_user: TokenData = Depends(get_current_user)):
    data = await ai_service.get_recommendations(current_user.userId)
    return {"success": True, "data": data}
