# External Integrations

**Analysis Date:** 2026-03-29

## APIs & External Services

**LLM Providers (Multiple Models):**
- OpenAI (GPT-4o Mini default)
  - What it's used for: Text message analysis (detect manipulation tactics), voice transcript analysis (danger detection)
  - SDK/Client: `openai@6.33.0` (Node.js), `openai>=1.59.0` (Python)
  - Auth: `OPENAI_API_KEY`
  - Endpoints: `POST /api/chat`, `POST /api/voice`, `POST /api/voice-realtime` → `POST https://api.openai.com/v1/chat/completions`
  - Config: Model name set via `OPENAI_MODEL` env var

- Google Gemini
  - What it's used for: Alternative LLM for text analysis (Python stack only)
  - SDK/Client: `google-generativeai>=0.8.3` (Python)
  - Auth: `GOOGLE_API_KEY` or `GEMINI_API_KEY` (either name works)
  - Config: Model set via `GEMINI_MODEL` env var (defaults to `gemini-2.0-flash`)

- Anthropic Claude
  - What it's used for: Alternative LLM for text analysis (Python stack only)
  - SDK/Client: `@anthropic-ai/sdk@0.80.0` (Node.js), `anthropic>=0.42.0` (Python)
  - Auth: `ANTHROPIC_API_KEY`
  - Config: Model set via `ANTHROPIC_MODEL` env var (defaults to `claude-sonnet-4-20250514`)

**Speech & Audio:**
- ElevenLabs (Scribe v1)
  - What it's used for: Real-time speech-to-text transcription with speaker diarization
  - Endpoint: `POST https://api.elevenlabs.io/v1/speech-to-text`
  - Auth: `ELEVENLABS_API_KEY` (header: `xi-api-key`)
  - Used by: `POST /api/voice-realtime` (server.js:447)
  - Input: Base64-encoded audio (webm/wav), model_id: "scribe_v1"
  - Output: JSON with `text` (transcript) and speaker segments

- Bland.ai (Voice Calls - Currently Mocked)
  - What it's used for: Parallel emergency voice calls to multiple contacts with danger notifications
  - Endpoint: `POST https://api.bland.ai/v1/calls`
  - Auth: `BLAND_AI_API_KEY` (header: `authorization`)
  - Used by: `POST /api/emergency/call` (server.js:481)
  - Config: `phone_number`, `task` (message), `language: "it"`, `max_duration: 2`, `record: false`
  - Status: Placeholder implementation; requires configuration

## Data Storage

**Databases:**
- Supabase (PostgreSQL cloud)
  - Connection: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-side)
  - Client: `@supabase/supabase-js@2.49.8` (Node.js), `supabase>=2.11.0` (Python)
  - Tables:
    - `users` - user profiles (id, name, phone unique, created_at)
    - `emergency_contacts` - emergency contact list (id, user_id FK, name, surname, relationship, phone, priority, created_at)
    - `voice_samples` - enrolled voice profiles (id, owner_type, owner_id, file_path, public_url, created_at)
    - `voice_sessions` - conversation transcripts (id, user_id, profile_id, transcript JSONB, max_danger, session_context, created_at)
  - Storage bucket: `voice-samples` (public) - audio samples for voice enrollment and speaker matching
  - Row-level security: Active (RLS enforced)
  - Used by: Onboarding, Settings, SafeVoice, Profile pages

**File Storage:**
- Supabase Storage (voice-samples bucket)
  - Path pattern: `samples/{ownerType}_{ownerId}_{timestamp}.{ext}`
  - Public URLs generated for voice fingerprint computation
  - Accessed by: Voice enrollment and speaker matching (`computeProfileFromUrl()`)

**Caching:**
- LocalStorage (browser-side)
  - `mirrorUser` - current user object {id, name, phone}
  - `mirrorUserVoiceUrl` - voice sample URL for enrolled user
  - Profile data for risk assessment

## Authentication & Identity

