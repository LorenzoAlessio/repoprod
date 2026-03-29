# Architecture Patterns

**Domain:** Conversation analysis pipeline with per-message abuse classification
**Researched:** 2026-03-29
**Confidence:** HIGH (based on codebase analysis + established patterns)

## Current State Assessment

The existing `POST /api/chat` endpoint handles **single-message** analysis: one message in, one classification out. The new milestone requires **batch conversation** analysis: an entire multi-message conversation in, per-message classifications out, with a summary report on top.

The current pipeline is:

```
User pastes text
  -> Client anonymization (qwenAnonymizer.js regex)
  -> POST /api/chat { message }
  -> OpenAI (CHAT_SYSTEM prompt)
  -> Single JSON: { tecnica, traduzione, spiegazione, gravita, risposte[], risorse }
```

This must become:

```
User pastes/uploads conversation
  -> Parse into individual messages (with sender + timestamp)
  -> Client anonymization (entire text, preserving message boundaries)
  -> POST /api/chat-batch { messages[] }
  -> OpenAI (BATCH_SYSTEM prompt, full conversation context)
  -> Per-message classifications + conversation summary
```

## Recommended Architecture

### Component Diagram

```
+-------------------------------------------------------------------+
|  FRONTEND (React)                                                  |
|                                                                    |
|  ChatAnalysis.jsx (reworked)                                       |
|    |                                                               |
|    +-- InputPanel: paste text / upload .txt file / drag-drop       |
|    |     |                                                         |
|    |     +-- chatParser.js: raw text -> structured messages[]      |
|    |                                                               |
|    +-- AnonPreview: shows anonymized conversation                  |
|    |     |                                                         |
|    |     +-- qwenAnonymizer.js (existing): PII removal             |
|    |                                                               |
|    +-- ReportView: summary card + per-message detail list          |
|          |                                                         |
|          +-- ConversationSummary: overall patterns, severity       |
|          +-- MessageCard[]: individual message classification      |
|          +-- ResourcesBanner (existing): support links             |
+-------------------------------------------------------------------+
         |
         | POST /api/chat-batch
         | { messages: [{sender, text, timestamp?}...],
         |   genere_utente, persone, profile_context }
         |
+-------------------------------------------------------------------+
|  BACKEND (Express server.js)                                       |
|                                                                    |
|  /api/chat-batch handler                                           |
|    |                                                               |
|    +-- validateInput(): check messages array, enforce limits       |
|    |                                                               |
|    +-- callLLMWithFallback(BATCH_SYSTEM, conversation)             |
|    |     |                                                         |
|    |     +-- Try OpenAI (primary)                                  |
|    |     +-- On failure: Try Gemini (fallback)                     |
|    |     +-- On failure: Return error                              |
|    |                                                               |
|    +-- extractJSON() + validateBatchResponse()                     |
|    |                                                               |
|    +-- Return { summary, messages[] }                              |
+-------------------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Location |
|-----------|---------------|-------------------|----------|
| **chatParser.js** | Parse raw text/files into structured `{sender, text, timestamp}[]` | InputPanel (called by), qwenAnonymizer (output fed to) | `mirrorchat/src/utils/chatParser.js` (NEW) |
| **qwenAnonymizer.js** | Strip PII from entire conversation text | chatParser (receives parsed text), api.js (feeds anonymized text) | `mirrorchat/src/utils/qwenAnonymizer.js` (EXISTING, no changes) |
| **api.js** | HTTP client for batch analysis endpoint | ChatAnalysis.jsx (called by), server.js (calls) | `mirrorchat/src/utils/api.js` (ADD function) |
| **ChatAnalysis.jsx** | Orchestrate parse -> anonymize -> analyze -> display | chatParser, qwenAnonymizer, api.js, ReportView components | `mirrorchat/src/pages/ChatAnalysis.jsx` (REWORK) |
| **ReportView components** | Render summary + per-message detail | ChatAnalysis (rendered by) | Inline in ChatAnalysis or extracted to `components/` |
| **/api/chat-batch** | Receive conversation, call LLM, return batch results | callLLMWithFallback, extractJSON | `mirrorchat/server.js` (ADD endpoint) |
| **callLLMWithFallback()** | OpenAI-first with Gemini fallback | OpenAI SDK, Google Generative AI SDK | `mirrorchat/server.js` (NEW function) |
| **BATCH_SYSTEM prompt** | Instruct LLM to classify each message in 4 abuse categories | /api/chat-batch handler | `mirrorchat/server.js` (NEW constant) |

## Data Flow

### Step 1: Input and Parsing

```
User provides raw text (paste or file upload)
  |
  v
