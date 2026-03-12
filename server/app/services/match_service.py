"""Matchmaking service helpers."""

from __future__ import annotations

from ..storage.memory_store import store


def join_match(participant_id: str) -> dict:
    return store.join_match(participant_id)


def get_match_status(participant_id: str) -> dict:
    return store.get_match_status(participant_id)


def leave_match_queue(participant_id: str) -> dict:
    return store.leave_match_queue(participant_id)