**Auth Provider:**
- Custom (No dedicated auth service)
  - Implementation: Phone-based registration without OTP
  - Flow: `POST /api/auth/register` → upsert user by phone → return user object with Supabase `id`
  - Session: Stored in localStorage (`mirrorUser` JSON)
  - Authorization: Supabase RLS on tables (all rows readable if logged in)

## Monitoring & Observability

**Error Tracking:**
- None (console.error logging only)

**Logs:**
- server.js uses `console.log()` and `console.error()` to stderr/stdout
- No centralized error tracking or APM configured

## CI/CD & Deployment

**Hosting:**
- Vercel (serverless Edge + Functions)
- Configuration: `mirrorchat/vercel.json` (v2 legacy format)
  - Static build: `@vercel/static-build` serving React from `dist/`
  - API function: `@vercel/node` running `server.js`
  - Routes:
    - `GET /api/*` → `server.js` (Express handler)
    - Static files → filesystem
    - `GET *` → `dist/index.html` (SPA fallback)

**CI Pipeline:**
- Not explicitly configured (auto-deployments from git likely)
- Environment variables set in Vercel project dashboard

## Environment Configuration

**Required env vars:**
- `OPENAI_API_KEY` (OpenAI API key)
- `SUPABASE_URL` (Supabase project URL)
- `SUPABASE_SERVICE_ROLE_KEY` (Supabase privileged auth token)
- `TWILIO_ACCOUNT_SID` (Twilio account SID)
- `TWILIO_AUTH_TOKEN` (Twilio auth token)
- `TWILIO_PHONE_NUMBER` (Purchased Twilio phone number)
- `ELEVENLABS_API_KEY` (ElevenLabs API key)
- `BLAND_AI_API_KEY` (Bland.ai API key, optional but required for voice calls)
- `APP_URL` (Deployment URL for Twilio webhook callbacks)

**Optional env vars:**
- `ANTHROPIC_API_KEY` (Claude API, Python stack)
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` (Gemini API, Python stack)
- `SUPABASE_ANON_KEY` (Frontend Supabase client, RLS enforced)
- `OPENAI_MODEL` (LLM model name, defaults to `gpt-4o-mini`)
- `GEMINI_MODEL` (Gemini model, defaults to `gemini-2.0-flash`)
- `ANTHROPIC_MODEL` (Claude model, defaults to `claude-sonnet-4-20250514`)
- `OLLAMA_URL` (Ollama local NER endpoint, dev-only)
- `PORT` (Express server port, defaults to 3000)

**Secrets location:**
- `.env` file (git-ignored, never committed)
- Vercel Environment Variables (project settings dashboard)
- Never expose to frontend except `SUPABASE_ANON_KEY` (with RLS)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/emergency/call-status` - Twilio voice call status webhook
  - Trigger: Call connected, disconnected, or failed
  - Format: Form-encoded (Twilio TwiML callback)
  - Response: TwiML `<Response/>` XML

**Outgoing (Sent By App):**
- `POST https://api.openai.com/v1/chat/completions` - OpenAI API requests
- `POST https://api.elevenlabs.io/v1/speech-to-text` - ElevenLabs transcription
- `POST https://api.bland.ai/v1/calls` - Bland.ai emergency voice calls
- Twilio SMS: `client.messages.create()` (SDK wrapper, not direct HTTP)
- Supabase: CRUD via `@supabase/supabase-js` client library

## Anonymization Pipeline

**Multi-layer anonymization:**
1. Client-side (React): `jsAnonymize()` in `mirrorchat/src/utils/anonymizer.js` - regex-based PII masking
2. Server-side fallback: `jsAnonymize()` in `server.js` - same JS regex implementation
3. Server-side Python: `scripts/anonymize.py` - NER-based with gender detection (attempted before JS fallback)
4. LLM-instructed: System prompts include "do not de-anonymize" instruction for safety

**Masked tokens:**
- `[PESSOA_N]` - names
- `[EMAIL]` - email addresses
- `[USERNAME]` - @mentions
- `[TELEFONO]` - phone numbers
- `[DATA]` - dates

---

*Integration audit: 2026-03-29*
