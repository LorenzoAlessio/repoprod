# Architecture

**Analysis Date:** 2026-03-29

## Pattern Overview

**Overall:** Dual-stack hybrid architecture combining Python CLI multi-LLM agent base with Node.js/Express REST API backend + React/Vite SPA frontend. The two stacks operate independently but share conceptual modules (anonymization, manipulation detection, emergency logic).

**Key Characteristics:**
- **Separation of concerns:** Python handles multi-provider LLM experimentation; Node.js handles production HTTP API and real-time voice analysis
- **Privacy-first architecture:** Anonymization (PII removal) runs client-side (JS) and server-side (Python) before any text reaches LLM
- **Modular layer design:** Utilities and LLM providers are loosely coupled, allowing easy provider switching
- **Real-time voice analysis pipeline:** Audio → Transcription (ElevenLabs) → Anonymization → LLM analysis → Danger assessment → Emergency trigger

## Layers

### Node.js Stack

**Express HTTP Server (`mirrorchat/server.js`):**
- Purpose: Route API requests, orchestrate LLM calls, manage Supabase/Twilio integrations, serve static React build
- Location: `mirrorchat/server.js`
- Contains: Lazy client initialization (OpenAI, Supabase, Twilio, Bland.ai), endpoint handlers, JSON extraction utilities
- Depends on: `openai`, `@supabase/supabase-js`, `twilio`, environment variables
- Used by: React frontend (`mirrorchat/src/`), emergency contact integrations

**React Frontend (Vite SPA `mirrorchat/src/`):**
- Purpose: User-facing application for manipulation detection, voice monitoring, emergency contact management
- Location: `mirrorchat/src/`
- Contains: Router, pages (chat analysis, voice recording, onboarding, settings), components, utilities
- Depends on: Express API backend via `/api/*` routes, localStorage for user session
- Used by: Teenagers (14-19), primarily on mobile browsers

### Python Stack

**Settings & Configuration (`src/config.py`):**
- Purpose: Centralized frozen Settings dataclass, environment variable loading
- Location: `src/config.py`
- Contains: `Settings` dataclass with API keys, model names
- Depends on: `.env` file via python-dotenv
- Used by: All Python agents and providers

**Multi-Provider LLM Interface (`src/providers/`):**
- Purpose: Abstract away provider differences (OpenAI, Gemini, Anthropic) behind common `complete(messages) -> str` interface
- Location: `src/providers/openai_client.py`, `src/providers/gemini_client.py`, `src/providers/anthropic_client.py`
- Contains: Provider-specific message formatting and API calls
- Depends on: `openai`, `google.generativeai`, `anthropic` SDKs
- Used by: CLI runner, demonstrating pluggable provider pattern

**CLI Agent Runner (`src/agent/runner.py`):**
- Purpose: Minimal command-line interface for testing providers
- Location: `src/agent/runner.py`
- Contains: Argument parsing, provider selection, message composition
- Depends on: Config module, provider modules
- Used by: Development testing only

## Data Flow

### Chat Analysis Flow:
1. **Frontend** (`ChatAnalysis.jsx`): User pastes/uploads text
2. **Client anonymization** (`qwenAnonymizer.js` or `anonymizer.js`): PII removal (names, dates, emails, phone numbers)
3. **Server anonymization** (optional, `/api/anonymize`): Fallback via Python script
4. **LLM Analysis** (`/api/chat`): System prompt + anonymized text → manipulation technique detection
5. **Response** (JSON): `{tecnica, traduzione, spiegazione, gravita, risposte[], risorse}`
6. **Fact extraction** (background): `extractFacts()` via Qwen/Ollama identifies relationships, emotional state, isolation
7. **Profile consolidation** (every 3 analyses): `/api/profile` endpoint aggregates facts into Markdown profile

### Voice Analysis Flow (SafeVoice):
1. **Voice recording** (`SafeVoice.jsx`): MediaRecorder captures audio every 5 seconds
2. **Chunk transmission**: Base64 audio chunk → `/api/voice-realtime`
3. **Transcription**: ElevenLabs Scribe v1 API → transcript + speaker diarization
4. **Client-side anonymization** (`jsAnonymize`): Phone numbers, emails masked as `[TELEFONO]`, `[EMAIL]`
5. **LLM danger assessment** (`VOICE_SYSTEM` prompt): Anonymized text → danger level 1-5, escalation flag
6. **Danger accumulation**: Readings collected, timestamped
7. **Alert threshold** (`shouldTriggerAlert()`): `max(recent 30s) === 5` OR `highCount(≥4) >= 2`
8. **Countdown**: 5-second cancel window
9. **Emergency dispatch**: SMS via Twilio (`/api/emergency/sms`), Voice call via Bland.ai (`/api/emergency/call`)
10. **Session save**: Transcript + metadata → Supabase `voice_sessions` table

### Onboarding Flow:
1. **Step 1** (`Onboarding.jsx`): Register user (name, phone) → `/api/auth/register` → Supabase `users` table
2. **Step 2**: Add emergency contacts → `/api/contacts` (POST) → Supabase `emergency_contacts` table
3. **Local persistence**: User + contacts saved to localStorage (`mirrorUser`, `mirrorContacts`)

### Emergency Contact Flow:
1. **Settings page** (`Settings.jsx`): CRUD emergency contacts
2. **POST /api/contacts**: Replaces all contacts for userId in Supabase
3. **GET /api/contacts/:userId**: Fetch contacts in priority order

## State Management

**Client-side:**
- **localStorage keys:**
  - `mirrorUser`: `{id, name, phone}` (from Supabase)
  - `mirrorContacts`: Array of `{name, surname, relationship, phone, priority}`
  - `mirrorchat_profile_facts`: Accumulated facts from Qwen fact extraction
  - `mirrorchat_profile_md`: Consolidated Markdown profile
  - `mirrorchat_analysis_count`: Counter for profile consolidation trigger

