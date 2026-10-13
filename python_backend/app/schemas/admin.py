from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
from prisma.enums import Role
from app.schemas.auth import EmailRequest, validate_password

class UserCreate(EmailRequest):
    password: str = Field(default="password123", min_length=8)
    firstName: str = Field(min_length=1, max_length=100)
    lastName: str = Field(min_length=1, max_length=100)
    role: Role = Role.STUDENT

    _password_bytes = field_validator("password")(validate_password)
    groupId: Optional[str] = None

    @field_validator("firstName", "lastName", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value

class UserUpdate(BaseModel):
    firstName: Optional[str] = Field(default=None, min_length=1, max_length=100)
    lastName: Optional[str] = Field(default=None, min_length=1, max_length=100)
    role: Optional[Role] = None
    isActive: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value):
        return validate_password(value) if value is not None else value

    @field_validator("firstName", "lastName", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value

class GroupCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    code: Optional[str] = Field(default=None, min_length=1, max_length=200)

class GroupTeacherAdd(BaseModel):
    teacherId: str

class SubjectCreate(BaseModel):
    name: str = Field(min_length=1)
    code: str = Field(min_length=1)
    description: Optional[str] = None
    teacherId: Optional[str] = None
    iconName: Optional[str] = None
    color: Optional[str] = None

    @field_validator("name", "code", mode="before")
    @classmethod
    def trim_required(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("teacherId", "description", "iconName", "color", mode="before")
    @classmethod
    def normalize_optional(cls, value):
        return (value.strip() or None) if isinstance(value, str) else value


class TopicCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
