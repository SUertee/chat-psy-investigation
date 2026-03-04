"""Chat service helpers."""

from __future__ import annotations

from ..storage.memory_store import store


def send_message(room_id: str, participant_id: str, round_no: int, content: str) -> dict:
    return store.send_message(room_id=room_id, participant_id=participant_id, round_no=round_no, content=content)


def get_messages(room_id: str, after_id: int = 0) -> list[dict]:
    return store.get_messages(room_id=room_id, after_id=after_id)
