# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MirrorChat** — a psychological safety app for teenagers (14-19) that detects manipulation tactics in chat messages and voice recordings, and triggers automatic emergency calls when danger is detected. Two stacks coexist:

- **Python (`src/`)** — multi-LLM agent base (OpenAI, Gemini, Anthropic + Supabase)
- **Node.js (`mirrorchat/`)** — Express web server + React/Vite frontend

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
npm run dev   # Vite (port 5173) + Express (port 3000) in parallel
npm run build # build React → dist/
npm start     # production (serves dist/)
```

Requires env vars in `mirrorchat/.env` (copy from root `.env.example`).

### API Endpoints (`server.js`)

#### Existing
| Endpoint | Input | Output |
|----------|-------|--------|
| `POST /api/anonymize` | `{ text }` | `{ anonymized, mappings, method }` |
| `POST /api/chat` | `{ message }` | `{ tecnica, traduzione, spiegazione, gravita (1-5), risposte[], risorse }` |
| `POST /api/voice` | `{ transcript }` | `{ pericolo, motivo, escalation, sintesi_emergenza }` |

#### SafeVoice (nuovo)
| Endpoint | Input | Output |
|----------|-------|--------|
| `POST /api/auth/register` | `{ name, phone }` | `{ user: { id, name, phone } }` |
| `GET /api/user/:phone` | — | `{ id, name, phone }` |
| `POST /api/contacts` | `{ userId, contacts[] }` | `{ saved: n }` |
| `GET /api/contacts/:userId` | — | `{ contacts[] }` |
| `POST /api/voice-realtime` | `{ audio (base64), mimeType }` | `{ transcript, anonymized, pericolo, motivo, escalation, sintesi_emergenza }` |
| `POST /api/emergency/call` | `{ userId, dangerContext }` | `{ callSid, contactName }` |
| `POST /api/emergency/sms` | `{ userId, lat, lon, dangerContext }` | `{ sent, total }` |
| `POST /api/emergency/call-status` | Twilio webhook (form-encoded) | TwiML `<Response/>` |

### React App Structure (`mirrorchat/src/`)
- **Router** (`App.jsx`) — 5 routes: `/onboarding`, `/chat`, `/voice`, `/learn`, `/settings`
- **Guard** — `RequireUser` component: redirects to `/onboarding` if no `mirrorUser` in localStorage
- **Pages**:
  - `Onboarding` — 3-step: phone → OTP SMS → emergency contacts
  - `ChatAnalysis` — paste/upload text, anonymize, detect manipulation
  - `SafeVoice` — real-time voice recording with danger detection and auto emergency call
  - `Learn` — educational content on 7 manipulation techniques
  - `Settings` — profile, emergency contacts CRUD, shortcut config, privacy info
- **Utils**:
  - `anonymizer.js` — client-side PII masking (regex)
  - `api.js` — wrappers for `/api/chat` and `/api/voice`
  - `speech.js` — MediaRecorder wrapper (audio chunks every 3s → base64)
  - `location.js` — Geolocation API wrapper
  - `emergency.js` — `shouldTriggerAlert(readings)` + `triggerEmergency(user, context)`

### SafeVoice Flow
```
[IDLE] → (press button / double-tap) → [STARTING] → [RECORDING]
  RECORDING: MediaRecorder → chunk every 3s → POST /api/voice-realtime
             → danger readings[] accumulated
             → shouldTriggerAlert() checks last 30s: max=5 OR highCount≥2
             → [COUNTDOWN 5s] → (no cancel) → [CALLING]
                CALLING: GPS → POST /api/emergency/sms (all contacts)
                         POST /api/emergency/call (first contact, sequential retry)
```

### Danger threshold algorithm (`emergency.js`, mirrored in `server.js`)
```js
function shouldTriggerAlert(readings) {
  const recent = readings.filter(r => Date.now() - r.timestamp < 30000)
  const max = Math.max(...recent.map(r => r.pericolo))
  const highCount = recent.filter(r => r.pericolo >= 4).length
  return max === 5 || highCount >= 2
}
```

### Supabase Schema
Run `mirrorchat/supabase-schema.sql` in Supabase SQL Editor:
- `users` table: `id, name, phone (unique), created_at`
- `emergency_contacts` table: `id, user_id (FK), name, surname, relationship, phone, priority, created_at`

### Deployment
Configured for Vercel via `mirrorchat/vercel.json`: `/api/*` routes to `server.js`, everything else is static.
Set `APP_URL` env var on Vercel to the deployment URL (needed for Twilio call-status webhook).

---

## Environment Variables

| Variable | Used By | Notes |
|----------|---------|-------|
| `OPENAI_API_KEY` | Node server + Python | Required |
| `OPENAI_MODEL` | Node server | Defaults to `gpt-4o-mini` |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Python only | Either name works |
| `ANTHROPIC_API_KEY` | Python only | |
| `SUPABASE_URL` | Node server | Required for SafeVoice features |
| `SUPABASE_ANON_KEY` | Python only | RLS must be active |
| `SUPABASE_SERVICE_ROLE_KEY` | Node server | Used server-side only, never expose to client |
| `TWILIO_ACCOUNT_SID` | Node server | Required for OTP + emergency calls |
| `TWILIO_AUTH_TOKEN` | Node server | Required for OTP + emergency calls |
| `TWILIO_PHONE_NUMBER` | Node server | Sender number (purchased on Twilio) |
| `ELEVENLABS_API_KEY` | Node server | Required for real-time STT (Scribe API) |
| `APP_URL` | Node server | Public URL for Twilio webhooks (e.g. Vercel URL) |

---

## Key Notes

- The `google-generativeai` package is intentionally kept (not migrated to `google-genai`) for hackathon stability.
- Anonymization runs **client-side** (JS) and **server-side** (Python script with JS fallback) before any text reaches the LLM — this is a privacy requirement, not optional.
- `references/` contains design reference HTML files and a brand workbook — read-only design assets, not part of the running app.
- `docs/mcp-hackathon.md` and `mcp.config.example.json` are for Cursor MCP setup (developer tooling only, not app runtime).
- Audio chunks from `MediaRecorder` are sent as base64 to `/api/voice-realtime`; the server transcribes via ElevenLabs Scribe, anonymizes with `jsAnonymize`, then calls the LLM — all in one request.
- Sequential emergency calling: in-memory `emergencyQueues` Map in `server.js` tracks retry state per userId. Requires `APP_URL` to be set so Twilio can POST the call-status webhook.
- Wake Lock API is used during recording to keep the screen on (supported on Chrome/Android; partial on Safari iOS).
