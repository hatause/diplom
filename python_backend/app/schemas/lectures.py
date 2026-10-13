from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional


class LectureCreate(BaseModel):
    title: str = Field(min_length=1)
    content: str = ""
    groupId: Optional[str] = None
    subjectId: str = Field(min_length=1)
    fileUrl: Optional[str] = None
    fileName: Optional[str] = None

    @field_validator("title", "content", "subjectId", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("groupId", "fileUrl", "fileName", mode="before")
    @classmethod
    def normalize_optional(cls, value):
        return (value.strip() or None) if isinstance(value, str) else value

    @model_validator(mode="after")
    def require_material(self):
        if not self.content and not self.fileUrl:
            raise ValueError("Добавьте текст лекции или прикрепите файл")
        return self
