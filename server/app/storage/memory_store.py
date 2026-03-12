"""In-memory state store for the paired chat MVP."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
import random
from typing import Any
from uuid import uuid4


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize(value: str) -> str:
    return value.strip().lower()

OPENING_LINE = "你好… 我觉得好难受，能跟你聊聊吗……"
SHARED_READ_SECONDS = 5 * 60
TYPING_STALE_SECONDS = 6


def build_participant_id(age: int, gender: str, sequence: int) -> str:
    gender_token = _normalize(gender)[:1] or "u"
    return f"P_{age}-{gender_token}-{sequence}"


def _role_key_from_participant(participant_id: str, room: dict[str, Any]) -> str:
    if room["participant_a"] == participant_id:
        return "A"
    if room["participant_b"] == participant_id:
        return "B"
    raise ValueError("participant is not in room")


@dataclass
class MemoryStore:
    participants: dict[str, dict[str, Any]] = field(default_factory=dict)
    participant_seq_counters: dict[str, int] = field(default_factory=dict)
    waiting_queue: deque[str] = field(default_factory=deque)
    participant_room_index: dict[str, str] = field(default_factory=dict)
    rooms: dict[str, dict[str, Any]] = field(default_factory=dict)
    messages: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    next_message_id: int = 1
    group_assign_counter: int = 0

    def assign_group(self, strategy: str = "cc2e1") -> dict[str, Any]:
        normalized = (strategy or "cc2e1").strip().lower()
        if normalized != "cc2e1":
            raise ValueError("unsupported grouping strategy")

        self.group_assign_counter += 1
        seq = self.group_assign_counter
        slot = (seq - 1) % 3
        group = "control" if slot in (0, 1) else "experimental"
        return {
            "group": group,
            "sequence_no": seq,
            "strategy": normalized,
            "pattern": "control,control,experimental",
            "assigned_at": _now_iso(),
        }

    def _ensure_shared_read_window(self, room: dict[str, Any], round_no: int, now: datetime | None = None) -> None:
        feedback_record = room.get("round_feedbacks", {}).get(round_no)
        report_record = room.get("round_counselor_reports", {}).get(round_no)
        if not feedback_record or not report_record:
            return
        if feedback_record.get("read_deadline_at"):
            return
        now_dt = now or datetime.now(timezone.utc)
        feedback_record["read_started_at"] = now_dt.isoformat()
        feedback_record["read_deadline_at"] = (now_dt + timedelta(seconds=SHARED_READ_SECONDS)).isoformat()

    def register_participant(self, age: int, gender: str, group_type: str | None = None) -> dict[str, Any]:
        gender_token = _normalize(gender)[:1] or "u"
        counter_key = f"{age}-{gender_token}"
        seq = self.participant_seq_counters.get(counter_key, 0) + 1
        self.participant_seq_counters[counter_key] = seq
        participant_id = build_participant_id(age, gender, seq)
        record = {
            "participant_id": participant_id,
            "age": age,
            "gender": gender,
            "sequence": seq,
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
            room = self.rooms.get(existing_room_id)
            if room is None or room.get("status") in {"abandoned", "completed"}:
                self.participant_room_index.pop(participant_id, None)
            else:
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

    def leave_match_queue(self, participant_id: str) -> dict[str, Any]:
        """从等待队列移除，幂等。"""
        try:
            self.waiting_queue.remove(participant_id)
            return {"status": "left", "participant_id": participant_id}
        except ValueError:
            return {"status": "not_in_queue", "participant_id": participant_id}

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

    def sync_round_start(self, room_id: str, participant_id: str, round_no: int, countdown_seconds: int = 30) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")
        if round_no < 1 or round_no > len(room["rounds"]):
            raise ValueError("invalid round number")

        sync_state = room.setdefault("entry_sync", {})
        round_sync = sync_state.setdefault(
            round_no,
            {
                "ready_participants": set(),
                "countdown_seconds": countdown_seconds,
                "start_at": None,
            },
        )
        round_sync["ready_participants"].add(participant_id)

        now = datetime.now(timezone.utc)
        if round_sync["start_at"] is None and len(round_sync["ready_participants"]) == 2:
            round_sync["start_at"] = (now + timedelta(seconds=round_sync["countdown_seconds"])).isoformat()

        start_at = round_sync["start_at"]
        if start_at is None:
            return {
                "room_id": room_id,
                "round_no": round_no,
                "status": "waiting",
                "countdown_seconds": round_sync["countdown_seconds"],
                "start_at": None,
                "server_now": now.isoformat(),
                "remaining_ms": None,
            }

        start_at_dt = datetime.fromisoformat(start_at)
        remaining_ms = max(0, int((start_at_dt - now).total_seconds() * 1000))
        return {
            "room_id": room_id,
            "round_no": round_no,
            "status": "ready",
            "countdown_seconds": round_sync["countdown_seconds"],
            "start_at": start_at,
            "server_now": now.isoformat(),
            "remaining_ms": remaining_ms,
        }

    def end_round(self, room_id: str, participant_id: str) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")

        round_no = room["current_round"]
        round_plan = room["rounds"][round_no - 1]
        expected_counselor_id = room["participant_a"] if round_plan["counselor_key"] == "A" else room["participant_b"]
        if participant_id != expected_counselor_id:
            raise ValueError("only counselor can end the current round")

        if round_plan["status"] == "ended":
            return {
                "room_id": room_id,
                "ended_round": round_no,
                "current_round": room["current_round"],
                "room_status": room["status"],
                "ended_by": participant_id,
                "already_ended": True,
            }

        round_plan["status"] = "ended"
        round_plan["ended_by"] = participant_id
        round_plan["ended_at"] = _now_iso()

        if round_no < len(room["rounds"]):
            room["current_round"] = round_no + 1
            self._ensure_round_opening_message(room, room["current_round"])
        else:
            room["status"] = "completed"

        return {
            "room_id": room_id,
            "ended_round": round_no,
            "current_round": room["current_round"],
            "room_status": room["status"],
            "ended_by": participant_id,
            "already_ended": False,
        }

    def leave_room(self, room_id: str, participant_id: str) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")
        room["status"] = "abandoned"
        room["ended_by"] = participant_id
        participants = {room["participant_a"], room["participant_b"]}
        for pid in participants:
            self.participant_room_index.pop(pid, None)
            try:
                self.waiting_queue.remove(pid)
            except ValueError:
                pass
        return {
            "room_id": room_id,
            "room_status": room["status"],
            "ended_by": participant_id,
        }

    def submit_client_feedback(
        self,
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
    ) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")
        if round_no < 1 or round_no > len(room["rounds"]):
            raise ValueError("invalid round number")

        round_plan = room["rounds"][round_no - 1]
        expected_client_id = room["participant_a"] if round_plan["client_key"] == "A" else room["participant_b"]
        if participant_id != expected_client_id:
            raise ValueError("only client role can submit peer feedback")
        if round_plan["status"] != "ended":
            raise ValueError("round has not ended yet")

        feedback_payload = {
            "relationship_good": relationship_good,
            "relationship_improve": relationship_improve,
            "risk_good": risk_good,
            "risk_improve": risk_improve,
            "protective_good": protective_good,
            "protective_improve": protective_improve,
            "overall_suggestion": overall_suggestion,
        }
        now = datetime.now(timezone.utc)
        record = {
            "room_id": room_id,
            "round_no": round_no,
            "submitted_by": participant_id,
            "submitted_at": now.isoformat(),
            "read_started_at": None,
            "read_deadline_at": None,
            "feedback": feedback_payload,
        }
        room["round_feedbacks"][round_no] = record
        self._ensure_shared_read_window(room, round_no, now=now)
        counselor_report = room.get("round_counselor_reports", {}).get(round_no) or {}
        return {
            "room_id": room_id,
            "round_no": round_no,
            "submitted": True,
            "submitted_at": record["submitted_at"],
            "counselor_report_submitted": bool(counselor_report),
            "counselor_report_submitted_at": counselor_report.get("submitted_at"),
            "read_deadline_at": record["read_deadline_at"],
            "server_now": now.isoformat(),
            "shared_read_seconds": SHARED_READ_SECONDS,
            "feedback": feedback_payload,
            "counselor_review_ready": bool(room.get("round_review_ready", {}).get(round_no)),
        }

    def get_client_feedback(self, room_id: str, participant_id: str, round_no: int) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")
        if round_no < 1 or round_no > len(room["rounds"]):
            raise ValueError("invalid round number")

        now = datetime.now(timezone.utc)
        record = room["round_feedbacks"].get(round_no)
        counselor_report = room.get("round_counselor_reports", {}).get(round_no) or {}
        if not record:
            return {
                "room_id": room_id,
                "round_no": round_no,
                "submitted": False,
                "submitted_at": None,
                "counselor_report_submitted": bool(counselor_report),
                "counselor_report_submitted_at": counselor_report.get("submitted_at"),
                "read_deadline_at": None,
                "server_now": now.isoformat(),
                "shared_read_seconds": SHARED_READ_SECONDS,
                "feedback": None,
                "counselor_review_ready": bool(room.get("round_review_ready", {}).get(round_no)),
            }
        return {
            "room_id": room_id,
            "round_no": round_no,
            "submitted": True,
            "submitted_at": record["submitted_at"],
            "counselor_report_submitted": bool(counselor_report),
            "counselor_report_submitted_at": counselor_report.get("submitted_at"),
            "read_deadline_at": record.get("read_deadline_at"),
            "server_now": now.isoformat(),
            "shared_read_seconds": SHARED_READ_SECONDS,
            "feedback": record["feedback"],
            "counselor_review_ready": bool(room.get("round_review_ready", {}).get(round_no)),
        }

    def mark_counselor_report_submitted(self, room_id: str, participant_id: str, round_no: int) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")
        if round_no < 1 or round_no > len(room["rounds"]):
            raise ValueError("invalid round number")

        round_plan = room["rounds"][round_no - 1]
        expected_counselor_id = room["participant_a"] if round_plan["counselor_key"] == "A" else room["participant_b"]
        if participant_id != expected_counselor_id:
            raise ValueError("only counselor role can submit counselor report")

        now = datetime.now(timezone.utc)
        round_reports = room.setdefault("round_counselor_reports", {})
        existing = round_reports.get(round_no)
        if existing:
            submitted_at = existing.get("submitted_at", now.isoformat())
        else:
            submitted_at = now.isoformat()
            round_reports[round_no] = {
                "room_id": room_id,
                "round_no": round_no,
                "submitted_by": participant_id,
                "submitted_at": submitted_at,
            }

        self._ensure_shared_read_window(room, round_no, now=now)

        return {
            "room_id": room_id,
            "round_no": round_no,
            "submitted": True,
            "submitted_by": participant_id,
            "submitted_at": submitted_at,
        }

    def mark_counselor_review_complete(self, room_id: str, participant_id: str, round_no: int) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")
        if round_no < 1 or round_no > len(room["rounds"]):
            raise ValueError("invalid round number")

        round_plan = room["rounds"][round_no - 1]
        expected_counselor_id = room["participant_a"] if round_plan["counselor_key"] == "A" else room["participant_b"]
        if participant_id != expected_counselor_id:
            raise ValueError("only counselor role can mark review complete")

        room.setdefault("round_review_ready", {})[round_no] = True
        return {
            "room_id": room_id,
            "round_no": round_no,
            "review_ready": True,
            "reviewed_by": participant_id,
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
        room.setdefault("typing_state", {}).setdefault(round_no, {})[participant_id] = {
            "is_typing": False,
            "updated_at": _now_iso(),
        }
        return message

    def get_messages(self, room_id: str, after_id: int = 0) -> list[dict[str, Any]]:
        self.get_room(room_id)
        return [message for message in self.messages.get(room_id, []) if message["message_id"] > after_id]

    def set_typing(self, room_id: str, participant_id: str, round_no: int, is_typing: bool) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")
        if round_no < 1 or round_no > len(room["rounds"]):
            raise ValueError("invalid round number")

        now_iso = _now_iso()
        room.setdefault("typing_state", {}).setdefault(round_no, {})[participant_id] = {
            "is_typing": bool(is_typing),
            "updated_at": now_iso,
        }
        return {
            "room_id": room_id,
            "round_no": round_no,
            "participant_id": participant_id,
            "is_typing": bool(is_typing),
            "updated_at": now_iso,
        }

    def get_peer_typing_status(self, room_id: str, participant_id: str, round_no: int) -> dict[str, Any]:
        room = self.get_room(room_id)
        if participant_id not in {room["participant_a"], room["participant_b"]}:
            raise ValueError("participant is not in room")
        if round_no < 1 or round_no > len(room["rounds"]):
            raise ValueError("invalid round number")

        peer_id = room["participant_b"] if room["participant_a"] == participant_id else room["participant_a"]
        record = room.get("typing_state", {}).get(round_no, {}).get(peer_id)
        now = datetime.now(timezone.utc)
        peer_is_typing = False
        updated_at = None

        if record:
            updated_at = record.get("updated_at")
            if record.get("is_typing") and updated_at:
                updated_dt = datetime.fromisoformat(updated_at)
                peer_is_typing = (now - updated_dt).total_seconds() <= TYPING_STALE_SECONDS

        return {
            "room_id": room_id,
            "round_no": round_no,
            "peer_participant_id": peer_id,
            "peer_is_typing": peer_is_typing,
            "updated_at": updated_at,
            "server_now": now.isoformat(),
        }

    def _append_system_message(self, room: dict[str, Any], round_no: int, sender_id: str, content: str) -> None:
        sender_key = "A" if room["participant_a"] == sender_id else "B"
        round_plan = room["rounds"][round_no - 1]
        sender_role = "counselor" if sender_key == round_plan["counselor_key"] else "client"
        message = {
            "message_id": self.next_message_id,
            "room_id": room["room_id"],
            "round_no": round_no,
            "sender_id": sender_id,
            "sender_key": sender_key,
            "sender_role": sender_role,
            "content": content,
            "created_at": _now_iso(),
        }
        self.next_message_id += 1
        self.messages.setdefault(room["room_id"], []).append(message)

    def _ensure_round_opening_message(self, room: dict[str, Any], round_no: int) -> None:
        round_plan = room["rounds"][round_no - 1]
        if round_plan.get("opening_injected"):
            return
        client_id = room["participant_a"] if round_plan["client_key"] == "A" else room["participant_b"]
        self._append_system_message(room, round_no, client_id, OPENING_LINE)
        round_plan["opening_injected"] = True

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
                    "status": "active",
                    "opening_injected": False,
                },
                {
                    "round_no": 2,
                    "scenario": "xiaowu_high",
                    "counselor_key": round_two_counselor,
                    "client_key": round_two_client,
                    "status": "pending",
                    "opening_injected": False,
                },
            ],
            "round_ready": set(),
            "round_feedbacks": {},
            "round_counselor_reports": {},
            "round_review_ready": {},
            "entry_sync": {},
            "typing_state": {},
        }
        self.rooms[room_id] = room
        self.messages[room_id] = []
        self.participant_room_index[participant_a] = room_id
        self.participant_room_index[participant_b] = room_id
        self._ensure_round_opening_message(room, 1)
        return room


store = MemoryStore()
