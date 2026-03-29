# Feature Landscape

**Domain:** Chat abuse detection / multi-message conversation analysis for teen safety
**Researched:** 2026-03-29
**Overall confidence:** MEDIUM (based on domain expertise + codebase analysis; WebSearch unavailable for market validation)

## Current State

MirrorChat currently supports **single-message analysis**: user pastes one message, it gets anonymized, and the LLM returns a single technique classification with severity 1-5. The planned milestone shifts to **full conversation analysis** where an entire chat export (potentially hundreds of messages) is analyzed with per-message abuse classification across 4 categories.

### Existing capabilities:
- Single-message manipulation detection (7 technique types + "nessuna")
- Client-side anonymization (Qwen NER + regex fallback)
- Severity rating 1-5 with color coding (teal/amber/coral)
- Suggested assertive responses
- Crisis resource display at severity >= 3
- Background fact extraction (profiler) building longitudinal risk profile
- Educational content on 7 manipulation techniques

### Gap to fill:
The current system cannot analyze a **conversation** (multi-message, multi-speaker dialogue). It has no notion of conversation-level patterns, escalation trajectories, or per-message classification across the 4 planned abuse categories (Gelosia, Violenza verbale, Manipolazione, Limitazione personale).

---

## Table Stakes

Features users expect from a conversation analysis tool. Missing any of these = product feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-message input** (paste + file upload) | WhatsApp .txt export is the primary real-world input format; teens copy-paste or export chat logs | Low | Already partially exists: file upload reads .txt. Need WhatsApp-specific parsing (timestamp + sender extraction) |
| **Conversation parsing** (split into individual messages with speaker attribution) | Users expect the tool to understand who said what; raw text blob analysis is useless for per-message classification | Medium | WhatsApp exports follow `[DD/MM/YY, HH:MM:SS] Name: message` format. Must handle multiline messages, media placeholders, system messages |
| **Per-message abuse classification** | This IS the core value proposition -- each message tagged with what abuse pattern it represents | High | 4 categories: Gelosia, Violenza verbale, Manipolazione, Limitazione personale. Each message may have 0, 1, or multiple flags. Must return structured data per message |
| **Conversation-level summary** | Users need the "so what" -- overall pattern assessment, not just raw per-message data | Medium | Summary section: dominant patterns, severity trajectory, escalation assessment, overall risk level |
| **Severity visualization per message** | Color-coding messages by danger level is the most intuitive way to show "which messages are problematic" | Low | Reuse existing brand colors: teal (safe), amber (warning), coral (danger). Apply inline to each message in the report |
| **Anonymization of full conversation** | Privacy requirement (non-negotiable per PROJECT.md). Must anonymize entire conversation before LLM sees it | Medium | Existing Qwen anonymizer works per-text-block. Need to handle multi-speaker conversations where the same person appears across many messages consistently (same anonymized token throughout) |
| **Clear report layout** (summary on top, detail below) | Users scan top-level findings first, drill into specifics second. This is standard for any analysis report | Medium | Two-tier: executive summary card (patterns, severity, risk) + scrollable per-message detail list |
| **Loading state for long conversations** | Multi-message analysis takes significantly longer than single-message; users will think the app is broken without progress indication | Low | Progress bar or message-count indicator ("Analyzing 47 messages..."). Current single-message spinner is insufficient |
| **Error handling for large conversations** | WhatsApp exports can be thousands of messages; LLM context windows have limits; API calls can timeout | Medium | Must batch conversations (e.g., chunks of 30-50 messages) or truncate intelligently. Show clear feedback if conversation is too long |
| **Original text reference in report** | Each classified message must show the original (anonymized) text so the user can see exactly which message triggered which classification | Low | Already specified in PROJECT.md requirements. Display anonymized original alongside classification |

## Differentiators

