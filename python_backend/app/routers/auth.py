from fastapi import APIRouter, Depends, Response, Request, HTTPException
from app.core.config import settings
from app.schemas.auth import RegisterRequest, LoginRequest, UpdateProfileRequest, ChangePasswordRequest
from app.services.auth import auth_service
from app.core.security import get_current_user, TokenData
from typing import Any

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register")
async def register(response: Response, payload: RegisterRequest):
    result = await auth_service.register(payload)
    response.set_cookie(
        key="refreshToken",
        value=result["refreshToken"],
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        path="/api/v1/auth",
        max_age=7 * 24 * 60 * 60,
    )
    return {"success": True, "data": {"user": result["user"], "accessToken": result["accessToken"]}}

@router.post("/login")
async def login(response: Response, payload: LoginRequest):
    result = await auth_service.login(payload)
    response.set_cookie(
        key="refreshToken",
        value=result["refreshToken"],
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        path="/api/v1/auth",
        max_age=7 * 24 * 60 * 60,
    )
    return {"success": True, "data": {"user": result["user"], "accessToken": result["accessToken"]}}

@router.post("/refresh")
async def refresh(request: Request, response: Response):
    # Try to get refresh token from cookies first
    token = request.cookies.get("refreshToken")
    
    # If not in cookies, try to get from JSON body (some clients might send it there)
    if not token:
        try:
            body = await request.json()
            token = body.get("refreshToken")
        except Exception:
            pass

    if not token:
        raise HTTPException(401, "No refresh token")

    result = await auth_service.refresh(token)
    
    response.set_cookie(
        key="refreshToken",
        value=result["refreshToken"],
        httponly=True,
        secure=settings.NODE_ENV == "production",
        samesite="lax",
        path="/api/v1/auth",
        max_age=7 * 24 * 60 * 60,
    )
    return {"success": True, "data": {"accessToken": result["accessToken"]}}

@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("refreshToken")
    if not token:
        try:
            body = await request.json()
            token = body.get("refreshToken")
        except Exception:
            pass
            
    if token:
        await auth_service.logout(token)
        
    response.delete_cookie(key="refreshToken", path="/api/v1/auth")
    return {"success": True}

@router.get("/me")
async def get_me(current_user: TokenData = Depends(get_current_user)):
    user = await auth_service.get_me(current_user.userId)
    return {"success": True, "data": user}

@router.put("/profile")
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: TokenData = Depends(get_current_user)
):
    user = await auth_service.update_profile(current_user.userId, payload)
    return {"success": True, "data": user}

@router.put("/password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: TokenData = Depends(get_current_user)
):
    await auth_service.change_password(current_user.userId, payload.currentPassword, payload.newPassword)
    return {"success": True}

