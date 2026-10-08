import base64
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator

Language = Literal['ru', 'en', 'de', 'uk']
Mode = Literal['tutor', 'homework', 'study', 'term']


class LearningContext(BaseModel):
    grade: int = Field(default=8, ge=1, le=13)
    subject: str = Field(default='', max_length=120)
    topic: str = Field(default='', max_length=200)
    language: Language = 'ru'
    difficulty: Literal['easy', 'medium', 'hard'] = 'medium'


class ChatRequest(LearningContext):
    message: str = Field(min_length=1, max_length=16000)
    mode: Mode = 'tutor'
    conversationId: str | None = Field(default=None, max_length=80)
    image: str | None = Field(default=None, max_length=5600000)

    @field_validator('message')
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError('Введите вопрос')
        return value.strip()

    @field_validator('image')
    @classmethod
    def image_content(cls, value):
        if not value:
            return None
        try:
            header, data = value.split(',', 1)
            media = header.removeprefix('data:').removesuffix(';base64')
            if header != f'data:{media};base64' or media not in ('image/jpeg', 'image/png', 'image/webp'):
                raise ValueError()
            raw = base64.b64decode(data, validate=True)
            valid = (media == 'image/jpeg' and raw.startswith(b'\xff\xd8\xff') or
                     media == 'image/png' and raw.startswith(b'\x89PNG\r\n\x1a\n') or
                     media == 'image/webp' and raw[:4] == b'RIFF' and raw[8:12] == b'WEBP')
            if not valid or not 0 < len(raw) <= 4 * 1024 * 1024:
                raise ValueError()
        except (ValueError, TypeError):
            raise ValueError('Допустимы PNG, JPEG, WebP до 4 МБ')
        return value


class GenerateMaterial(LearningContext):
    source: str = Field(min_length=1, max_length=20000)
    count: int = Field(default=5, ge=3, le=15)


class Card(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(min_length=1, max_length=4000)


class DeckOutput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    cards: list[Card] = Field(min_length=3, max_length=15)


class QuizQuestion(Card):
    type: Literal['multiple_choice', 'true_false', 'short_answer']
    options: list[str] = Field(max_length=6, description='For multiple_choice: 2–6 unique options. For true_false: exactly two localized options. For short_answer: an empty array.')
    answer: str = Field(min_length=1, max_length=4000, description='For choice questions copy one option verbatim, never its letter or index. For short_answer use a single term or number.')
    explanation: str = Field(min_length=1, max_length=4000)
    topic: str = Field(min_length=1, max_length=200)

    @model_validator(mode='after')
    def valid_options(self):
        if self.type != 'short_answer':
            if len(self.options) < 2 or len(set(self.options)) != len(self.options) or self.answer not in self.options:
                raise ValueError('Answer must exactly match a unique option')
            if self.type == 'true_false' and len(self.options) != 2:
                raise ValueError('true_false requires two options')
        return self


class QuizOutput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    questions: list[QuizQuestion] = Field(min_length=3, max_length=15)


class QuizAnswer(BaseModel):
    index: int = Field(ge=0, le=14)
    answer: str = Field(min_length=1, max_length=2000)


class CardReview(BaseModel):
    index: int = Field(ge=0, le=14)
    known: bool


class NoteInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=30000)


class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subject: str = Field(default='', max_length=120)
    kind: Literal['homework', 'test']
    dueAt: datetime

    @field_validator('dueAt')
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None:
            raise ValueError('Include timezone')
        return value


class TaskUpdate(BaseModel):
    done: bool
