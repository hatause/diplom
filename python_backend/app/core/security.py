from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.core.config import settings
from pydantic import BaseModel
from app.db.database import prisma

security = HTTPBearer()

from typing import List

class TokenData(BaseModel):
    userId: str
    role: str

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenData:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        if payload.get("tokenType") != "access":
            raise HTTPException(401, "Access token required", headers={"WWW-Authenticate": "Bearer"})
        user_id: str = payload.get("userId") or payload.get("id")
        role: str = payload.get("role") or "STUDENT"
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user or not user.isActive:
            raise HTTPException(status_code=401, detail="Account unavailable")
        return TokenData(userId=user_id, role=user.role)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_roles(roles: List[str]):
    def role_checker(current_user: TokenData = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker
