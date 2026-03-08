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


def leave_room(room_id: str, participant_id: str) -> dict:
    return store.leave_room(room_id, participant_id)


def end_round(room_id: str, participant_id: str) -> dict:
    return store.end_round(room_id, participant_id)


def submit_client_feedback(
    room_id: str,
    participant_id: str,
    round_no: int,
    relationship_feedback: str,
    risk_exploration_feedback: str,
    protective_factor_feedback: str,
    overall_suggestion: str,
    empathy_score: int,
    continue_intent: str,
    notes: str,
) -> dict:
    return store.submit_client_feedback(
        room_id=room_id,
        participant_id=participant_id,
        round_no=round_no,
        relationship_feedback=relationship_feedback,
        risk_exploration_feedback=risk_exploration_feedback,
        protective_factor_feedback=protective_factor_feedback,
        overall_suggestion=overall_suggestion,
        empathy_score=empathy_score,
        continue_intent=continue_intent,
        notes=notes,
    )


def get_client_feedback(room_id: str, participant_id: str, round_no: int) -> dict:
    return store.get_client_feedback(room_id=room_id, participant_id=participant_id, round_no=round_no)
