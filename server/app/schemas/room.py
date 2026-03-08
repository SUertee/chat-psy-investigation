"""Schemas for room endpoints."""

from pydantic import BaseModel, Field


class RoomRound(BaseModel):
    round_no: int
    scenario: str
    counselor_key: str
    client_key: str
    status: str


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


class RoomSyncStartRequest(BaseModel):
    participant_id: str = Field(min_length=1, max_length=128)
    round_no: int = Field(ge=1, le=2)


class RoomSyncStartResponse(BaseModel):
    room_id: str
    round_no: int
    status: str
    countdown_seconds: int
    start_at: str | None = None
    server_now: str
    remaining_ms: int | None = None


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


class RoomEndRoundRequest(BaseModel):
    participant_id: str = Field(min_length=1, max_length=128)


class RoomEndRoundResponse(BaseModel):
    room_id: str
    ended_round: int
    current_round: int
    room_status: str
    ended_by: str
    already_ended: bool


class RoomClientFeedbackRequest(BaseModel):
    participant_id: str = Field(min_length=1, max_length=128)
    round_no: int = Field(ge=1, le=2)
    relationship_good: str = Field(min_length=1, max_length=4000)
    relationship_improve: str = Field(min_length=1, max_length=4000)
    risk_good: str = Field(min_length=1, max_length=4000)
    risk_improve: str = Field(min_length=1, max_length=4000)
    protective_good: str = Field(min_length=1, max_length=4000)
    protective_improve: str = Field(min_length=1, max_length=4000)
    overall_suggestion: str = Field(min_length=1, max_length=4000)


class RoomReviewCompleteRequest(BaseModel):
    participant_id: str = Field(min_length=1, max_length=128)
    round_no: int = Field(ge=1, le=2)


class RoomReviewCompleteResponse(BaseModel):
    room_id: str
    round_no: int
    review_ready: bool
    reviewed_by: str


class RoomClientFeedbackViewRequest(BaseModel):
    participant_id: str = Field(min_length=1, max_length=128)
    round_no: int = Field(ge=1, le=2)


class RoomClientFeedbackResponse(BaseModel):
    room_id: str
    round_no: int
    submitted: bool
    submitted_at: str | None = None
    feedback: dict | None = None
    counselor_review_ready: bool = False
