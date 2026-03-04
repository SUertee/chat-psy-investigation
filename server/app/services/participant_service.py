"""Participant service helpers."""

from __future__ import annotations

from ..storage.memory_store import store


def register_participant(age: int, gender: str, unikey: str, group_type: str | None = None) -> dict:
    return store.register_participant(age=age, gender=gender, unikey=unikey, group_type=group_type)
