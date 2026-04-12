# CLAUDE.md

## Overview

CHVC Crystal PM Assistant — an AI chatbot that helps Chapel Hills Vision Clinic staff with Crystal Practice Management software questions. Single-service Express app with a vanilla frontend, deployed via Docker on a Hetzner server.

## Stack

- **Runtime**: Node.js 20 (Alpine Docker image)
- **Server**: Express 4 (`server.js`)
- **AI**: `@google/generative-ai` — Gemini 2.0 Flash, 1024 max tokens
- **Frontend**: Static HTML/CSS/JS served from `public/`
- **Knowledge**: `knowledge.md` loaded at startup into the system prompt

## Architecture

- `server.js` is the entire backend — serves static files and handles the `/api/chat` endpoint
- Conversations stored in-memory (`Map` keyed by session ID), pruned hourly (1h TTL)
- Message history capped at 20 messages per session
- `knowledge.md` (~62KB) is read once at startup and injected into the system prompt
- Frontend in `public/` is self-contained vanilla JS — no build step, no framework

## Commands

```bash
# Dev (local)
npm install
npm start                    # Runs on port 3060

# Docker
docker compose up -d --build
docker compose logs -f
docker compose down

# Health check
curl http://localhost:3060/api/health
```

## Deploy

Runs on the Hetzner server. Deploy via:
```bash
ssh root@87.99.146.54
cd /opt/chvc
git pull && docker compose up -d --build
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your key:
```
GEMINI_API_KEY=your-gemini-api-key-here
```

Get your Gemini API key at: https://aistudio.google.com/apikey

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | Express server, Gemini API integration, conversation management |
| `knowledge.md` | Crystal PM knowledge base (scheduling, billing, claims, inventory, etc.) |
| `public/index.html` | Chat UI with quick-reference panel |
| `public/app.js` | Client-side chat logic, markdown rendering, session management |
| `public/styles.css` | CHVC brand styles (gold `#f5bf29`, warm stone palette) |

## Conventions

- No build toolchain — edit frontend files directly in `public/`
- The system prompt in `server.js` defines the assistant personality and boundaries
- `knowledge.md` is the single source of truth for Crystal PM info — update it to expand coverage
- `.env` holds `GEMINI_API_KEY` — never commit it
- Port 3060 is hardcoded in `docker-compose.yml`