chatParser.js: detectFormat(text) -> parse(text) -> messages[]
  |
  |  Input: raw string (WhatsApp export, plain text, or free-form)
  |
  |  Output: [
  |    { sender: "Marco", text: "Dove sei stata?", timestamp: "14:32", lineNumber: 1 },
  |    { sender: "Giulia", text: "Con le mie amiche", timestamp: "14:33", lineNumber: 2 },
  |    ...
  |  ]
  |
  v
Display parsed preview (message count, detected format, sender list)
```

**Parser format detection strategy:**

WhatsApp exports follow a consistent format across locales:
```
dd/mm/yy, HH:MM - Sender: Message text
```
or (newer exports):
```
[dd/mm/yy, HH:MM:SS] Sender: Message text
```

The parser should detect this pattern on the first 3 lines. If detected, parse as WhatsApp. Otherwise, fall back to line-by-line splitting (each line = one message, no sender attribution assumed).

For the fallback mode (plain text without timestamps), each line or paragraph becomes one "message." The user can manually indicate who is sender A vs sender B via a simple UI toggle, or the system defaults to alternating speakers.

### Step 2: Anonymization

```
messages[] (with real names)
  |
  v
Reconstruct full text (preserving message boundaries with markers)
  |
  v
qwenAnonymizer.js: anonymizeText(fullText) -> { anonymized, mappings }
  |
  |  Phone, email, address, date, URL, fiscal code, IBAN, license plate -> tokens
  |  Names are NOT anonymized by current qwenAnonymizer (intentional)
  |
  v
Re-split anonymized text back into messages using markers
  |
  v
Display anonymized preview
```

**Critical design decision:** The current `qwenAnonymizer.js` intentionally does NOT anonymize names -- it only strips structured PII (phone, email, address, etc.). Names are kept because the AI needs to understand conversational dynamics (who said what to whom). This is fine for the batch analysis use case: the LLM sees "Marco said X to Giulia" which is necessary for classifying manipulation patterns. The anonymization contract is: **no contact information reaches the LLM, but pseudonyms/first names are acceptable**.

If stricter anonymization is desired later, the parser can replace real names with `[PERSONA_1]`, `[PERSONA_2]` tokens at parse time and maintain a mapping. But this is not needed for the current milestone.

### Step 3: Batch Analysis (Server)

```
POST /api/chat-batch
  {
    messages: [
      { sender: "Marco", text: "Dove sei stata ieri sera?", index: 0 },
      { sender: "Giulia", text: "Con le mie amiche, te l'ho detto", index: 1 },
      ...
    ],
    genere_utente: "donna",
    persone: { "Marco": "uomo", "Giulia": "donna" },
    profile_context: "..."
  }
  |
  v
Server builds conversation string for LLM:
  "[1] Marco: Dove sei stata ieri sera?
   [2] Giulia: Con le mie amiche, te l'ho detto
   ..."
  |
  v
callLLMWithFallback(BATCH_SYSTEM, conversationString)
  |
  +-- Try OpenAI gpt-4o-mini
  |     |
  |     +-- Success -> extractJSON -> validate -> return
  |     +-- Failure (timeout, 429, 500, network) -> continue to fallback
  |
  +-- Try Gemini gemini-1.5-flash
  |     |
  |     +-- Success -> extractJSON -> validate -> return
  |     +-- Failure -> return error response
  |
  v
Response: {
  sommario: {
    pattern_principali: ["controllo", "colpevolizzazione"],
    gravita_media: 3.2,
    gravita_massima: 4,
    messaggio_piu_grave: 7,
    dinamica: "Il soggetto A esercita controllo progressivo..."
  },
  messaggi: [
    {
      indice: 0,
      testo_originale: "Dove sei stata ieri sera?",
      mittente: "Marco",
      categoria: "controllo",
      gravita: 3,
      spiegazione: "Domanda che implica obbligo di rendere conto..."
    },
    {
      indice: 1,
      testo_originale: "Con le mie amiche, te l'ho detto",
      mittente: "Giulia",
      categoria: "nessuna",
      gravita: 0,
      spiegazione: ""
    },
    ...
  ]
}
```

### Step 4: Report Display

```
API Response
  |
  v
ChatAnalysis.jsx stores result in state
  |
  +-- ConversationSummary (top card)
  |     - Overall severity gauge (gravita_massima)
  |     - Pattern chips (pattern_principali)
  |     - Narrative explanation (dinamica)
  |     - Message count + flagged count
  |
  +-- MessageList (scrollable)
  |     - Each message shown as a chat bubble
  |     - Left/right alignment based on sender
  |     - Color-coded border: teal (safe), amber (warning), coral (danger)
  |     - Expand to see: categoria, spiegazione
  |     - Messages with categoria=nessuna shown muted
  |
  +-- ResourcesBanner (if gravita_massima >= 3)
        - Existing support resources component
