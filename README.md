# Chat App

A real-time multi-room chat application built with WebSockets, React, and Node.js.

## Features

- Real-time messaging via WebSocket (no polling)
- Multiple isolated rooms — join any room by ID
- Message history replayed on join (in-memory, per room)
- Typing indicators broadcast to other room members
- Online users sidebar showing who's in the room
- Markdown rendering in messages
- Auto-reconnect with exponential backoff
- Single binary deployment: backend serves the built frontend as static files

## Architecture

```
chat-app/
├── be/                  # Backend — Node.js + TypeScript
│   └── src/index.ts     # Express HTTP server + ws WebSocket server
└── fe/                  # Frontend — React + TypeScript + Vite
    └── src/
        ├── main.tsx     # React entry point
        └── App.tsx      # Single-component app (all state + UI)
```

### Backend ([be/src/index.ts](be/src/index.ts))

- **Express** serves the built React SPA (`fe/dist`) as static files with SPA fallback
- **HTTP server** is shared between Express and `ws` (WebSocketServer on the same port)
- **In-memory state:**
  - `allSockets: User[]` — tracks every live connection with its socket, room, and username
  - `roomMessages: Map<string, Message[]>` — persists chat history per room for the lifetime of the process
- Message handlers: `join`, `chat`, `typing`, and `close` (disconnect)
- Input validation: roomId capped at 50 chars, username at 30 chars, messages at 2000 chars
- Double-join guard: a socket can only join once

### Frontend ([fe/src/App.tsx](fe/src/App.tsx))

- Single `App` component owns all state — no external state library
- WebSocket client with exponential-backoff reconnect (capped at 10s)
- On reconnect, automatically re-sends the `join` message to restore room membership
- Two views: **join screen** (alias + room key) and **chat screen** (message feed + users sidebar)
- Typing indicator auto-clears after 2 seconds of inactivity

### WebSocket Message Protocol

| Direction | Type | Payload |
|---|---|---|
| Client → Server | `join` | `{ roomId, username }` |
| Client → Server | `chat` | `{ message }` |
| Client → Server | `typing` | `{ isTyping: boolean }` |
| Server → Client | `history` | `{ messages: Message[] }` — sent on join |
| Server → Client | `chat` | `{ message, username, timestamp }` |
| Server → Client | `system` | `{ message }` — join/leave notifications |
| Server → Client | `typing` | `{ username, isTyping }` |
| Server → Client | `users_list` | `{ users: string[] }` — broadcast on join/leave |

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js |
| Backend framework | Express 5 |
| WebSocket library | ws |
| Backend language | TypeScript (compiled to CommonJS) |
| Frontend framework | React 18 |
| Frontend build tool | Vite |
| Frontend styling | Tailwind CSS v4 |
| Frontend language | TypeScript |

## Setup

### Prerequisites

- Node.js 18+

### Development

```bash
# Terminal 1 — start the backend (compiles TS then runs)
cd be
npm install
npm run dev

# Terminal 2 — start the frontend dev server
cd fe
npm install
npm run dev
```

Frontend dev server proxies WebSocket connections to `ws://127.0.0.1:8080`.  
Open `http://localhost:5173` in your browser.

### Production

```bash
cd be
npm run build   # installs deps, builds fe/dist, compiles backend TS
npm start       # serves everything on port 8080
```

Open `http://localhost:8080`. The backend serves the compiled frontend.

## Notes

- Chat history is in-memory only — it resets when the server restarts
- No authentication — usernames are self-declared per session
- Rooms are created implicitly by joining them; any string works as a room ID
