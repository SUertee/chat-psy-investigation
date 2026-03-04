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