```

## Patterns to Follow

### Pattern 1: New Endpoint, Preserve Old

**What:** Add `POST /api/chat-batch` as a new endpoint. Do NOT modify the existing `POST /api/chat` endpoint.

**Why:** The single-message `/api/chat` is used by the existing flow and may be used by other consumers. The batch endpoint has a different input/output contract. Keeping both avoids breaking changes and allows the frontend to gracefully degrade.

**Implementation:**
```javascript
// server.js -- new endpoint alongside existing /api/chat
app.post('/api/chat-batch', async (req, res) => {
  try {
    const { messages, genere_utente, persone, profile_context } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Campo "messages" richiesto (array non vuoto)' });
    }
    if (messages.length > 200) {
      return res.status(400).json({ error: 'Massimo 200 messaggi per analisi' });
    }
    // ... build prompt, call LLM, return batch result
  } catch (err) { ... }
});
```

### Pattern 2: LLM Provider Fallback

**What:** A `callLLMWithFallback()` function that tries OpenAI first, falls back to Gemini on failure.

**Why:** OpenAI rate limits (429), transient errors, and outages are common. Gemini provides a reliable fallback at similar quality for this task.

**Implementation approach:**
```javascript
// Lazy Gemini client (mirrors existing lazy OpenAI pattern)
let _geminiModel = null;
function getGeminiModel() {
  if (!_geminiModel) {
    if (!process.env.GOOGLE_API_KEY) return null; // Fallback not available
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    _geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
  return _geminiModel;
}

async function callLLMWithFallback(systemPrompt, userMessage, maxTokens = 4096) {
  // Try OpenAI first
  try {
    return await callLLM(systemPrompt, userMessage); // existing function
  } catch (openaiErr) {
    console.warn('[LLM Fallback] OpenAI failed:', openaiErr.message);

    // Try Gemini
    const gemini = getGeminiModel();
    if (!gemini) throw openaiErr; // No fallback available, propagate original error

    try {
      const result = await gemini.generateContent({
        systemInstruction: systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: maxTokens }
      });
      const text = result.response.text();
      return extractJSON(text);
    } catch (geminiErr) {
      console.error('[LLM Fallback] Gemini also failed:', geminiErr.message);
      throw geminiErr;
    }
  }
}
```

**Key details:**
- Lazy initialization matches the existing pattern (`_openaiClient`, `_supabaseClient`, `_twilioClient`)
- `GOOGLE_API_KEY` is already in the env vars documentation but only used by the Python stack; this extends it to Node.js
- `gemini-1.5-flash` is fast and cost-effective, sufficient for classification tasks
- The fallback is graceful: if `GOOGLE_API_KEY` is not set, the function simply propagates the OpenAI error

### Pattern 3: Chat Parser as Pure Utility

**What:** `chatParser.js` is a pure function module with no side effects, no API calls, no state.

**Why:** Parsing is deterministic and testable. Keeping it pure makes it easy to unit test and reuse. The parser should never call the network.

**Implementation approach:**
```javascript
// mirrorchat/src/utils/chatParser.js

// WhatsApp format: "dd/mm/yy, HH:MM - Sender: Message"
const WA_LINE_RE = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-:]\s*([^:]+?):\s(.+)$/;

// WhatsApp system messages (group changes, encryption notices)
const WA_SYSTEM_RE = /^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/;

export function detectFormat(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const waMatches = lines.slice(0, 5).filter(l => WA_LINE_RE.test(l)).length;
  if (waMatches >= 2) return 'whatsapp';
  return 'plaintext';
}

