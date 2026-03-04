"""Schemas for room endpoints."""

from pydantic import BaseModel, Field


class RoomRound(BaseModel):
    round_no: int
    scenario: str
    counselor_key: str
    client_key: str


class RoomResponse(BaseModel):
    room_id: str
    participant_a: str
    participant_b: str
    status: str
    current_round: int
    created_at: str
    role_assignment: dict[str, str]
    rounds: list[RoomRound]


class RoomAdvanceRequest(BaseModel):
    participant_id: str = Field(min_length=1, max_length=128)


class RoomAdvanceResponse(BaseModel):
    room_id: str
    current_round: int
    room_status: str
    advanced: bool
    ready_count: int


class RoomLeaveRequest(BaseModel):
    participant_id: str = Field(min_length=1, max_length=128)


class RoomLeaveResponse(BaseModel):
    room_id: str
    room_status: str
    ended_by: str
