"""Result persistence service."""

from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
import re
from typing import Any


def _result_dir() -> Path:
    # server/app/services -> server/app -> server -> main
    project_root = Path(__file__).resolve().parents[3]
    result_dir = project_root / "client" / "public" / "result"
    result_dir.mkdir(parents=True, exist_ok=True)
    return result_dir


def _safe_token(value: str, fallback: str) -> str:
    token = re.sub(r"[^a-zA-Z0-9_\-]", "_", (value or "").strip())
    token = token.strip("_")
    return token[:80] if token else fallback


def save_result_snapshot(
    participant_id: str,
    payload: dict[str, Any],
    file_name: str | None = None,
) -> dict[str, Any]:
    result_dir = _result_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    participant_token = _safe_token(participant_id, "unknown")

    base_name = _safe_token(file_name or "", "")
    if base_name:
        json_name = f"{base_name}.json" if not base_name.endswith(".json") else base_name
    else:
        json_name = f"participant_{participant_token}_{timestamp}.json"

    target_path = result_dir / json_name
    serialized = json.dumps(payload, ensure_ascii=False, indent=2)
    target_path.write_text(serialized, encoding="utf-8")

    manifest_path = result_dir / "manifest.ndjson"
    manifest_record = {
        "saved_at": datetime.now().isoformat(),
        "participant_id": participant_id,
        "file_name": json_name,
    }
    with manifest_path.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(manifest_record, ensure_ascii=False) + "\n")

    return {
        "ok": True,
        "saved_path": str(target_path),
        "participant_id": participant_id,
        "bytes_written": len(serialized.encode("utf-8")),
    }


def save_result_file(
    participant_id: str,
    file_bytes: bytes,
    file_name: str | None = None,
) -> dict[str, Any]:
    result_dir = _result_dir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    participant_token = _safe_token(participant_id, "unknown")

    raw_name = (file_name or "").strip()
    suffix = Path(raw_name).suffix.lower() if raw_name else ""
    if suffix not in {".xlsx", ".xls", ".csv"}:
        suffix = ".xlsx"

    stem = _safe_token(Path(raw_name).stem if raw_name else "", "")
    if stem:
        target_name = f"{stem}{suffix}"
    else:
        target_name = f"participant_{participant_token}_{timestamp}{suffix}"

    target_path = result_dir / target_name
    if target_path.exists():
        base_stem = Path(target_name).stem
        target_name = f"{base_stem}_{timestamp}{suffix}"
        target_path = result_dir / target_name
    target_path.write_bytes(file_bytes)

    manifest_path = result_dir / "manifest.ndjson"
    manifest_record = {
        "saved_at": datetime.now().isoformat(),
        "participant_id": participant_id,
        "file_name": target_name,
        "file_type": suffix.lstrip("."),
    }
    with manifest_path.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(manifest_record, ensure_ascii=False) + "\n")

    return {
        "ok": True,
        "saved_path": str(target_path),
        "participant_id": participant_id,
        "bytes_written": len(file_bytes),
    }
