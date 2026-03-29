# Codebase Structure

**Analysis Date:** 2026-03-29

## Directory Layout

```
repo-codice-aggiornato/
├── src/                       # Python multi-LLM agent base
│   ├── __init__.py
│   ├── config.py              # Settings dataclass, env loading
│   ├── agent/                 # CLI entry point
│   │   ├── __init__.py
│   │   └── runner.py          # Main CLI (--provider flag)
│   └── providers/             # Pluggable LLM clients
│       ├── __init__.py
│       ├── openai_client.py
│       ├── gemini_client.py
│       └── anthropic_client.py
├── mirrorchat/                # Node.js/React production app
│   ├── server.js              # Express backend (all /api/* routes)
│   ├── package.json           # Dependencies (React, Express, Vite)
│   ├── vercel.json            # Vercel deployment config
│   ├── src/                   # React frontend (Vite SPA)
│   │   ├── main.jsx           # React entry point (index.html)
│   │   ├── App.jsx            # Router definition (5 routes)
│   │   ├── pages/             # Page components
│   │   │   ├── Onboarding.jsx        # 2-step onboarding (profile + contacts)
│   │   │   ├── ChatAnalysis.jsx      # Text manipulation detection
│   │   │   ├── SafeVoice.jsx         # Real-time voice recording + analysis
│   │   │   ├── Learn.jsx             # Educational content (7 techniques)
│   │   │   ├── Settings.jsx          # Profile, contacts CRUD, voice enrollment
│   │   │   └── Profile.jsx           # View/edit consolidated profile facts
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Layout.jsx             # Page wrapper (header, sidebar, outlet)
│   │   │   ├── Sidebar.jsx            # Navigation menu
│   │   │   └── SeverityIndicator.jsx  # Danger level visual (1-5 colors)
│   │   ├── utils/             # Shared utilities
│   │   │   ├── api.js                # Fetch wrappers (analyzeChat, analyzeVoice)
│   │   │   ├── anonymizer.js         # Regex-based PII masking
│   │   │   ├── qwenAnonymizer.js     # NER via Ollama for better anonymization
│   │   │   ├── emergency.js          # shouldTriggerAlert(), triggerEmergency()
│   │   │   ├── location.js           # GPS location via Geolocation API
│   │   │   ├── speech.js             # Web Audio API recorder + visualizer
│   │   │   ├── profiler.js           # Fact extraction, profile consolidation
│   │   │   └── chunker.js            # Voice chunk interval management
│   │   ├── data/              # Static data (read-only)
│   │   │   ├── examples.js           # 4 manipulation technique examples
│   │   │   ├── education.js          # 7 techniques deep-dive content
│   │   │   └── resources.js          # Support resources links
│   │   ├── styles/            # Global CSS
│   │   │   └── globals.css           # Base styles (colors, fonts, resets)
│   │   ├── pages/*.module.css # Page-scoped styles (CSS Modules)
│   │   └── components/*.module.css   # Component-scoped styles
│   ├── scripts/               # Utility scripts (server-side)
│   │   └── anonymize.py       # Python anonymizer (spawned by /api/anonymize)
│   ├── dist/                  # Vite production build (generated, git-ignored)
│   ├── supabase-schema.sql    # Database schema initialization
│   └── .env.example           # Example env vars (no secrets)
├── scripts/                   # Root-level utilities
│   └── sanity_check.py        # Test all configured API keys
├── docs/                      # Documentation
│   └── superpowers/           # GSD/MCP support docs
├── references/                # Design assets (read-only)
└── .env.example               # Root env template (shared between stacks)
```

## Directory Purposes

**`src/`** (Python):
- Purpose: Multi-LLM experimentation and agent framework; not used in production app
- Contains: Configuration, provider abstractions, CLI runner
- Key files: `config.py`, `agent/runner.py`, `providers/*`

**`mirrorchat/server.js`**:
- Purpose: Express HTTP server; orchestrates all API endpoints
- Contains: Request handlers, LLM orchestration, Supabase/Twilio client management
- Key patterns: Lazy client initialization, promise-based async handlers, error handling with fallbacks

