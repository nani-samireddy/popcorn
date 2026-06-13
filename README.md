# Popcorn

Popcorn is an open-source watch-party app for watching videos, chatting, reacting,
and talking with friends in a shared room.

## Current foundation

- React, TypeScript, Vite, TailwindCSS responsive client
- Express, Socket.IO, Helmet, CORS, Pino server
- Shared Zod schemas and TypeScript room contracts
- In-memory room creation, joining, leaving, host transfer, and cleanup
- Server-enforced host controls, YouTube selection, chat, reactions, voice status,
  and WebRTC signaling routes
- Unit tests for room lifecycle and playback drift calculation

Voice media connections, YouTube IFrame API playback control, local video playback,
rate limits, and E2E coverage remain to be implemented.

## Run locally

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The web app runs at `http://localhost:5173` and the server at
`http://localhost:4000`. The server health endpoint is `GET /health`.

## Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
```

## Environment

See [.env.example](./.env.example). Set `CLIENT_URL` for server CORS and
`VITE_SERVER_URL` for the browser Socket.IO client.

## Architecture

- `apps/web`: React client
- `apps/server`: Express and Socket.IO server
- `packages/shared`: shared types, validation schemas, and sync helpers
