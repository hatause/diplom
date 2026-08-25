from pydantic import BaseModel, EmailStr
from typing import Optional, List
from prisma.enums import Role

class UserCreate(BaseModel):
    email: EmailStr
    password: Optional[str] = "password123"
    firstName: str
    lastName: str
    role: Optional[Role] = Role.STUDENT
    groupId: Optional[str] = None

class UserUpdate(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    role: Optional[Role] = None
    isActive: Optional[bool] = None
    password: Optional[str] = None

class GroupCreate(BaseModel):
    name: str
    code: Optional[str] = None

class GroupTeacherAdd(BaseModel):
    teacherId: str

class SubjectCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    teacherId: Optional[str] = None
    iconName: Optional[str] = None
    color: Optional[str] = None

class TopicCreate(BaseModel):
    name: str
    description: Optional[str] = None
