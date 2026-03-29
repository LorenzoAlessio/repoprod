# Technology Stack: Conversation Analysis Milestone

**Project:** MirrorChat - Multi-message conversation analysis
**Researched:** 2026-03-29
**Overall confidence:** MEDIUM (web search unavailable; versions from training data, flagged where uncertain)

## Scope

This document covers ONLY the new libraries/patterns needed for the conversation analysis milestone:
1. WhatsApp chat export parsing
2. AI model fallback (OpenAI primary, Gemini secondary) in Node.js
3. Batch conversation analysis with per-message abuse classification

The existing stack (Express 5, React 19, Vite 6, Supabase, OpenAI SDK 6.x) is not re-evaluated here.

---

## Recommended Stack

### 1. WhatsApp Chat Parsing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom regex parser (no library) | N/A | Parse WhatsApp `.txt` exports into structured messages | See rationale below | HIGH |

**Rationale: Build, don't install.**

WhatsApp `.txt` export format is simple and well-documented. The format is:

```
dd/mm/yy, HH:MM - Sender Name: Message text
dd/mm/yy, HH:MM - Sender Name: Message text
that continues on the next line
dd/mm/yy, HH:MM - System message without colon after name
```

Italian locale uses `dd/mm/yy, HH:MM` format. The entire parser is ~40-60 lines of JavaScript.

**Why not `whatsapp-chat-parser` (npm)?**
- Adds a dependency for something trivially implementable
- The npm package `whatsapp-chat-parser` (~4k weekly downloads as of training data) handles edge cases like system messages and multiline, but the format variations it handles (12h/24h time, different date separators) are overkill for an Italian-only app where the format is predictable
- The project already has a pattern of custom regex parsers (see `qwenAnonymizer.js` with its address/phone/email regex suite) -- consistency matters
- Custom parsing lets you extract exactly the fields needed (sender, timestamp, text) and immediately integrate with the anonymization pipeline
- WhatsApp occasionally changes export format subtly; owning the parser means faster fixes

**The parser needs to handle:**
1. Italian date format: `dd/mm/yy, HH:MM` or `dd/mm/yyyy, HH:MM`
2. Message delimiter: ` - ` between timestamp and sender
3. Sender/content separator: first `: ` after sender name
4. Multiline messages (lines without timestamp prefix belong to previous message)
5. System messages (e.g., "I messaggi sono protetti dalla crittografia end-to-end")
6. Media placeholders (e.g., `<Media omessi>` in Italian)

**Reference regex pattern:**

```javascript
// Matches: "dd/mm/yy, HH:MM - Sender: Text" or "dd/mm/yyyy, HH:MM - Sender: Text"
const WA_LINE_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})\s+-\s+(.+?):\s+([\s\S]+)$/;
const WA_SYSTEM_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2})\s+-\s+(.+)$/;
```

**Output structure:**

```javascript
{
  messages: [
    { index: 0, timestamp: "2025-03-15T14:30:00", sender: "Marco", text: "Dove sei stata?" },
    { index: 1, timestamp: "2025-03-15T14:31:00", sender: "Giulia", text: "In biblioteca con Chiara" },
    // ...
  ],
  participants: ["Marco", "Giulia"],
  systemMessages: [...],  // filtered out, not sent to LLM
  messageCount: 42
}
```

### 2. AI Model Fallback (Node.js)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@google/generative-ai` | ^0.24.x | Gemini API access in Node.js | Official Google SDK for Gemini; the project's Python stack already uses `google-generativeai` | MEDIUM (version uncertain) |
| Custom fallback wrapper | N/A | Try OpenAI, fall back to Gemini on failure | Simple try/catch; no library needed | HIGH |

**Why `@google/generative-ai` and not `google-generativeai`?**
- `google-generativeai` (PyPI) is the Python SDK, already used in `src/providers/gemini_client.py`
- `@google/generative-ai` (npm) is the official Node.js SDK from Google
- Note: Google also publishes `@google-ai/generativelanguage` (lower-level gRPC client) -- do NOT use that; use the higher-level `@google/generative-ai`

**IMPORTANT VERSION NOTE:** Google has been iterating the Node.js SDK rapidly. As of my training data (early 2025), the package was around v0.21.x. The current version may be higher. **Verify the latest version with `npm view @google/generative-ai version` before installing.**

**Fallback pattern -- no library needed:**

The existing `callLLM()` function in `server.js` is the single integration point. The fallback pattern is:

```javascript
async function callLLMWithFallback(systemPrompt, userMessage, options = {}) {
  // Attempt 1: OpenAI
  try {
    return await callOpenAI(systemPrompt, userMessage, options);
  } catch (err) {
    console.warn('[LLM Fallback] OpenAI failed:', err.message);

    // Only fall back on transient errors, not on bad prompts
    if (err.status === 400) throw err;  // bad request = prompt issue, don't retry

    // Attempt 2: Gemini
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('OpenAI non disponibile e GOOGLE_API_KEY non configurata per il fallback');
    }
    try {
      return await callGemini(systemPrompt, userMessage, options);
    } catch (geminiErr) {
      console.error('[LLM Fallback] Gemini also failed:', geminiErr.message);
      throw new Error('Analisi temporaneamente non disponibile. Riprova tra qualche minuto.');
    }
  }
}
```

