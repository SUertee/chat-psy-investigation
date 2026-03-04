"""Schemas for matchmaking endpoints."""

from pydantic import BaseModel, Field


class MatchJoinRequest(BaseModel):
    participant_id: str = Field(min_length=1, max_length=128)


class MatchStatusResponse(BaseModel):
    status: str
    participant_id: str
    room_id: str | None = None
    partner_id: str | None = None
    role_assignment: str | None = None
    current_round: int | None = None
    room_status: str | None = None