Features that set MirrorChat apart from generic content moderation tools. Not expected by default, but create significant value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Escalation trajectory visualization** | Show how abuse patterns intensify over time -- this is what distinguishes "a bad day" from "a pattern of abuse". Uniquely valuable for teens who normalize gradual escalation | Medium | Timeline or sparkline showing severity progression across the conversation. Helps users see the "boiling frog" pattern |
| **Pattern co-occurrence analysis** | Identify when multiple abuse types combine (e.g., jealousy + isolation = classic controlling dynamic). Most tools classify independently | Medium | Cross-reference the 4 categories. Flag compound patterns: "This conversation shows jealousy-driven isolation, a recognized escalation pattern" |
| **Suggested responses per-message** | Existing single-message feature provides 2-3 assertive responses. Extending this to key problematic messages in a conversation gives actionable next steps | Medium | Only for the most severe messages (top 3-5 by severity), not every message. Keeps the report focused |
| **Conversation comparison over time** | Allow users to analyze multiple conversations and track whether the dynamic is improving or worsening | High | Requires conversation history storage (Supabase). Shows trend across sessions. Powerful for recognizing long-term patterns but adds significant complexity |
| **Speaker role detection** | Automatically identify which speaker is the user vs. the other party, without the user having to specify | Medium | WhatsApp exports include sender names. After anonymization, can still distinguish PERSONA_1 vs PERSONA_2. LLM can infer who is the potential victim based on message content |
| **"Red flag moments" highlights** | Rather than making the user read every message, highlight the 3-5 most concerning messages with explanations | Low | Filter per-message results to highest severity, show as a "quick summary" section. Very helpful for long conversations |
| **Contextual educational links** | When a specific abuse category is detected, deep-link to the corresponding Learn page content | Low | Already have 7 educational cards in `education.js`. Map detected categories to relevant cards. Low effort, high educational value |
| **Export/share report** | Allow users to save or share the analysis report (PDF, screenshot, or link) for showing a counselor, trusted adult, or friend | Medium | Generate a shareable summary. Must carefully exclude any PII. Useful for the "show this to someone you trust" use case |
| **Gemini fallback for reliability** | OpenAI primary, Gemini secondary. Prevents dead ends when OpenAI is rate-limited or down | Medium | Already in PROJECT.md requirements. Requires adding google-generative-ai to Node.js stack, mirroring callLLM logic with provider switching |
| **Batch-intelligent analysis** (single LLM call, per-message output) | Send the full conversation in one LLM call rather than one call per message. Dramatically cheaper and gives the LLM conversation context for better classification | High | This is the core architectural decision. One well-structured prompt that returns a JSON array of per-message classifications. Tradeoff: requires careful prompt engineering and robust JSON parsing for potentially large output |

## Anti-Features

Features to explicitly NOT build. Each would harm the product, the users, or both.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time chat monitoring / interception** | Violates privacy, creates surveillance dynamic, legally problematic for minors, technically requires device access. Turns a safety tool into a spying tool | Keep explicit user-initiated analysis only. User chooses what to analyze, when. Already in PROJECT.md Out of Scope |
| **Perpetrator identification / naming** | Labeling someone as an "abuser" based on chat analysis is dangerous, could be weaponized, and the LLM is not qualified to make that determination | Identify **patterns and techniques**, not people. "This message uses manipulation" not "This person is manipulative" |
| **Automated reporting to authorities** | Mandatory reporting logic is legally complex, varies by jurisdiction, can traumatize the victim who is not ready, and AI classification is not reliable enough for legal action | Show crisis resources (1522, Telefono Azzurro). Encourage talking to a trusted adult. Never auto-report |
| **Confidence score per classification** | Showing "83% confident this is manipulation" creates false precision, makes teens argue with the number rather than reflect on the pattern | Use categorical severity levels (1-5) and clear language. "This shows signs of jealousy" not "78% probability of jealousy" |
| **Social media API integration** (auto-import from WhatsApp/Telegram/Instagram) | APIs are restricted, require OAuth that teens cannot authorize properly, creates data pipeline liability, and the value of explicit user action (choosing what to analyze) is part of the therapeutic process | Manual copy-paste and file upload only. Already in PROJECT.md Out of Scope |
| **Chat between users** (social features) | Transforms a safety tool into a social platform, creates moderation liability, and distracts from the core mission | MirrorChat is an analysis tool, not a communication platform |
| **Diagnosis or clinical labels** | "You are in an abusive relationship" is a clinical determination that requires professional context the LLM does not have | Use educational framing: "This message contains patterns associated with [technique]. Here's what that means and what you can do" |
| **Per-message analysis (one LLM call per message)** | For a 200-message conversation, this means 200 API calls: slow, expensive, and the LLM loses conversation context | Use batch-intelligent analysis: send full (chunked if needed) conversation, get structured per-message classification in a single response |
| **Image/screenshot OCR** | Adds complexity (OCR pipeline), quality is unreliable on chat screenshots, and text input covers the primary use case | Text-only input for this milestone. OCR can be a future enhancement. Already in PROJECT.md Out of Scope |
| **Storing raw conversation text** | Massive privacy liability. If Supabase is breached, all user conversations are exposed | Store only analysis results (classifications, severity scores) and anonymized summaries if needed for comparison features. Never persist the original or anonymized conversation text beyond the session |

