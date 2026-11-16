"""Common constraints for structured learning assessments returned by AI."""
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Score = Annotated[float, Field(ge=0, le=100, strict=True)]
AssessmentText = Annotated[str, Field(min_length=1)]


class AssessmentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    overallScore: Score
    summary: AssessmentText
    encouragement: AssessmentText
