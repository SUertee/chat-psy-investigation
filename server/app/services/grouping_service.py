"""Grouping assignment service helpers."""

from __future__ import annotations

from ..storage.memory_store import store


def assign_group(strategy: str = "cc2e1") -> dict:
    return store.assign_group(strategy=strategy)