**Why NOT use a library like `litellm`, `llm-router`, or `openrouter`?**

| Library | Why Not |
|---------|---------|
| `litellm` (Python) | Python-only; Node.js server needs a JS solution |
| `openrouter` API | Adds a third-party proxy between you and the LLMs; unnecessary latency and cost for just 2 providers |
| `langchain` / `@langchain/core` | Massive dependency for a simple fallback pattern; overkill |
| `vercel ai` SDK | Provides streaming/model switching but the app doesn't use streaming for chat analysis; the structured JSON output pattern (non-streaming) doesn't benefit from it |

The fallback is literally a try/catch. Two providers, sequential attempt. No library needed.

**Gemini-specific considerations for the Node.js server:**

The Gemini SDK works differently from OpenAI. Key differences:
- System instructions are passed separately (not as a `system` role message) -- same pattern already used in `gemini_client.py`
- JSON output: use `generationConfig: { responseMimeType: "application/json" }` to get structured output (available since Gemini 1.5 Pro)
- Model name: use `gemini-2.0-flash` or `gemini-1.5-pro` (verify current model names at launch time)
- Rate limits differ from OpenAI -- Gemini free tier allows 15 RPM for Flash, 2 RPM for Pro

**Environment variable:** Reuse existing `GOOGLE_API_KEY` (already documented in `.env.example` and CLAUDE.md).

### 3. Batch Conversation Analysis (Per-Message Classification)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| OpenAI Structured Outputs (`response_format`) | Built into `openai` ^6.x | Force JSON schema compliance | Eliminates JSON parsing errors; guarantees per-message array output | HIGH |
| Prompt engineering (no library) | N/A | Classify each message in a single LLM call | One API call for the entire conversation; prompt instructs per-message classification | HIGH |

**The core design decision: one call, full conversation.**

Send the entire conversation (all messages) to the LLM in a single request, with instructions to return a JSON array where each element corresponds to one message. This is already the approach stated in PROJECT.md ("batch-intelligent AI analysis -- send full conversation, AI classifies each individual message").

**Why one call vs. per-message calls:**

| Approach | Pros | Cons |
|----------|------|------|
| One call, all messages | Context-aware classification, 1 API call, cheaper, faster | Longer prompt, risk of truncation on very long chats |
| Per-message calls | Simple prompt, independent failures | N API calls (slow, expensive), loses conversational context |
| Chunked (e.g., 20 messages/chunk) | Handles long chats | Chunk boundaries lose context, more complex code |

**Recommendation:** One call with a chunking fallback for conversations > ~100 messages (to stay within token limits). `gpt-4o-mini` handles ~128k tokens input, so even 200-300 messages fit in a single call. Chunk only as a safety net.

**OpenAI Structured Outputs:**

The existing `openai` package (^6.33.0) supports `response_format` with JSON schema. Use this to guarantee the output matches the expected per-message structure:

```javascript
const response = await openai.chat.completions.create({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'conversation_analysis',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          riepilogo: {
            type: 'object',
            properties: {
              pattern_principali: { type: 'array', items: { type: 'string' } },
              gravita_complessiva: { type: 'number' },
              dinamica_relazione: { type: 'string' }
            },
            required: ['pattern_principali', 'gravita_complessiva', 'dinamica_relazione'],
            additionalProperties: false
          },
          messaggi: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                indice: { type: 'number' },
                categoria: {
                  type: 'string',
                  enum: ['gelosia', 'violenza_verbale', 'manipolazione', 'limitazione_personale', 'nessuna']
                },
                gravita: { type: 'number' },
                spiegazione: { type: 'string' }
              },
              required: ['indice', 'categoria', 'gravita', 'spiegazione'],
              additionalProperties: false
            }
          }
        },
        required: ['riepilogo', 'messaggi'],
        additionalProperties: false
      }
    }
  },
  messages: [
    { role: 'system', content: CONVERSATION_ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content: formattedConversation }
  ]
});
```

**Gemini equivalent (for fallback):**

Gemini 1.5 Pro / 2.0 Flash support `responseMimeType: "application/json"` with a `responseSchema` parameter, achieving the same structured output. The schema format differs slightly from OpenAI but the concept is identical.

**Token budget estimation:**

| Conversation size | Approx input tokens | Approx output tokens | Fits in gpt-4o-mini? |
|---|---|---|---|
| 50 messages | ~3-5k | ~5-8k | Yes |
| 200 messages | ~12-20k | ~20-30k | Yes |
| 500 messages | ~30-50k | ~50-80k | Yes (128k context) |
| 1000+ messages | ~60-100k+ | ~100k+ | Risky; chunk |

