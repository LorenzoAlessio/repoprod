# MirrorChat

## What This Is

MirrorChat is a psychological safety app for teenagers (14-19) that detects manipulation tactics in chat messages and voice recordings, and triggers automatic emergency calls when danger is detected. It runs a dual stack: Python (multi-LLM agent base) and Node.js/React (Express server + Vite frontend), deployed on Vercel with Supabase as the backend database.

## Core Value

Teenagers can identify manipulative and abusive behaviors in their relationships by analyzing chat conversations — every message classified for specific abuse patterns (jealousy, verbal violence, manipulation, personal limitation) with clear, actionable reports.

## Requirements

### Validated

- ✓ Onboarding flow (name + phone + emergency contacts) — existing
- ✓ Chat text anonymization (client-side JS + server-side Python regex) — existing
- ✓ Single-message manipulation detection via OpenAI — existing
- ✓ SafeVoice real-time recording with ElevenLabs transcription + diarization — existing
- ✓ Danger threshold detection and emergency call/SMS triggering — existing
- ✓ Educational content on 7 manipulation techniques (Learn page) — existing
- ✓ Settings page with emergency contacts CRUD, shortcut config, voice enrollment — existing
- ✓ Profile page with editable fact fields and AI-generated narrative — existing
- ✓ Supabase user/contacts/voice-sessions persistence — existing
- ✓ Vercel deployment with API routing — existing

### Active

- [ ] Integrate Profile into Settings page (remove separate /profile route, add "Modifica Profilo" button in Settings showing all current profile fields)
- [ ] Chat analysis: support both copy-paste text and file upload (WhatsApp .txt export, plain text files)
- [ ] Chat analysis: anonymize entire conversation via Python script before AI analysis
- [ ] Chat analysis: batch-intelligent AI analysis — send full conversation, AI classifies each individual message
- [ ] Chat analysis: 4 abuse categories per message — Gelosia, Violenza verbale, Manipolazione, Limitazione personale
- [ ] Chat analysis: report with summary section on top (overall patterns, severity) + per-message detail below (each message with its classification and explanation)
- [ ] AI model fallback: OpenAI as primary, Gemini as fallback when OpenAI fails
- [ ] Each message in the report references the original (anonymized) text and indicates what abuse pattern it represents

### Out of Scope

- Mobile native app — web-first, React SPA
- Real-time chat monitoring (passive interception) — only explicit user-initiated analysis
- Multi-language support — Italian only for now
- Image/screenshot OCR analysis of chats — text input only for this milestone
- Video analysis — out of scope
- Social media API integration (auto-import from WhatsApp/Telegram) — manual upload only

## Context

- **Existing codebase**: Dual stack (Python src/ + Node.js mirrorchat/) with ~1685 lines of codebase documentation in .planning/codebase/
- **Current chat analysis**: Single-message analysis via POST /api/chat returning tecnica, traduzione, spiegazione, gravita (1-5), risposte[], risorse. Needs rework for multi-message conversation analysis with per-message classification.
- **Current profile**: Separate /profile page with FACT_LABELS (genere, eta_stimata, ha_partner, tipo_relazione, etc.) and AI-generated narrative sections. Must be merged into Settings.
- **Anonymization**: Client-side JS (anonymizer.js) + server-side Python script with JS fallback. Privacy requirement — no raw PII reaches the LLM.
- **AI models**: Currently using OpenAI (gpt-4o-mini) via OPENAI_API_KEY. Gemini available in Python stack. Need to add Gemini fallback to Node.js server.
- **Known bug**: Python anonymizer re-anonymizes [TELEFONO] tokens as [PERSONA_N]. Non-blocking but should be aware.
- **Brand colors**: Teal safe (#5B9A8B) for levels 1-2, Amber warning (#E8A838) for level 3, Coral danger (#E8634A) for levels 4-5.

## Constraints

- **Privacy**: All text must be anonymized before reaching any AI model — non-negotiable
- **Tech stack**: Must stay on existing Express + React/Vite + Supabase stack — no framework migration
- **API keys**: OpenAI required, Gemini (GOOGLE_API_KEY) needed for fallback
- **Language**: All UI and AI responses in Italian
- **Target audience**: Teenagers 14-19 — UI must be clear, non-clinical, supportive tone

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Batch-intelligent analysis (full conversation to AI, per-message classification) | Balance between speed (one API call) and granularity (per-message detail) | — Pending |
| 4 abuse categories (Gelosia, Violenza verbale, Manipolazione, Limitazione) | Covers the main patterns of psychological/relationship abuse relevant to teens | — Pending |
| OpenAI primary + Gemini fallback | Reliability — if OpenAI is down or rate-limited, Gemini picks up | — Pending |
| Profile merged into Settings | Simpler navigation, less page fragmentation | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-29 after initialization*
