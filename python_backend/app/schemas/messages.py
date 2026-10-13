from pydantic import BaseModel, Field, ConfigDict

class SendMessageRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    receiverId: str
    content: str = Field(min_length=1, max_length=10000)