**Chunking strategy for long conversations (>300 messages):**
- Split into overlapping chunks of ~200 messages (20-message overlap for context continuity)
- Merge results by `indice` (message index), preferring classifications from the chunk where the message had full context
- Only implement if actually needed; start without chunking

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| WhatsApp parsing | Custom regex (~50 LOC) | `whatsapp-chat-parser` npm | Unnecessary dependency for Italian-only, predictable format |
| WhatsApp parsing | Custom regex | `chat-parser` npm | Even less maintained, fewer downloads |
| AI fallback | Custom try/catch | Vercel AI SDK (`ai` package) | Adds streaming abstraction not needed for JSON batch responses |
| AI fallback | Custom try/catch | LangChain.js | Massive dependency, over-engineered for 2-provider fallback |
| AI fallback | Custom try/catch | OpenRouter proxy | Third-party in the critical path; adds latency and cost |
| Gemini SDK | `@google/generative-ai` | REST API direct calls with `fetch` | SDK handles auth, retries, and JSON parsing; worth the dependency |
| Structured output | OpenAI `response_format` + JSON schema | Manual JSON extraction (current `extractJSON()`) | Current approach is fragile -- regex extraction fails on malformed JSON; structured outputs guarantee schema compliance |
| Batch analysis | Single LLM call, full conversation | Per-message LLM calls | N calls = slow, expensive, loses context |
| Batch analysis | Single LLM call | Map/reduce with LangChain | Over-engineered; single call works within token limits |

---

## Installation

```bash
cd mirrorchat

# New dependency (Gemini Node.js SDK for fallback)
npm install @google/generative-ai

# That's it. No other new packages needed.
# WhatsApp parsing = custom code
# Batch analysis = prompt + existing openai SDK
# Structured outputs = built into openai ^6.x
```

**Total new dependencies: 1** (`@google/generative-ai`)

---

## Architecture Impact

### Files to create/modify:

| File | Action | Purpose |
|------|--------|---------|
| `mirrorchat/src/utils/whatsappParser.js` | CREATE | Client-side WhatsApp .txt parser |
| `mirrorchat/server.js` | MODIFY | Add `callGemini()`, `callLLMWithFallback()`, new `/api/chat-conversation` endpoint |
| `mirrorchat/src/utils/api.js` | MODIFY | Add `analyzeConversation()` wrapper |
| `mirrorchat/src/pages/ChatAnalysis.jsx` | MODIFY | Support multi-message results display |

### What stays the same:

- Anonymization pipeline (`qwenAnonymizer.js`) -- already handles full text, will anonymize the entire conversation before sending
- Supabase schema -- no new tables needed for conversation analysis (results are returned to the client, not stored)
- Vite config -- no changes
- Deployment -- no changes

---

## Key Technical Decisions

### 1. New endpoint, not modifying existing

Create `POST /api/chat-conversation` rather than modifying `POST /api/chat`. The existing single-message endpoint is used by the current flow and should remain stable. The conversation endpoint has fundamentally different input/output shape.

### 2. Parser runs client-side

The WhatsApp `.txt` parser runs in the browser (in `src/utils/whatsappParser.js`). This keeps the privacy-first approach: the file never leaves the device in raw form. The flow is:

```
File selected -> Parse (client) -> Anonymize (client) -> Send to API -> LLM analysis -> Display results
```

### 3. Structured outputs over extractJSON()

The current `extractJSON()` function in `server.js` uses string slicing to find JSON in LLM output. This is fragile for array outputs. OpenAI's `response_format` with `json_schema` guarantees valid JSON matching the schema. For Gemini fallback, use `responseMimeType: "application/json"` + `responseSchema`.

### 4. Gemini model selection

Use `gemini-2.0-flash` as the fallback model (fast, cheap, good at structured output). Do NOT use `gemini-1.5-pro` -- it is slower and more expensive, unnecessary for a fallback path. Store as env var `GEMINI_MODEL` with default `gemini-2.0-flash`.

**Confidence note:** Gemini model naming evolves rapidly. Verify available models at implementation time via `https://ai.google.dev/gemini-api/docs/models/gemini`. LOW confidence on exact model name availability.

---

## Version Verification Notes

| Package | Recommended Version | Confidence | Action Needed |
|---------|-------------------|------------|---------------|
| `openai` | ^6.33.0 (already installed) | HIGH | No change; structured outputs supported since ~4.x |
| `@google/generative-ai` | ^0.24.x (verify with npm) | LOW | Run `npm view @google/generative-ai version` before installing |
| `gpt-4o-mini` model | Current as of training data | MEDIUM | Likely still available; check OpenAI dashboard |
| `gemini-2.0-flash` model | Current as of training data | LOW | Verify at implementation time; Google iterates models frequently |

**All version numbers from training data (cutoff ~May 2025). Run `npm view <package> version` to confirm before installing.**

---

## Sources

- Codebase analysis: `mirrorchat/server.js`, `mirrorchat/src/utils/qwenAnonymizer.js`, `mirrorchat/src/providers/gemini_client.py`
- Project requirements: `.planning/PROJECT.md`
- Current stack: `.planning/codebase/STACK.md`
- Training data knowledge on OpenAI SDK, Google Generative AI SDK, WhatsApp export format (MEDIUM confidence; not web-verified)
