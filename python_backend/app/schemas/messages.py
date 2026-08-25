from pydantic import BaseModel

class SendMessageRequest(BaseModel):
    receiverId: str
    content: str