- **React hooks (ephemeral):**
  - Danger readings in SafeVoice: `readings[]` with `{pericolo, timestamp}`
  - Transcript lines, interim text, frequency bars for visualization

**Server-side:**
- **Supabase tables:**
  - `users`: `id, name, phone (unique), created_at`
  - `emergency_contacts`: `id, user_id (FK), name, surname, relationship, phone, priority, created_at`
  - `voice_sessions`: `id, user_id, profile_id, transcript (JSONB), max_danger, session_context, created_at`
  - `voice_samples`: `id, owner_type, owner_id, file_path, public_url, created_at` (for enrollment profiles)

- **In-memory (Node.js):** Lazy clients (`_openaiClient`, `_supabaseClient`, `_twilioClient`) cached at module level

## Key Abstractions

**Manipulation Technique Detection:**
- Purpose: Identify psychological tactics in text
- Examples: `src/pages/ChatAnalysis.jsx` (frontend), `server.js` CHAT_SYSTEM prompt (backend)
- Pattern: Input anonymized text → LLM → JSON schema with `tecnica` enum (gaslighting, love_bombing, etc.)

**Danger Assessment (Real-Time):**
- Purpose: Evaluate immediate safety risk in voice conversation
- Examples: `server.js` VOICE_SYSTEM prompt, `emergency.js` shouldTriggerAlert()
- Pattern: Input anonymized transcript → LLM → `{pericolo (1-5), escalation, sintesi_emergenza}` → threshold check

**Anonymization Pipeline:**
- Purpose: Remove personally identifiable information before LLM processing
- Examples: `qwenAnonymizer.js` (NER-based), `anonymizer.js` (regex fallback), Python anonymizer script
- Pattern: Input raw text → regex/Qwen extraction → masked output with mappings

**Profile Consolidation:**
- Purpose: Build longitudinal risk profile from conversation facts
- Examples: `profiler.js` (fact extraction), `/api/profile` endpoint (Markdown generation)
- Pattern: Facts accumulated → triggered every 3 analyses → LLM consolidates → stored in localStorage

**Emergency Dispatch:**
- Purpose: Multi-contact notification on danger detection
- Examples: `emergency.js` (client), `/api/emergency/sms` and `/api/emergency/call` (server)
- Pattern: Danger threshold triggered → SMS via Twilio (all contacts) → Voice call via Bland.ai (sequential) → GPS coordinates included

## Entry Points

**Web Application:**
- Location: `mirrorchat/dist/index.html` (production) or Vite dev server (development)
- Triggers: Browser navigation to `localhost:3000` or Vercel deployment URL
- Responsibilities: Render React SPA, enforce `/onboarding` auth guard, route to chat/voice/learn/settings/profile

**Express Server:**
- Location: `mirrorchat/server.js`
- Triggers: `npm run dev` (concurrent Vite + Express), `npm start` (production), Vercel Node functions
- Responsibilities: Route `/api/*` requests, orchestrate LLM/Supabase/Twilio, serve static dist/ build, handle webhooks (Twilio call-status)

**Python CLI:**
- Location: `src/agent/runner.py`
- Triggers: `python -m src.agent.runner --provider openai|gemini|anthropic`
- Responsibilities: Parse arguments, instantiate provider, send test message, print response to stdout

## Error Handling

**Strategy:** Layered graceful degradation with fallbacks.

**Patterns:**
- **Anonymization:** If Python script times out or fails, use JS fallback (`jsAnonymize`)
- **LLM calls:** Try-catch with HTTP error codes; chat returns error object matching response schema
- **Supabase:** Lazy initialization; endpoint returns 500 with error message if URL/keys missing
- **Audio transcription:** ElevenLabs failure returns generic transcript error; LLM still runs with empty/silence input
- **Emergency dispatch:** Promise.allSettled() for SMS + call; one failure doesn't block the other
- **Voice enrollment:** Client handles file upload failure gracefully; continues without enrolled voice profiles
- **Qwen/Ollama:** If unavailable or error, fact extraction skips silently (background task, non-blocking)

## Cross-Cutting Concerns

**Logging:**
- Node.js: console.error/warn/log to stdout (Vercel captures automatically)
- Python: No explicit logging; uses print to stdout for CLI
- Frontend: Errors caught silently, displayed in UI (error banner)

**Validation:**
- **Input:** ExpressJS body parsing (json, urlencoded); basic typeof checks in endpoints
- **Output:** JSON.parse with try-catch; schema validation via Zod-like patterns (verify response has required fields)
- **LLM output:** `extractJSON()` helper finds and parses JSON from LLM text (handles wrapper text)

**Authentication & Authorization:**
- **Client:** localStorage session (`mirrorUser`); `RequireUser` guard redirects unauthenticated to `/onboarding`
- **Server:** No explicit auth on API endpoints; Supabase RLS on table level (client-side anon key for reads, service-role key for server writes)
- **Supabase:** Service role key used server-side only (never exposed to frontend); anon key used by Python scripts with RLS active

**Privacy & Security:**
- Anonymization mandatory before LLM: phone, email, dates, names masked
- No plaintext names in voice transcript storage; speaker identities mapped anonymously
- Vercel deployment: `APP_URL` env var required for Twilio webhook routing (prevents CSRF)
- Bland.ai voice calls not yet implemented (mock mode); Twilio SMS functional
- Conversation transcripts stored in Supabase (encrypted at rest via Vercel PaaS)

---

*Architecture analysis: 2026-03-29*
