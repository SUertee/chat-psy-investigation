"""In-memory state store for the paired chat MVP."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
import random
from typing import Any
from uuid import uuid4


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize(value: str) -> str:
    return value.strip().lower()


def build_participant_id(age: int, gender: str, unikey: str) -> str:
    gender_token = _normalize(gender)[:1] or "u"
    raw = f"{age}-{gender_token}-{_normalize(unikey)}"
    compact = raw.replace(" ", "")
    return f"P_{compact}"


def _role_key_from_participant(participant_id: str, room: dict[str, Any]) -> str:
    if room["participant_a"] == participant_id:
        return "A"
    if room["participant_b"] == participant_id:
        return "B"
    raise ValueError("participant is not in room")


@dataclass
class MemoryStore:
    participants: dict[str, dict[str, Any]] = field(default_factory=dict)
    waiting_queue: deque[str] = field(default_factory=deque)
    participant_room_index: dict[str, str] = field(default_factory=dict)
    rooms: dict[str, dict[str, Any]] = field(default_factory=dict)
    messages: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    next_message_id: int = 1

    def register_participant(self, age: int, gender: str, unikey: str, group_type: str | None = None) -> dict[str, Any]:
        participant_id = build_participant_id(age, gender, unikey)
        record = {
            "participant_id": participant_id,
            "age": age,
            "gender": gender,
            "unikey": unikey,
            "group_type": group_type or "",
            "created_at": _now_iso(),
        }
        self.participants[participant_id] = record
        return record

    def join_match(self, participant_id: str) -> dict[str, Any]:
        if participant_id not in self.participants:
            raise ValueError("participant not registered")

        existing_room_id = self.participant_room_index.get(participant_id)
        if existing_room_id:
            room = self.rooms[existing_room_id]
            return {
                "status": "matched",
                "participant_id": participant_id,
                "room_id": existing_room_id,
                "role_assignment": room["role_assignment"][_role_key_from_participant(participant_id, room)],
                "current_round": room["current_round"],
            }

        if participant_id in self.waiting_queue:
            return {"status": "waiting", "participant_id": participant_id}

        if self.waiting_queue:
            partner_id = self.waiting_queue.popleft()
            if partner_id == participant_id:
                self.waiting_queue.append(participant_id)
                return {"status": "waiting", "participant_id": participant_id}

            room = self._create_room(partner_id, participant_id)
            return {
                "status": "matched",
                "participant_id": participant_id,
                "room_id": room["room_id"],
                "partner_id": partner_id,
                "role_assignment": room["role_assignment"][_role_key_from_participant(participant_id, room)],
                "current_round": room["current_round"],
            }

        self.waiting_queue.append(participant_id)
        return {"status": "waiting", "participant_id": participant_id}

    def get_match_status(self, participant_id: str) -> dict[str, Any]:
        room_id = self.participant_room_index.get(participant_id)
        if room_id:
            room = self.rooms[room_id]
            partner_id = room["participant_b"] if room["participant_a"] == participant_id else room["participant_a"]
            return {
                "status": "matched",
                "participant_id": participant_id,
                "room_id": room_id,
                "partner_id": partner_id,
                "role_assignment": room["role_assignment"][_role_key_from_participant(participant_id, room)],
                "current_round": room["current_round"],
                "room_status": room["status"],
            }
        if participant_id in self.waiting_queue:
            return {"status": "waiting", "participant_id": participant_id}
        return {"status": "not_joined", "participant_id": participant_id}

    def get_room(self, room_id: str) -> dict[str, Any]:
        room = self.rooms.get(room_id)
        if room is None:
            raise ValueError("room not found")
        return room

    def advance_round(self, room_id: str, participant_id: str) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")

        room["round_ready"].add(participant_id)
        advanced = False
        if len(room["round_ready"]) == 2:
            room["round_ready"].clear()
            if room["current_round"] < 2:
                room["current_round"] += 1
                advanced = True
            else:
                room["status"] = "completed"
        return {
            "room_id": room_id,
            "current_round": room["current_round"],
            "room_status": room["status"],
            "advanced": advanced,
            "ready_count": len(room["round_ready"]),
        }

    def leave_room(self, room_id: str, participant_id: str) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")
        room["status"] = "abandoned"
        room["ended_by"] = participant_id
        return {
            "room_id": room_id,
            "room_status": room["status"],
            "ended_by": participant_id,
        }

    def send_message(self, room_id: str, participant_id: str, round_no: int, content: str) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")

        sender_key = _role_key_from_participant(participant_id, room)
        round_plan = room["rounds"][round_no - 1]
        sender_role = round_plan["counselor_key"] if sender_key == round_plan["counselor_key"] else round_plan["client_key"]
        message = {
            "message_id": self.next_message_id,
            "room_id": room_id,
            "round_no": round_no,
            "sender_id": participant_id,
            "sender_key": sender_key,
            "sender_role": "counselor" if sender_key == round_plan["counselor_key"] else "client",
            "content": content,
            "created_at": _now_iso(),
        }
        self.next_message_id += 1
        self.messages.setdefault(room_id, []).append(message)
        return message

    def get_messages(self, room_id: str, after_id: int = 0) -> list[dict[str, Any]]:
        self.get_room(room_id)
        return [message for message in self.messages.get(room_id, []) if message["message_id"] > after_id]

    def _create_room(self, participant_a: str, participant_b: str) -> dict[str, Any]:
        room_id = f"room_{uuid4().hex[:10]}"
        a_is_first_counselor = random.choice([True, False])
        round_one_counselor = "A" if a_is_first_counselor else "B"
        round_one_client = "B" if round_one_counselor == "A" else "A"
        round_two_counselor = round_one_client
        round_two_client = round_one_counselor

        room = {
            "room_id": room_id,
            "participant_a": participant_a,
            "participant_b": participant_b,
            "status": "active",
            "current_round": 1,
            "created_at": _now_iso(),
            "role_assignment": {
                "A": "paired_user",
                "B": "paired_user",
            },
            "rounds": [
                {
                    "round_no": 1,
                    "scenario": "xiaob_low",
                    "counselor_key": round_one_counselor,
                    "client_key": round_one_client,
                },
                {
                    "round_no": 2,
                    "scenario": "xiaowu_high",
                    "counselor_key": round_two_counselor,
                    "client_key": round_two_client,
                },
            ],
            "round_ready": set(),
        }
        self.rooms[room_id] = room
        self.messages[room_id] = []
        self.participant_room_index[participant_a] = room_id
        self.participant_room_index[participant_b] = room_id
        return room


store = MemoryStore()
