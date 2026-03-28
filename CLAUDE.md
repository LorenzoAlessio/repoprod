# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MirrorChat** — a psychological safety app for teenagers (14-19) that detects manipulation tactics in chat messages and voice recordings. Two stacks coexist:

- **Python (`src/`)** — multi-LLM agent base (OpenAI, Gemini, Anthropic + Supabase)
- **Node.js (`mirrorchat/`)** — Express web server + vanilla JS frontend (no build step)

---

## Python Stack

### Setup
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
copy .env.example .env   # then fill in real keys
```

### Run
```powershell
python -m src.agent.runner --provider openai
python -m src.agent.runner --provider gemini
python -m src.agent.runner --provider anthropic
python scripts/sanity_check.py   # ping all configured APIs
```

### Architecture
- `src/config.py` — frozen `Settings` dataclass, loads `.env`, sets default model names
- `src/providers/` — one file per LLM; each exposes `complete(messages) -> str`
  - Gemini: system message separated from chat history
  - Anthropic: system messages filtered from messages list, passed separately
- `src/agent/runner.py` — minimal CLI wiring config → provider → stdout

---

## Node.js Stack

### Setup & Run
```bash
cd mirrorchat
npm install
npm start        # http://localhost:3000
```

Requires `OPENAI_API_KEY` in environment (defaults to `gpt-4o-mini`).

### API Endpoints (`server.js`)
| Endpoint | Input | Output |
|----------|-------|--------|
| `POST /api/chat` | `{ message }` | `{ tecnica, traduzione, spiegazione, gravita (1-5), risposte[], risorse }` |
| `POST /api/voice` | `{ transcript }` | `{ pericolo, motivo, escalation, sintesi_emergenza }` |

Both endpoints call OpenAI with a detailed Italian-language system prompt for manipulation/danger detection.

### Frontend JS Pattern
All frontend modules use **IIFE pattern** (no ES6 modules, no bundler). Each file exposes a single `window.*` global:

- `window.Anonymizer` — masks phone, email, @username, dates, and proper names before sending to API
- `window.ChatApi` / `window.VoiceApi` — thin wrappers for the two endpoints
- `window.SpeechEngine` — Web Speech API wrapper (browser-native, no lib)
- `window.SafeVoice` — voice UI + emergency alerts

### Deployment
Configured for Vercel via `mirrorchat/vercel.json`: `/api/*` routes to `server.js`, everything else is static.

---

## Environment Variables

| Variable | Used By | Notes |
|----------|---------|-------|
| `OPENAI_API_KEY` | Node server + Python | Required |
| `OPENAI_MODEL` | Node server | Defaults to `gpt-4o-mini` |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Python only | Either name works |
| `ANTHROPIC_API_KEY` | Python only | |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Python only | RLS must be active for anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Python only | Never expose in client-side code |

---

## Key Notes

- The `google-generativeai` package is intentionally kept (not migrated to `google-genai`) for hackathon stability.
- Anonymization runs **client-side** before any text is sent to the API — this is a privacy requirement, not optional.
- `references/` contains design reference HTML files and a brand workbook — read-only design assets, not part of the running app.
- `docs/mcp-hackathon.md` and `mcp.config.example.json` are for Cursor MCP setup (developer tooling only, not app runtime).
