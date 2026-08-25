from pydantic import BaseModel
from typing import Optional

class LectureCreate(BaseModel):
    title: str
    content: str
    groupId: Optional[str] = None
    subjectId: str
    fileUrl: Optional[str] = None
    fileName: Optional[str] = None
