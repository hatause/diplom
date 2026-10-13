from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class GroupCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=16000)
    code: str = Field(min_length=1, max_length=16000)

class StudentAssign(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    studentId: str = Field(min_length=1, max_length=16000)
