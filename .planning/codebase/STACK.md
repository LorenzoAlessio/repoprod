# Technology Stack

**Analysis Date:** 2026-03-29

## Languages

**Primary:**
- JavaScript (Node.js) - Backend server and build tooling
- Python 3.11+ - Multi-LLM agent runners for text analysis
- JSX/ES6 - React frontend components

**Secondary:**
- CSS/HTML - Styling and markup (inline and component-scoped)

## Runtime

**Environment:**
- Node.js 18+ (inferred from package.json compatibility)
- Python 3.11+

**Package Manager:**
- npm (JavaScript dependencies)
- pip (Python dependencies via pyproject.toml)
- Lockfile: `package-lock.json` (npm), `pyproject.toml` defines Python deps

## Frameworks

**Core:**
- Express 5.2.1 - REST API backend (`mirrorchat/server.js`)
- React 19.2.4 - Frontend UI framework
- Vite 6.3.1 - Frontend build tool and dev server

**Testing:**
- Not configured (no jest/vitest/pytest detected in dependencies)

**Build/Dev:**
- Vite 6.3.1 - ESM-based dev server with HMR
- @vitejs/plugin-react 4.4.1 - React Fast Refresh support
- Concurrently 9.2.1 - Parallel dev server execution (Express + Vite)

## Key Dependencies

**Critical (LLM Integration):**
- openai 6.33.0 - ChatGPT API (gpt-4o-mini by default) for text and voice analysis
- @anthropic-ai/sdk 0.80.0 - Claude API (optional, Python stack)
- google-generativeai 0.8.3 - Gemini API (optional, Python stack)

**Infrastructure:**
- @supabase/supabase-js 2.49.8 - Database client for user profiles, contacts, sessions
- twilio 5.7.2 - SMS delivery for emergency contacts
- cors 2.8.6 - Cross-origin request handling
- dotenv 17.3.1 - Environment variable loading
- react-router-dom 7.5.0 - Client-side routing (5 main routes)

**Optional (Python-specific):**
- python-dotenv 1.0.1 - .env file support in Python
- anthropic 0.42.0 - Anthropic Claude API
- google-generativeai 0.8.3 - Google Generative AI
- supabase 2.11.0 - Python Supabase client

## Configuration

**Environment:**
Configuration via `.env` file (git-ignored). See `.env.example` for required variables.

**Key configs required:**
- `OPENAI_API_KEY` - ChatGPT API access
- `SUPABASE_URL` - Database endpoint
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side Supabase auth (never expose to frontend)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - SMS delivery
- `ELEVENLABS_API_KEY` - Speech-to-text transcription (ElevenLabs Scribe v1)
- `BLAND_AI_API_KEY` - Voice call API (optional, currently mocked)
- Optional: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`

**Build:**
- `mirrorchat/vite.config.mjs` - Vite build configuration
  - React plugin enabled
  - Dev server proxies `/api/*` to `http://localhost:3000`
  - Output directory: `dist/`
- `mirrorchat/vercel.json` - Vercel deployment routing (v2 legacy format)

**Dev Scripts:**
- `npm run dev` - Concurrent Vite (5173) + Express (3000) with live reload
- `npm run build` - Build React to `dist/`
- `npm start` - Production: Express serves static `dist/` on port 3000
- Python: `python -m src.agent.runner --provider openai|gemini|anthropic`

## Platform Requirements

**Development:**
- Node.js 18+
- Python 3.11+
- npm or yarn
- `.env` file with API keys (see `.env.example`)

**Production:**
- Deployment target: Vercel
- Environment variables set in Vercel project settings
- Static React assets built to `dist/` served from Express
- Database: Supabase (managed cloud PostgreSQL)

---

*Stack analysis: 2026-03-29*
