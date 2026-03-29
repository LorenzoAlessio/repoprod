# Research Summary: MirrorChat Conversation Analysis

**Domain:** Chat abuse detection / multi-message conversation analysis for teen safety
**Researched:** 2026-03-29
**Overall confidence:** MEDIUM (codebase analysis is HIGH; version numbers and external ecosystem details are LOW due to web search unavailability)

## Executive Summary

MirrorChat needs three capabilities for this milestone: (1) parsing WhatsApp .txt exports into structured message arrays, (2) an AI model fallback so Gemini handles requests when OpenAI fails, and (3) batch conversation analysis where a single LLM call classifies each message across 4 abuse categories. The research finds that all three can be achieved with minimal new dependencies -- only `@google/generative-ai` needs to be added to package.json.

The WhatsApp parser should be a custom ~50-line regex module, not an npm library. The format is simple and predictable for Italian-locale exports, and the codebase already has a strong pattern of custom regex utilities (see `qwenAnonymizer.js` with 180+ lines of regex parsers for addresses, phones, emails, fiscal codes, and IBANs). A library dependency for this is unnecessary overhead.

The AI fallback is a straightforward try/catch pattern wrapping two provider calls. No routing library, no circuit breaker, no LangChain -- just `try OpenAI, catch -> try Gemini, catch -> error`. The existing lazy-initialization pattern in `server.js` (see `getOpenAIClient()`) extends naturally to a `getGeminiModel()` equivalent.

The batch analysis leverages OpenAI Structured Outputs (`response_format` with `json_schema`) to guarantee valid per-message JSON. This eliminates the fragile `extractJSON()` brace-matching currently used. For the Gemini fallback, the equivalent is `responseMimeType: "application/json"` with `responseSchema`. A conversation of up to 300 messages fits comfortably in gpt-4o-mini's 128K context window in a single call.

## Key Findings

- **Stack addition:** Only 1 new npm package: `@google/generative-ai` (Google's official Gemini Node.js SDK). Verify current version with `npm view` before installing -- training data suggests ~0.24.x but this changes frequently.
- **WhatsApp parsing:** Build custom, don't install. Italian format is `dd/mm/yy, HH:MM - Sender: Message`. Handle multiline messages, system messages, and media placeholders. ~50 lines of code.
- **AI fallback:** Simple try/catch pattern. No library needed. Reuse existing `GOOGLE_API_KEY` env var (already documented but only used by Python stack).
- **Batch analysis:** One LLM call per conversation using OpenAI Structured Outputs. Output is `{ riepilogo: {...}, messaggi: [{indice, categoria, gravita, spiegazione}...] }`. The 4 categories are: gelosia, violenza_verbale, manipolazione, limitazione_personale.
- **Critical architecture rule:** Parse FIRST, then anonymize. Never anonymize raw text and then try to parse WhatsApp format from it -- anonymization destroys the timestamp/sender tokens the parser needs.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation: Parser + Fallback Infrastructure** - Low risk, unblocks everything
   - Build `whatsappParser.js` (client-side, pure function)
   - Add `@google/generative-ai`, create `getGeminiModel()` + `callLLMWithFallback()` in server.js
   - Addresses: WhatsApp .txt parsing, AI model fallback
   - Avoids: Pitfall 2 (format variance) by testing with real Italian exports early

2. **Core: Batch Analysis Endpoint** - Highest complexity, highest value
   - Build `POST /api/chat-conversation` with CONVERSATION_ANALYSIS system prompt
   - Implement OpenAI Structured Outputs with `json_schema`
   - Add `analyzeConversation()` to api.js
   - Addresses: Per-message classification, conversation summary, structured output
   - Avoids: Pitfall 1 (token explosion) by setting max_tokens: 4096+, Pitfall 6 (schema drift) by using structured outputs

3. **Report: UI for Results Display** - Standard React work
   - Two-tier report: summary card + scrollable per-message list
   - Severity color-coding (existing brand palette)
   - Expand/collapse per-message detail
   - Addresses: Report layout, severity visualization, loading states

4. **Integration: Profile Merge + Polish** - Independent track, can parallelize
   - Merge Profile page into Settings as collapsible section
   - Educational deep links from detected categories to Learn page
   - Addresses: Profile integration requirement from PROJECT.md

**Phase ordering rationale:**
- Phase 1 before 2: The LLM endpoint needs the fallback infrastructure; parsing must exist before the frontend can feed conversations to the API
- Phase 2 before 3: The UI cannot be designed until the API response schema is finalized
- Phase 4 is independent: Profile-Settings merge has no dependency on conversation analysis

**Research flags for phases:**
- Phase 2: Needs iteration on prompt engineering. The exact system prompt for 4-category classification with Italian teen conversation context will require testing and refinement. Structured Outputs schema must be defined carefully.
- Phase 1: Standard implementation. No further research needed.
- Phase 3: Standard React UI. No research needed.
- Phase 4: Verify Gemini SDK version at implementation time (LOW confidence on exact API surface).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Recommendations sound but `@google/generative-ai` version unverified; Gemini model names (gemini-2.0-flash) may have changed |
| Features | HIGH | Feature requirements clearly specified in PROJECT.md; feature landscape well-understood from codebase |
| Architecture | HIGH | Batch-intelligent approach validated against codebase patterns; clear extension points in server.js |
| Pitfalls | HIGH | 14 pitfalls identified with concrete prevention strategies; the most critical (token explosion, format variance, anonymization breakage) are well-understood |

## Gaps to Address

- `@google/generative-ai` current version -- must verify with `npm view` before installing
- Gemini model name -- `gemini-2.0-flash` vs `gemini-1.5-flash` vs something newer; verify at implementation time
- WhatsApp export format for Italian iOS vs Android in 2026 -- need a real export file to test against
- Optimal chunk size for very long conversations (>300 messages) -- may not be needed if gpt-4o-mini context window is sufficient, but should be validated
- Exact Structured Outputs `json_schema` syntax for the OpenAI SDK v6.33+ -- the feature exists but the exact parameter format should be verified against current docs

## Files Created

| File | Purpose |
|------|---------|
| `.planning/research/SUMMARY.md` | This file -- executive summary with roadmap implications |
| `.planning/research/STACK.md` | Technology recommendations: custom WhatsApp parser, @google/generative-ai, OpenAI Structured Outputs |
| `.planning/research/FEATURES.md` | Feature landscape: table stakes, differentiators, anti-features, MVP recommendation |
| `.planning/research/ARCHITECTURE.md` | System architecture: data flow, component boundaries, patterns, anti-patterns |
| `.planning/research/PITFALLS.md` | 14 domain pitfalls with severity ratings and prevention strategies |
