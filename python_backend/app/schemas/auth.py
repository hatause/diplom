from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from prisma.enums import Role


def validate_password(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Пароль должен занимать не более 72 байт UTF-8")
    return value


class EmailRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower()


class RegisterRequest(EmailRequest):
    password: str = Field(min_length=8)
    firstName: str = Field(min_length=1, max_length=100)
    lastName: str = Field(min_length=1, max_length=100)
    role: Optional[Role] = Role.STUDENT
    groupCode: Optional[str] = None

    _password_bytes = field_validator("password")(validate_password)

    @field_validator("firstName", "lastName", "groupCode", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class LoginRequest(EmailRequest):
    password: str

    _password_bytes = field_validator("password")(validate_password)


class UpdateProfileRequest(BaseModel):
    firstName: Optional[str] = Field(default=None, min_length=1, max_length=100)
    lastName: Optional[str] = Field(default=None, min_length=1, max_length=100)
    avatarUrl: Optional[str] = None

    @field_validator("firstName", "lastName", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str = Field(min_length=8)

    _password_bytes = field_validator("currentPassword", "newPassword")(validate_password)