**`mirrorchat/src/`** (React):
- Purpose: User-facing SPA (Single Page Application)
- Contains: Pages, components, utilities, static data
- Routing: `/onboarding` (public), `/*` (all others require `mirrorUser` in localStorage)

**`mirrorchat/src/pages/`**:
- Purpose: Full-page components (one per route)
- Layout: Each has `.jsx` file + matching `.module.css`
- State: Local React hooks; persists to localStorage and Supabase on form submission

**`mirrorchat/src/utils/`**:
- Purpose: Shared business logic and integrations
- Types: API wrappers, privacy utilities, emergency logic, data extraction, audio handling

**`mirrorchat/src/data/`**:
- Purpose: Static educational and example content
- Contains: Technique examples, deep-dive education content, support resource links
- Immutable: These are data files, not code

## Key File Locations

**Entry Points:**
- `mirrorchat/src/main.jsx`: React root mount (Vite entry point)
- `mirrorchat/src/App.jsx`: Router definition (all route paths)
- `mirrorchat/server.js`: Express server initialization, port 3000
- `src/agent/runner.py`: Python CLI entry point

**Configuration:**
- `mirrorchat/.env`: Environment variables (git-ignored)
- `.env.example`: Template for both stacks
- `src/config.py`: Python Settings dataclass
- `mirrorchat/vercel.json`: Vercel build routes and handlers
- `mirrorchat/package.json`: Node dependencies and scripts
- `mirrorchat/vite.config.js` (if exists): Vite build configuration

**Core Logic:**
- `mirrorchat/server.js`: All LLM analysis (`/api/chat`, `/api/voice-realtime`, `/api/profile`)
- `mirrorchat/src/pages/ChatAnalysis.jsx`: Client-side chat text analysis workflow
- `mirrorchat/src/pages/SafeVoice.jsx`: Voice recording, real-time analysis, danger detection
- `mirrorchat/src/utils/emergency.js`: Threshold logic, emergency dispatch

**Testing & Validation:**
- `scripts/sanity_check.py`: Validate all API keys and connections
- No unit/integration test suite found (testing gaps documented separately)

## Naming Conventions

**Files:**
- `PascalCase.jsx`: React components and pages
- `camelCase.js`: JavaScript utilities and data files
- `snake_case.py`: Python modules
- `*.module.css`: CSS Modules (scoped styles for React components)
- `*Config.js`, `*config.json`: Configuration files
- `.env*`: Environment variable files (never committed)

**Directories:**
- `src/`: Source code (root or Python)
- `pages/`, `components/`, `utils/`: React subdirectories (lowercase plural)
- `providers/`: Pluggable implementations (lowercase plural)
- `data/`: Static content (lowercase, immutable)

**Variables & Constants:**
- `CONSTANT_CASE`: Global constants (e.g., `COUNTDOWN_SECONDS`, `API_BASE`)
- `camelCase`: Function and variable names
- `PascalCase`: Component names (React)
- `snake_case`: Python variable names

**API Endpoints:**
- `POST /api/chat`: Chat message analysis
- `POST /api/voice`: Basic voice analysis
- `POST /api/voice-realtime`: Real-time voice chunk processing with ElevenLabs
- `POST /api/anonymize`: Text anonymization
- `POST /api/profile`: Profile consolidation
- `POST /api/auth/register`: User registration
- `GET /api/user/:phone`: Fetch user by phone
- `POST /api/contacts`: Save emergency contacts (replaces all)
- `GET /api/contacts/:userId`: Fetch contacts in priority order
- `POST /api/emergency/call`: Trigger voice calls (Bland.ai)
- `POST /api/emergency/sms`: Trigger SMS alerts (Twilio)

## Where to Add New Code

**New Feature (e.g., add manipulation technique):**
- **Backend:**
  - Add technique enum to `server.js` CHAT_SYSTEM or VOICE_SYSTEM prompt
  - Add response handling in `/api/chat` or `/api/voice-realtime`
- **Frontend:**
  - Add to `TECHNIQUE_LABELS` in `mirrorchat/src/pages/ChatAnalysis.jsx`
  - Add example to `mirrorchat/src/data/examples.js`
  - Add education content to `mirrorchat/src/data/education.js`

