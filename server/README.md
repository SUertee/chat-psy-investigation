# Server Backend

This directory contains the FastAPI backend for the control-group paired chat flow.

## Scope

Current MVP endpoints:

- `GET /` root metadata
- `GET /api/health` health check
- `POST /api/participants/register` register a participant from `age + gender + unikey`
- `POST /api/match/join` join the control-group matchmaking queue
- `GET /api/match/status/{participant_id}` check whether a room has been assigned
- `GET /api/rooms/{room_id}` fetch room state
- `POST /api/rooms/{room_id}/advance-round` mark current round complete and advance when both users are ready
- `POST /api/rooms/{room_id}/leave` leave a room
- `POST /api/chat/send` append a message to a room
- `GET /api/chat/messages/{room_id}` fetch messages, optionally filtered by `after_id`

The first implementation uses in-memory storage only. Restarting the process clears all state.

## Run

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## Environment

Copy `.env.example` to `.env` if you want to override defaults.

Important defaults:

- `APP_NAME=chat-psy-backend`
- `API_PREFIX=/api`
- `CORS_ORIGINS=http://localhost:8000,http://127.0.0.1:8000`

## Notes

- This backend is designed for the control-group paired-chat flow, not the AI roleplay flow.
- For production, replace the in-memory store with SQLite or another persistent database.
- For better real-time UX later, the current polling endpoints can be upgraded to WebSocket channels.
