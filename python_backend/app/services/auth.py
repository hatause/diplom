import bcrypt
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt
from fastapi import HTTPException, status
from app.db.database import prisma
from app.core.config import settings
from app.schemas.auth import RegisterRequest, LoginRequest, UpdateProfileRequest
from prisma.enums import Role
from prisma.errors import UniqueViolationError

SALT_ROUNDS = 10

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(SALT_ROUNDS)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4()), "tokenType": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")

def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4()), "tokenType": "refresh"})
    # We use JWT_SECRET for refresh token as well, or REFRESH_TOKEN_SECRET if available
    secret = settings.REFRESH_TOKEN_SECRET or settings.JWT_SECRET
    return jwt.encode(to_encode, secret, algorithm="HS256")

class AuthService:
    async def create_tokens(self, user_id: str, email: str, role: Role, db=None):
        db = db if db is not None else prisma
        payload = {"userId": user_id, "email": email, "role": role}
        access_token = create_access_token(payload)
        refresh_token = create_refresh_token(payload)

        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        await db.refreshtoken.create(  # type: ignore
            data={
                "token": refresh_token,
                "userId": user_id,
                "expiresAt": expires_at
            }
        )

        return {"accessToken": access_token, "refreshToken": refresh_token}

    async def register(self, data: RegisterRequest):
        if data.role not in (None, Role.STUDENT):
            raise HTTPException(403, "Only an administrator can grant staff roles")
        existing = await prisma.user.find_first(where={"email": {"equals": data.email, "mode": "insensitive"}})
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        password_hash = hash_password(data.password)

        student_profile = None
        if data.role == Role.STUDENT or not data.role:
            group_data = None
            if data.groupCode:
                group_data = {
                    "connectOrCreate": {
                        "where": {"code": data.groupCode},
                        "create": {"name": data.groupCode, "code": data.groupCode}
                    }
                }
            student_profile = {
                "create": {
                    "group": group_data
                }
            } if group_data else {"create": {}}

        user_data = {
            "email": data.email,
            "passwordHash": password_hash,
            "firstName": data.firstName,
            "lastName": data.lastName,
            "role": data.role or Role.STUDENT,
        }
        if student_profile:
            user_data["studentProfile"] = student_profile

        try:
            async with prisma.tx() as tx:
                user = await tx.user.create(data=user_data)
                tokens = await self.create_tokens(user.id, user.email, user.role, db=tx)
        except UniqueViolationError:
            if await prisma.user.find_first(where={"email": {"equals": data.email, "mode": "insensitive"}}):
                raise HTTPException(status_code=409, detail="Email already registered")
            raise

        # Omit passwordHash for response
        safe_user = await self.get_me(user.id)

        return {"user": safe_user, **tokens}

    async def login(self, data: LoginRequest):
        clean_email = str(data.email).strip().lower()
        user = await prisma.user.find_first(where={"email": {"equals": clean_email, "mode": "insensitive"}})
        if not user or not user.isActive:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        if not verify_password(data.password, user.passwordHash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        await prisma.user.update(
            where={"id": user.id},
            data={"lastLoginAt": datetime.now(timezone.utc)}
        )

        tokens = await self.create_tokens(user.id, user.email, user.role)

        safe_user = await self.get_me(user.id)

        return {"user": safe_user, **tokens}

    async def refresh(self, refresh_token: str):
        secret = settings.REFRESH_TOKEN_SECRET or settings.JWT_SECRET
        try:
            payload = jwt.decode(refresh_token, secret, algorithms=["HS256"])
            if payload.get("tokenType") not in (None, "refresh"):
                raise ValueError("Invalid token type")
            user_id = payload["userId"]
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        async with prisma.tx() as tx:
            # Only one request can consume a token. Roll back consumption if minting fails.
            consumed = await tx.refreshtoken.delete_many(where={
                "token": refresh_token, "userId": user_id,
                "expiresAt": {"gt": datetime.now(timezone.utc)},
            })
            if not consumed:
                raise HTTPException(status_code=401, detail="Invalid refresh token")
            user = await tx.user.find_unique(where={"id": user_id})
            if not user or not user.isActive:
                raise HTTPException(status_code=401, detail="User not found")
            return await self.create_tokens(user.id, user.email, user.role, db=tx)

    async def logout(self, refresh_token: str):
        await prisma.refreshtoken.delete_many(where={"token": refresh_token})

    async def get_me(self, user_id: str):
        user = await prisma.user.find_unique(
            where={"id": user_id},
            include={
                "studentProfile": {
                    "include": {"group": True}
                }
            }
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        safe_user = user.model_dump()
        safe_user.pop("passwordHash", None)
        return safe_user

    async def update_profile(self, user_id: str, data: UpdateProfileRequest):
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        user = await prisma.user.update(  # type: ignore
            where={"id": user_id},
            data=update_data
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        safe_user = await self.get_me(user.id)
        return safe_user

    async def change_password(self, user_id: str, current_password: str, new_password: str):
        user = await prisma.user.find_unique(where={"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not verify_password(current_password, user.passwordHash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        new_hash = hash_password(new_password)
        await prisma.user.update(
            where={"id": user_id},
            data={"passwordHash": new_hash}
        )

        # Invalidate all refresh tokens
        await prisma.refreshtoken.delete_many(where={"userId": user_id})

auth_service = AuthService()