export function parseConversation(text) {
  const format = detectFormat(text);
  if (format === 'whatsapp') return parseWhatsApp(text);
  return parsePlaintext(text);
}
```

### Pattern 4: Prompt Engineering for Batch Classification

**What:** A single LLM call that receives the full conversation and returns per-message classifications.

**Why:** Sending the entire conversation in one call (rather than N calls for N messages) provides:
1. **Context awareness** -- the LLM sees escalation patterns across messages
2. **Cost efficiency** -- one API call vs N calls
3. **Speed** -- one round trip vs N round trips
4. **Coherence** -- classifications are consistent within the conversation

**The prompt must produce structured JSON with both a summary and per-message detail.** The four abuse categories are:
- `gelosia` (jealousy/possessiveness)
- `violenza_verbale` (verbal violence/insults)
- `manipolazione` (gaslighting, guilt-tripping, love bombing)
- `limitazione_personale` (isolation, control, restriction of autonomy)

A message can have `nessuna` (no abuse detected) or one of the four categories. Severity is 0-5 per message (0 = no abuse, 5 = severe).

**Token budget consideration:** A 200-message conversation formatted as numbered lines is roughly 3000-5000 tokens input. The response with per-message classifications is roughly 4000-8000 tokens. Total stays well within gpt-4o-mini's 128K context window. Set `max_tokens: 8192` for the batch response to accommodate long conversations.

## Anti-Patterns to Avoid

### Anti-Pattern 1: N API Calls for N Messages

**What:** Calling `/api/chat` once per message in a loop.
**Why bad:** Slow (N round trips), expensive (N API calls), loses conversational context (each call is isolated -- cannot detect escalation patterns).
**Instead:** Single batch call with full conversation context. The LLM is better at pattern detection when it sees the whole conversation.

### Anti-Pattern 2: Client-Side Message Splitting After Anonymization

**What:** Anonymizing the full text, then trying to split it back into messages.
**Why bad:** Anonymization can alter message boundaries (e.g., replacing a name that spans a line break, or collapsing whitespace). Parsing must happen BEFORE anonymization.
**Instead:** Parse first, then anonymize the full text, then re-associate messages by index/marker.

### Anti-Pattern 3: Modifying the Existing /api/chat Endpoint

**What:** Extending `/api/chat` to handle both single and batch modes.
**Why bad:** Different input schemas, different output schemas, different token budgets, different error handling. Overloading one endpoint leads to fragile conditional logic.
**Instead:** New `/api/chat-batch` endpoint with its own prompt, validation, and response schema.

### Anti-Pattern 4: Over-Engineering the Parser

**What:** Trying to support every possible chat export format (Telegram JSON, Instagram DM export, iMessage, etc.).
**Why bad:** Scope creep. WhatsApp is the dominant messaging platform for Italian teenagers. Plain text covers everything else.
**Instead:** Support exactly two formats: WhatsApp `.txt` export and generic plain text. Add other parsers later if needed.

### Anti-Pattern 5: Streaming Partial Results

**What:** Using SSE/streaming to show message classifications as the LLM generates them.
**Why bad:** The LLM generates the entire JSON response at once; partial JSON is not useful. The response time for a batch of 200 messages is ~5-10 seconds, which is acceptable with a loading indicator.
**Instead:** Simple request-response with a progress indicator on the frontend.

## Detailed Data Schemas

### Input to /api/chat-batch

```typescript
interface BatchRequest {
  messages: Array<{
    sender: string;      // Parsed sender name (may be anonymized)
    text: string;        // Anonymized message text
    timestamp?: string;  // Optional, from WhatsApp parse
    index: number;       // 0-based position in conversation
  }>;
  genere_utente?: string;       // "donna" | "uomo" | "non_specificato"
  persone?: Record<string, string>;  // { "Marco": "uomo", "Giulia": "donna" }
  profile_context?: string;     // From profiler.js getProfileContext()
}
```

### Output from /api/chat-batch

```typescript
interface BatchResponse {
  sommario: {
    pattern_principali: string[];    // ["controllo", "manipolazione"]
    gravita_media: number;           // Average severity across flagged messages
    gravita_massima: number;         // Max severity in conversation
    messaggio_piu_grave: number;     // Index of most severe message
    messaggi_segnalati: number;      // Count of messages with categoria != "nessuna"
    messaggi_totali: number;         // Total message count
    dinamica: string;                // Narrative explanation of overall pattern
  };
  messaggi: Array<{
    indice: number;                  // Matches input index
    mittente: string;                // Sender name
    testo_originale: string;         // The anonymized text for this message
    categoria: "gelosia" | "violenza_verbale" | "manipolazione" | "limitazione_personale" | "nessuna";
    gravita: number;                 // 0-5
    spiegazione: string;             // Why this classification (empty if nessuna)
  }>;
  provider: "openai" | "gemini";     // Which LLM answered (for transparency)
}
```

### Conversation Summary Card (Frontend)

```typescript
interface SummaryCardProps {
  sommario: BatchResponse['sommario'];
}
// Renders: severity gauge, pattern chips, narrative, stats
```

### Message Card (Frontend)

```typescript
interface MessageCardProps {
  message: BatchResponse['messaggi'][number];
  isExpanded: boolean;
  onToggle: () => void;
}
// Renders: chat bubble with sender, text, severity indicator
// Expanded: shows categoria badge + spiegazione
```

## Message Limit and Chunking Strategy

**Hard limit:** 200 messages per batch request. This keeps the LLM input under ~5000 tokens and the output under ~8000 tokens, well within budget.

**Frontend enforcement:** The parser counts messages. If > 200, show a warning and truncate to the last 200 messages (most recent are most relevant for abuse pattern detection).

**No server-side chunking needed:** For conversations over 200 messages, the frontend truncates. The server does not need to split and merge -- that would add complexity without clear benefit at this scale.

## Build Order (Dependencies)

The components have a clear dependency chain. Build in this order:

### Phase 1: Foundation (no UI changes needed)

1. **chatParser.js** -- Pure utility, no dependencies. Can be built and tested in isolation.
2. **callLLMWithFallback()** + Gemini lazy client in server.js -- Infrastructure change, testable independently.
3. **BATCH_SYSTEM prompt** constant in server.js -- Just a string, but requires iteration.

### Phase 2: Backend Endpoint

4. **POST /api/chat-batch** endpoint -- Depends on #2 (fallback function) and #3 (prompt). Can be tested with curl/Postman before any frontend work.

### Phase 3: Frontend Pipeline

5. **api.js: analyzeChatBatch()** function -- Thin HTTP wrapper, depends on #4 existing.
6. **ChatAnalysis.jsx rework** -- The big integration. Depends on #1 (parser), #5 (API wrapper). This is where parse -> anonymize -> call -> display comes together.

### Phase 4: Profile Integration

7. **Settings.jsx: merge Profile** -- Independent of the batch analysis pipeline. Can be done in parallel with Phase 3 or after. Requires moving Profile.jsx UI into a collapsible section within Settings.

```
Dependency Graph:

