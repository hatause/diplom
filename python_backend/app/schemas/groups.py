from pydantic import BaseModel
from typing import Optional

class GroupCreate(BaseModel):
    name: str
    code: str

class StudentAssign(BaseModel):
    studentId: str
