# Requirements: MirrorChat — Conversation Analysis Milestone

**Defined:** 2026-03-29
**Core Value:** Teenagers can identify manipulative and abusive behaviors by analyzing chat conversations with per-message classification and clear reports.

## v1 Requirements

### Conversation Parsing

- [ ] **PARSE-01**: User can paste raw conversation text into a text area for analysis
- [ ] **PARSE-02**: User can upload a WhatsApp .txt export file for analysis
- [ ] **PARSE-03**: System auto-detects if input is WhatsApp export format or generic text
- [ ] **PARSE-04**: WhatsApp parser extracts sender, timestamp, and message text per line (Italian locale, iOS + Android)
- [ ] **PARSE-05**: Parser handles multi-line messages and filters system messages

### Analysis Pipeline

- [ ] **ANLZ-01**: Conversation is anonymized via Python script before reaching AI (parse first, anonymize second)
- [ ] **ANLZ-02**: Batch-intelligent analysis — entire conversation sent to AI in one call, AI classifies each message individually
- [ ] **ANLZ-03**: Each message classified into 4 abuse categories: Gelosia, Violenza verbale, Manipolazione, Limitazione personale
- [ ] **ANLZ-04**: Each message receives a gravity score (1-5)
- [ ] **ANLZ-05**: OpenAI is the primary AI model; Gemini is used as fallback when OpenAI fails
- [ ] **ANLZ-06**: AI response uses structured output format (JSON schema) for reliable parsing

### Report

- [ ] **RPRT-01**: Report displays a summary section at the top with overall patterns, severity distribution, and category counts
- [ ] **RPRT-02**: Report displays per-message detail below the summary — each message with original anonymized text, classification, gravity, and explanation
- [ ] **RPRT-03**: Messages are color-coded by severity using brand palette (teal 1-2, amber 3, coral 4-5)
- [ ] **RPRT-04**: Red flag highlights — messages with gravity 4-5 are prominently displayed in the summary section
- [ ] **RPRT-05**: Each detected category links to the corresponding educational content on the Learn page

### Profile Integration

- [ ] **PROF-01**: Profile section is integrated inside the Settings page (below existing settings, with "Modifica Profilo" button)
- [ ] **PROF-02**: All current profile fields (genere, età, partner, relazione, figli, vive_con, studia, lavora, stato_emotivo, isolamento) are available in the Settings-integrated profile
- [ ] **PROF-03**: Profile edit/save flow works inline within Settings (no separate page navigation)

## v2 Requirements

### Enhanced Analysis

- **ANLZ-V2-01**: Multi-label classification — a single message can be flagged under multiple abuse categories simultaneously
- **ANLZ-V2-02**: Escalation pattern detection — detect if abuse pattern worsens over the course of the conversation
- **ANLZ-V2-03**: Conversation length indicator with truncation warning for very long chats (>200 messages)

### Enhanced Report

- **RPRT-V2-01**: Timeline visualization showing severity progression across the conversation
- **RPRT-V2-02**: Export report as PDF or shareable link
- **RPRT-V2-03**: Comparison between multiple conversation analyses over time

### Route Cleanup

- **PROF-V2-01**: Remove separate /profile route from router after migration confirmed stable

## Out of Scope

| Feature | Reason |
|---------|--------|
| Image/screenshot OCR of chats | High complexity, text-only for this milestone |
| Real-time chat monitoring | Only explicit user-initiated analysis |
| Social media API auto-import | Manual upload only, no WhatsApp/Telegram API |
| Multi-language support | Italian only |
| Per-message individual API calls | Too slow and expensive — batch approach chosen |
| Circuit breaker / advanced failover | Simple try/catch fallback is sufficient for 2 providers |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PARSE-01 | Pending | Pending |
| PARSE-02 | Pending | Pending |
| PARSE-03 | Pending | Pending |
| PARSE-04 | Pending | Pending |
| PARSE-05 | Pending | Pending |
| ANLZ-01 | Pending | Pending |
| ANLZ-02 | Pending | Pending |
| ANLZ-03 | Pending | Pending |
| ANLZ-04 | Pending | Pending |
| ANLZ-05 | Pending | Pending |
| ANLZ-06 | Pending | Pending |
| RPRT-01 | Pending | Pending |
| RPRT-02 | Pending | Pending |
| RPRT-03 | Pending | Pending |
| RPRT-04 | Pending | Pending |
| RPRT-05 | Pending | Pending |
| PROF-01 | Pending | Pending |
| PROF-02 | Pending | Pending |
| PROF-03 | Pending | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19 ⚠️

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after initial definition*
