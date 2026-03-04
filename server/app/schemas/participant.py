"""Schemas for participant endpoints."""

from pydantic import BaseModel, Field


class ParticipantRegisterRequest(BaseModel):
    age: int = Field(ge=1, le=120)
    gender: str = Field(min_length=1, max_length=32)
    unikey: str = Field(min_length=1, max_length=64)
    group_type: str | None = Field(default=None, max_length=32)


class ParticipantRegisterResponse(BaseModel):
    participant_id: str
    age: int
    gender: str
    unikey: str
    group_type: str
    created_at: str
