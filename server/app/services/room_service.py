"""Room service helpers."""

from __future__ import annotations

from ..storage.memory_store import store


def get_room(room_id: str) -> dict:
    room = store.get_room(room_id)
    public_room = dict(room)
    public_room.pop("round_ready", None)
    return public_room


def advance_round(room_id: str, participant_id: str) -> dict:
    return store.advance_round(room_id, participant_id)


def sync_round_start(room_id: str, participant_id: str, round_no: int) -> dict:
    return store.sync_round_start(room_id=room_id, participant_id=participant_id, round_no=round_no)


def leave_room(room_id: str, participant_id: str) -> dict:
    return store.leave_room(room_id, participant_id)


def end_round(room_id: str, participant_id: str) -> dict:
    return store.end_round(room_id, participant_id)


def submit_client_feedback(
    room_id: str,
    participant_id: str,
    round_no: int,
    relationship_good: str,
    relationship_improve: str,
    risk_good: str,
    risk_improve: str,
    protective_good: str,
    protective_improve: str,
    overall_suggestion: str,
) -> dict:
    return store.submit_client_feedback(
        room_id=room_id,
        participant_id=participant_id,
        round_no=round_no,
        relationship_good=relationship_good,
        relationship_improve=relationship_improve,
        risk_good=risk_good,
        risk_improve=risk_improve,
        protective_good=protective_good,
        protective_improve=protective_improve,
        overall_suggestion=overall_suggestion,
    )


def get_client_feedback(room_id: str, participant_id: str, round_no: int) -> dict:
    return store.get_client_feedback(room_id=room_id, participant_id=participant_id, round_no=round_no)


def mark_counselor_review_complete(room_id: str, participant_id: str, round_no: int) -> dict:
    return store.mark_counselor_review_complete(room_id=room_id, participant_id=participant_id, round_no=round_no)
