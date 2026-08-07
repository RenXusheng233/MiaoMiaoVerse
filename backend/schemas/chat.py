from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)


class ChatChunk(BaseModel):
    content: str


class ChatDone(BaseModel):
    pass


class ChatError(BaseModel):
    message: str


class ChatDisclaimer(BaseModel):
    text: str
