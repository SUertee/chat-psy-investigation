"""Schemas for chat endpoints."""

from pydantic import BaseModel, Field


class ChatSendRequest(BaseModel):
    room_id: str = Field(min_length=1, max_length=128)
    participant_id: str = Field(min_length=1, max_length=128)
    round_no: int = Field(ge=1, le=2)
    content: str = Field(min_length=1, max_length=5000)


class ChatMessageResponse(BaseModel):
    message_id: int
    room_id: str
    round_no: int
    sender_id: str
    sender_key: str
    sender_role: str
    content: str
    created_at: str
