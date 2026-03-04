"""Participant registration endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from ..schemas.participant import ParticipantRegisterRequest, ParticipantRegisterResponse
from ..services.participant_service import register_participant


router = APIRouter(tags=["participants"])


@router.post("/participants/register", response_model=ParticipantRegisterResponse)
def register_participant_endpoint(payload: ParticipantRegisterRequest) -> dict:
    return register_participant(
        age=payload.age,
        gender=payload.gender,
        unikey=payload.unikey,
        group_type=payload.group_type,
    )