chatParser.js ----+
                  |
                  +---> ChatAnalysis.jsx rework
                  |         |
api.js (batch) ---+         +---> Full pipeline working
                  |
callLLMWithFallback() --+
                        |
BATCH_SYSTEM prompt ----+--> /api/chat-batch endpoint
                        |
Gemini lazy client -----+

Settings + Profile merge (independent track)
```

## Scalability Considerations

| Concern | At 10 users/day | At 1K users/day | At 10K users/day |
|---------|-----------------|-----------------|-------------------|
| LLM API costs | Negligible (~$0.10/day) | ~$10/day with gpt-4o-mini | Consider batching quotas or switching to Gemini Flash as primary |
| Response time | 3-8s per analysis | Same (API-bound) | Same (each request is independent) |
| Token limits | No issue (200 msg fits easily) | No issue | No issue |
| Rate limits | No issue | May hit OpenAI tier limits; fallback covers this | Need higher tier API key or queue system |
| Server memory | Negligible | Negligible (stateless requests) | Negligible |

The architecture is stateless per-request. No server-side conversation storage is needed for analysis. Results are displayed and optionally saved client-side. This scales horizontally without architectural changes.

## Integration with Existing Features

### Profile Integration

The existing `extractFacts()` call in ChatAnalysis.jsx runs after single-message analysis. For batch analysis, it should run once after the full conversation is analyzed, using the conversation summary + most severe messages as input rather than individual messages. This provides richer context for fact extraction.

### Existing /api/chat Compatibility

The old single-message flow can remain as a "quick check" mode. The UI should default to batch analysis (the more useful mode) but can offer a simpler single-message mode for users who just want to check one text.

### Anonymization Pipeline

No changes to `qwenAnonymizer.js` are needed. The parser produces a full conversation text string, which is fed through the existing anonymization function. The anonymized text is then sent to the batch endpoint. The only new work is in `chatParser.js` (before anonymization) and the endpoint (after anonymization).

## Sources

- Codebase analysis: `mirrorchat/server.js`, `mirrorchat/src/pages/ChatAnalysis.jsx`, `mirrorchat/src/utils/api.js`, `mirrorchat/src/utils/qwenAnonymizer.js`, `mirrorchat/src/utils/profiler.js`, `mirrorchat/src/utils/anonymizer.js`, `mirrorchat/src/App.jsx`, `mirrorchat/package.json`
- Architecture docs: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`
- Project definition: `.planning/PROJECT.md`
- Python Gemini provider: `src/providers/gemini_client.py` (reference for JS port)
- OpenAI SDK: `openai` v6.33.0 (installed, chat.completions.create interface)
- Google Generative AI JS SDK: `@google/generative-ai` (to be installed for fallback)
- WhatsApp chat export format: Stable across versions, well-documented format with `dd/mm/yy, HH:MM - Sender: Message` pattern
- Confidence: HIGH -- all recommendations grounded in existing codebase patterns and established LLM integration practices

---

*Architecture research: 2026-03-29*