**New React Page:**
- Create `mirrorchat/src/pages/YourPage.jsx` (component)
- Create `mirrorchat/src/pages/YourPage.module.css` (styles)
- Add route to `mirrorchat/src/App.jsx` in `Routes`
- Add navigation link in `mirrorchat/src/components/Sidebar.jsx`

**New API Endpoint:**
- Add handler to `mirrorchat/server.js` with `app.post()` or `app.get()`
- Follow error handling pattern: try-catch, console.error, res.status(code).json({error, ...})
- Add client-side wrapper in `mirrorchat/src/utils/api.js` if shared across pages

**New Utility Function:**
- **Shared across pages:** Add to `mirrorchat/src/utils/*.js`
- **Page-specific:** Define in page component file
- **LLM prompt utilities:** Add to top of `mirrorchat/server.js` or new `prompts.js` file

**Database Schema Change:**
- Edit `mirrorchat/supabase-schema.sql`
- Run in Supabase SQL Editor
- Update corresponding Supabase client calls in `server.js`
- Add migration notes to `.planning/codebase/CONCERNS.md`

## Special Directories

**`mirrorchat/dist/`:**
- Purpose: Production build output (Vite)
- Generated: Yes, via `npm run build`
- Committed: No (git-ignored)
- Served by: Express static middleware in production

**`mirrorchat/node_modules/`:**
- Purpose: NPM dependencies
- Generated: Yes, via `npm install`
- Committed: No (git-ignored)

**`.env` files:**
- Purpose: Environment variables with secrets
- Generated: No (created manually per deployment)
- Committed: No (multiple .gitignore entries)
- Template: `.env.example` (committed, safe to read)

**`scripts/`**:
- Purpose: Development utilities (not part of app runtime)
- Generated: No
- Committed: Yes, if server-side (Python), No if output files

**`references/`, `docs/`:**
- Purpose: Design assets, documentation, MCP configuration
- Generated: Partial (MCP docs are generated)
- Committed: Yes (design reference files)
- Used by: Developers only, not runtime

## Visualization: Request Flow

```
Browser                     Express (server.js)           External APIs
   │
   ├─ POST /api/chat ──────────────┤ parseJSON()
   │                               ├─ getOpenAIClient()
   │                               ├─ callLLM(CHAT_SYSTEM, text)
   │                               │    └─ OpenAI.chat.completions.create()
   │                               ├─ extractJSON(response)
   │ <─ JSON response ─────────────┤
   │
   ├─ POST /api/voice-realtime ──┤ parseJSON()
   │ {audio: base64, mimeType}  │ ├─ ElevenLabs Scribe API
   │                             │ │   └─ fetch() POST to transcribe
   │                             │ ├─ jsAnonymize(transcript)
   │                             │ ├─ callLLM(VOICE_SYSTEM, anon text)
   │                             │ │    └─ OpenAI.chat.completions.create()
   │                             │ ├─ extractJSON(response)
   │ <─ {pericolo, motivo, ...}─┤
   │
   ├─ GET /api/contacts/:userId ┤ getSupabase()
   │                             ├─ SELECT * FROM emergency_contacts
   │                             │   WHERE user_id = ?
   │ <─ {contacts: []} ──────────┤
   │
   └─ {*splat} (SPA fallback) ──┤ sendFile('dist/index.html')
                                └─ Vite dev server (dev mode)
```

## Development Workflow

**Setup:**
```bash
cd mirrorchat
npm install          # Install dependencies
cp .env.example .env # Copy template, fill in real secrets
```

**Development:**
```bash
npm run dev          # Starts both Vite (5173) and Express (3000) concurrently
# Edit src/**/*.jsx → Vite HMR updates browser
# Edit server.js → Restart Express manually
```

**Build & Deploy:**
```bash
npm run build        # Vite builds React → dist/
npm start            # Serve dist/ from Express on port 3000
# Deploy to Vercel: git push → Vercel auto-deploys via vercel.json
```

---

*Structure analysis: 2026-03-29*