## Feature Dependencies

```
WhatsApp Parsing ──────────────────────────┐
                                            ▼
Multi-message Input ───> Conversation ───> Full-conversation ───> Per-message ───> Report
(paste + file upload)    Parsing           Anonymization          Classification   Generation
                         (split into                              (4 categories)
                         individual msgs)
                                                                       │
                                                                       ▼
                                                            Conversation Summary
                                                            (patterns, severity,
                                                             escalation trajectory)
                                                                       │
                                                                       ▼
                                                             Report Layout
                                                             (summary + detail)
                                                                       │
                                           ┌───────────────────────────┤
                                           ▼                           ▼
                                   Severity Visualization      Red Flag Highlights
                                   (color per message)         (top 3-5 messages)
                                                                       │
                                                                       ▼
                                                            Educational Deep Links
                                                            (link to Learn page)

Profile Integration ──> Settings Page ──> "Modifica Profilo" button
(merge /profile         (add profile     (shows FACT_LABELS
 into Settings)          section)          + narrative sections)

Gemini Fallback ──────> callLLM refactor ──> Provider switching logic
                        (try OpenAI,         (shared response schema)
                         catch → Gemini)

Batch-intelligent Analysis ──> Prompt Engineering ──> Robust JSON parsing
(one call, structured         (structured output     (handle large arrays,
 per-message output)           with conversation      partial responses,
                                context)               chunking for long convos)
```

### Critical Path

The critical dependency chain is:

1. **Conversation Parsing** -- nothing works without splitting text into messages
2. **Full-conversation Anonymization** -- privacy gate; no LLM call happens without this
3. **Batch-intelligent LLM Analysis** -- the core classification logic
4. **Report Generation** -- the user-facing output

Everything else (escalation viz, educational links, export, fallback) builds on top of this chain.

## MVP Recommendation

### Must ship (Phase 1 - Core conversation analysis):

1. **WhatsApp .txt parsing** -- parse `[DD/MM/YY, HH:MM] Name: message` format into structured message array with speaker attribution
2. **Full-conversation anonymization** -- extend existing Qwen anonymizer to handle multi-message conversations with consistent speaker token mapping
3. **Batch-intelligent per-message classification** -- one LLM call with the full anonymized conversation, returning per-message classifications across the 4 abuse categories
4. **Two-tier report layout** -- summary card on top (dominant patterns, overall severity, escalation assessment) + scrollable per-message detail below (each message with its text, classifications, severity color)
5. **Loading state for long analysis** -- progress indicator showing the analysis is working

### Must ship (Phase 2 - Integration and reliability):

6. **Profile integration into Settings** -- merge the existing Profile page into the Settings page as a "Modifica Profilo" section
7. **Gemini fallback** -- add Google Generative AI to Node.js, implement provider switching in `callLLM`
8. **Red flag highlights** -- surface the top 3-5 most concerning messages prominently

### Defer:

- **Conversation comparison over time**: Requires conversation history persistence, UI for comparison view, and raises privacy questions about storing analysis results. Valuable but high complexity, not needed for MVP.
- **Export/share report**: Useful but secondary to the core analysis experience. Can add after the core report is solid.
- **Escalation trajectory visualization**: Nice visual but the summary section (which describes escalation in text) covers the same ground more simply for V1.

## Category Taxonomy Notes

The PROJECT.md specifies 4 abuse categories for the new multi-message analysis:

| Category | Italian | Maps to existing education.js | Notes |
|----------|---------|-------------------------------|-------|
| Jealousy | Gelosia | `controllo-digitale` (partial overlap) | Possessive jealousy, checking phone, monitoring social media. Distinct from but related to digital control |
| Verbal violence | Violenza verbale | `svalutazione`, `colpevolizzazione` | Insults, yelling, name-calling, humiliation. More overt than manipulation |
| Manipulation | Manipolazione | `gaslighting`, `love-bombing`, `idealizzazione-devalutazione` | Psychological tactics to control perception, emotions, and behavior |
| Personal limitation | Limitazione personale | `isolamento` | Restricting autonomy: who they can see, where they can go, what they can do |

This is a **simplification** from the current 7-technique taxonomy to 4 broader categories. The simplification makes sense for conversation-level analysis where distinguishing between, say, gaslighting and love-bombing for every individual message in a 100-message conversation creates noise rather than clarity. The 4 categories are more actionable for the teen audience.

**Recommendation:** Keep the 7-technique taxonomy for the educational Learn page (depth), use the 4-category taxonomy for conversation analysis (breadth). The per-message classification can note which specific sub-technique within each category is present for users who want to learn more.

## WhatsApp Export Format Notes

WhatsApp exports follow predictable formats that vary by locale:

```
Italian format:
[DD/MM/YY, HH:MM:SS] NomeMittente: testo del messaggio

System messages (no colon after name):
[DD/MM/YY, HH:MM:SS] I messaggi e le chiamate sono crittografati end-to-end...
[DD/MM/YY, HH:MM:SS] NomeMittente ha cambiato il numero di telefono...

Media placeholders:
[DD/MM/YY, HH:MM:SS] NomeMittente: <Media omessi>

Multiline messages:
[DD/MM/YY, HH:MM:SS] NomeMittente: prima riga del messaggio
continua nella riga successiva
e anche qui
```

The parser must:
1. Identify message boundaries (new timestamp = new message)
2. Handle multiline messages (lines without timestamp prefix belong to previous message)
3. Filter system messages and media placeholders
4. Extract sender names consistently for speaker attribution
5. Handle the anonymization mapping: real sender names become PERSONA_1, PERSONA_2, etc.

## Prompt Engineering Considerations

The batch-intelligent analysis requires a well-structured prompt that:

1. **Receives** the full anonymized conversation as a numbered list of messages with speaker tags
2. **Returns** a JSON object with:
   - `sommario`: overall patterns, severity, escalation assessment
   - `messaggi`: array of per-message classifications, each with:
     - `indice`: message index (for mapping back to original)
     - `categorie`: array of detected categories (from the 4)
     - `gravita`: severity 1-5
     - `spiegazione`: brief explanation of why this message is flagged
3. **Handles** messages with no abuse (most messages in a conversation are benign -- must not over-flag)
4. **Understands** context: a message like "dove sei?" is benign in isolation but controlling in the context of 20 previous jealousy messages

The prompt should instruct the LLM to:
- Only flag messages that genuinely show abuse patterns (minimize false positives)
- Consider conversation context (a pattern of 5 mild messages > 1 moderate message)
- Return empty `categorie` array for benign messages
- Focus severity ratings on the conversation-level pattern, not just individual message content

## Sources

- Codebase analysis: `mirrorchat/server.js`, `mirrorchat/src/pages/ChatAnalysis.jsx`, `mirrorchat/src/utils/profiler.js`, `mirrorchat/src/data/education.js`, `mirrorchat/src/data/examples.js`
- PROJECT.md requirements and constraints
- ARCHITECTURE.md current system design
- Domain expertise: abuse detection UX patterns, conversation analysis products (Bark, Qustodio, Perspective API), educational psychology for teen audiences
- WhatsApp export format: standard across iOS/Android WhatsApp clients, locale-dependent timestamp format
- Note: WebSearch was unavailable; market/competitor validation based on training data. Confidence downgraded accordingly.
