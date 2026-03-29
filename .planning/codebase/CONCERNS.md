# Codebase Concerns

**Analysis Date:** 2026-03-29

## Security Concerns

**No API authentication/authorization on endpoints:**
- Issue: All endpoints in `mirrorchat/server.js` lack request authentication. Any user can call `/api/emergency/call`, `/api/emergency/sms`, `/api/chat`, `/api/voice`, `/api/profile` without proving they own the data.
- Files: `mirrorchat/server.js` (lines 196-542)
- Impact: Malicious users can trigger false emergency calls/SMS to arbitrary contacts, or analyze arbitrary messages claiming they belong to other users. This is critical for a safety app.
- Fix approach: Implement JWT/session-based auth. Client must send valid token in `Authorization` header. Server validates token before processing request. Verify userId in request body matches authenticated user.

**Unvalidated phone numbers in emergency calls:**
- Issue: Phone numbers from `req.body.contacts` are passed directly to Bland.ai and Twilio without validation. Invalid format, invalid country code, or malicious values could cause errors or abuse.
- Files: `mirrorchat/server.js` (lines 481-505, 508-542)
- Impact: Twilio/Bland.ai API errors, wasted credits, potential for SMS/call injection attacks.
- Fix approach: Validate phone format before passing to external APIs. Use regex to ensure E.164 format (e.g., `+1234567890`). Reject invalid numbers with 400 error.

**Sensitive error details exposed to client:**
- Issue: Server returns full error messages and stack traces to client (e.g., `res.status(500).json({ error: err.message })`). This leaks internal structure and configuration details.
- Files: `mirrorchat/server.js` (lines 221, 259, 361, 410, 427, 476, 503, 540)
- Impact: Attackers can learn about internal systems (Python script errors, database structure, API names).
- Fix approach: Log full error details server-side with unique error IDs. Return generic messages to client: `{ error: 'Internal error: ERR_12345' }`. Client should display user-friendly message.

**Bland.ai API key in plaintext:**
- Issue: `process.env.BLAND_AI_API_KEY` is used directly in fetch Authorization header (line 324) without any protection or rotation mechanism.
- Files: `mirrorchat/server.js` (line 324)
- Impact: If server logs are compromised or key is accidentally committed, attacker has full access to make emergency calls on your account.
- Fix approach: Use environment variable management with secret rotation. Implement rate limiting per user to prevent abuse. Consider server-side proxy that doesn't expose API key to client.

**No rate limiting on API endpoints:**
- Issue: Clients can spam `/api/chat`, `/api/voice`, `/api/voice-realtime`, `/api/anonymize` with unlimited requests without throttling.
- Files: `mirrorchat/server.js` (all POST endpoints)
- Impact: DOS attack, excessive API costs (OpenAI, ElevenLabs), user data stored at unlimited scale in localStorage.
- Fix approach: Implement rate limiting middleware using `express-rate-limit`. Set per-IP or per-user limits. Return 429 Too Many Requests when exceeded.

**LLM prompt injection vulnerability:**
- Issue: User-provided `message` (chat analysis) and `transcript` (voice analysis) are injected directly into system prompts without sanitization.
- Files: `mirrorchat/server.js` (lines 256, 279)
- Impact: Attacker can craft messages that escape the system prompt and cause LLM to ignore safety instructions or reveal system configuration.
- Fix approach: Use templating with escaping (e.g., replace `{`, `}`, newlines in user input). Add prefix/suffix markers around user input. Use separate message role for user input (already done in `messages` array, but content is not escaped).

**Python anonymizer untrusted input handling:**
- Issue: `server.js` spawns Python subprocess with stdin pipe, but has limited timeout (8s) and stderr capture. If Python script is compromised or malicious, it can write to stderr/stdout and hang the process.
- Files: `mirrorchat/server.js` (lines 92-135)
- Impact: DOS via resource exhaustion, information disclosure from Python stderr, potential RCE if Python script path can be manipulated.
- Fix approach: Add `maxBuffer` limit to process spawn. Use absolute path only (already done). Validate `scriptPath` cannot traverse directories. Kill process more aggressively on timeout.

**localStorage data not encrypted:**
- Issue: Sensitive data is stored in plaintext localStorage: `mirrorUser` (contains user ID and name), `mirrorContacts` (emergency contacts with full phone numbers), `mirrorShortcut`, facts extracted from conversations.
- Files: `mirrorchat/src/pages/Onboarding.jsx`, `mirrorchat/src/pages/SafeVoice.jsx`, `mirrorchat/src/utils/emergency.js`, `mirrorchat/src/utils/profiler.js`
- Impact: If device is stolen or browser storage is accessed via XSS, attacker can see all contacts and personal facts.
- Fix approach: Do not store sensitive data in localStorage. Use sessionStorage for temporary session data. Consider encryption layer if persistent storage is needed. Implement auto-logout on inactivity.

**JSON.parse without validation in multiple places:**
- Issue: Multiple calls to `JSON.parse(localStorage.getItem(...) || '{}')` with default fallback, but no validation that returned data has expected structure.
- Files: `mirrorchat/src/pages/SafeVoice.jsx` (line 19, 250), `mirrorchat/src/pages/Onboarding.jsx` (line 58), `mirrorchat/src/utils/emergency.js` (line 14), `mirrorchat/src/pages/Profile.jsx` (line 52, 58, 89)
- Impact: If localStorage is corrupted or maliciously modified, app can crash or behave unexpectedly. Contacts array expected to be array but could be object.
- Fix approach: Add type guards after parsing. Example: `const contacts = Array.isArray(arr) ? arr : []`. Use Zod or similar for schema validation.

---

## Tech Debt & Code Quality

**Inconsistent error handling patterns:**
- Issue: Some endpoints return `{ error: string }`, others return `{ error: true }`, others return `{ error: boolean }`. Fallback behavior differs (some catch and log, others throw).
- Files: `mirrorchat/server.js` (lines 155-180, 221-224, 258-269, 281-290, 360-362, 410-412, 427-428, 476)
- Impact: Frontend error handling is fragile. Inconsistent API contract makes integration error-prone.
- Fix approach: Define strict error response schema: `{ error: { code: string, message: string } }`. Use consistent try/catch pattern. Create `ApiError` class with code enum.

**Magic numbers and hardcoded constants scattered throughout:**
- Issue: Timeouts (8000ms in Python spawner), thresholds (max_tokens: 1024), emergency countdown (5s), danger level (30000ms window), frequency bar count (16), chunk interval (99999ms dummy), base64 limit (10mb).
- Files: `mirrorchat/server.js` (lines 26, 46, 108, 1024, 2048), `mirrorchat/src/pages/SafeVoice.jsx` (lines 9, 10, 98, 31)
- Impact: Hard to tune behavior without code search. Inconsistent across client/server (e.g., 30000ms window in both but not documented as sync'd).
- Fix approach: Define `constants.js` in both server and client with named exports. Document each constant with rationale. Use constants consistently.

**Anonymous LLM responses not validated against schema:**
- Issue: `callLLM()` calls `extractJSON()` which naively finds first `{` and last `}` in response. If LLM returns malformed JSON or JSON with wrong shape, it throws but response shape is not validated.
- Files: `mirrorchat/server.js` (lines 35-54)
- Impact: LLM might return `{ error: "..." }` instead of expected `{ tecnica, traduzione, ... }`, causing client UI to break. Type safety lost.
- Fix approach: Use Zod/io-ts to validate response shape. Throw with specific error if schema mismatch. Log schema mismatch for monitoring. Provide fallback response if validation fails.

**Danger threshold algorithm not synchronized:**
- Issue: `shouldTriggerAlert()` is implemented client-side in `mirrorchat/src/utils/emergency.js` and also server-side in CLAUDE.md, but could drift if one is updated without the other.
- Files: `mirrorchat/src/utils/emergency.js` (lines 3-11) vs CLAUDE.md (not in code)
- Impact: Client and server may have different thresholds. Emergency call might trigger on client but not be confirmed by server, or vice versa.
- Fix approach: Remove duplicate logic. Keep algorithm in one place (preferably client for real-time responsiveness). If server needs to confirm, use same constants imported from shared module. Document algorithm with test cases.

**Python anonymizer may fail silently on edge cases:**
- Issue: Python regex patterns are not tested against malformed Italian text. Example: text with emoji, RTL text, multiple spaces, etc. Timeout at 8s might be too tight if text is very large.
- Files: `mirrorchat/scripts/anonymize.py` (lines 13-18, 62-71), `mirrorchat/server.js` (lines 92-135)
- Impact: Large text chunks or unusual characters could cause Python script to timeout, forcing fallback to JS anonymizer which may be less accurate.
- Fix approach: Test Python script with representative text samples. Increase timeout to 15s if needed. Add logging to detect edge cases. Consider streaming large texts instead of processing whole thing at once.

---

## Performance Bottlenecks

**ElevenLabs API latency not managed:**
- Issue: `/api/voice-realtime` makes synchronous fetch to ElevenLabs for every chunk. If ElevenLabs is slow (>3s), user experiences lag in transcription. No caching, no retry logic beyond Promise.allSettled().
- Files: `mirrorchat/server.js` (lines 447-451)
- Impact: During emergency, latency could delay detection and emergency call trigger. User sees delayed text on screen.
- Fix approach: Implement exponential backoff retry. Add timeout wrapper. Implement local speech-to-text fallback (Web Speech API already available on client). Cache common phrases.

**LLM API calls not cached:**
- Issue: Every `/api/chat` and `/api/voice` call makes fresh OpenAI API call. If same message is analyzed twice, second call is wasted.
- Files: `mirrorchat/server.js` (lines 43-54, 256, 279)
- Impact: Unnecessary API costs. Slower response times. Each analysis costs money even for duplicate queries.
- Fix approach: Implement Redis cache with 1-hour TTL keyed by anonymized message hash. Cache should be invalidated if system prompt changes. Add cache hit/miss metrics.

**Python subprocess spawned for every anonymization:**
- Issue: `/api/anonymize` spawns new Python process for every request instead of maintaining persistent process or using library.
- Files: `mirrorchat/server.js` (lines 92-135)
- Impact: High overhead per request (process startup ~100ms). Limits throughput. Falls back to JS anonymizer on any Python error.
- Fix approach: Either use JavaScript implementation directly (already have fallback), or pre-start Python process via PM2. Or use `child_process.fork()` with persistent worker pool.

**No pagination on `/api/contacts` GET:**
- Issue: Returns all emergency contacts without limit. If user has 10K contacts (unlikely but possible), response could be large.
- Files: `mirrorchat/server.js` (lines 416-429)
- Impact: Large response payload, slow network transfer, memory usage.
- Fix approach: Add pagination: `GET /api/contacts/:userId?limit=100&offset=0`. Or at least add reasonable limit (e.g., max 1000 contacts).

---

## Fragile Areas & Known Issues

**Anonymization token collision bug:**
- Issue: Python anonymizer can produce `[TELEFONO]` tokens, which are then fed back through name detection and may be tokenized as `[PERSONA_N]`. Documented in CLAUDE.md as "known bug".
- Files: `mirrorchat/scripts/anonymize.py` (lines 54-71), `mirrorchat/src/utils/anonymizer.js` (lines 43-46)
- Impact: Double-anonymization may corrupt meaning. Example: phone becomes `[TELEFONO]`, then on re-anonymization becomes `[TELEFONO]` → `[PERSONA_1]`.
- Fix approach: Use different marker format that can't be confused. Example: use UUID-based tokens instead of `[TYPE_N]`. Or exclude tokens from name detection regex.

**No handling of concurrent emergency calls:**
- Issue: If `shouldTriggerAlert()` fires while previous emergency is still in progress, system might trigger duplicate calls or SMS.
- Files: `mirrorchat/src/pages/SafeVoice.jsx` (lines 73-76), `mirrorchat/src/utils/emergency.js` (lines 13-45)
- Impact: User receives duplicate emergency calls, wasting contacts' time and causing confusion during crisis.
- Fix approach: Add state flag `isEmergencyActive`. Block new emergency trigger if one is in progress. Add cancel button. Track in Supabase session table to prevent duplicates across page reloads.

**Missing Supabase RLS policies:**
- Issue: Schema has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` but no actual policies defined. Currently bypass-able because server uses service_role_key.
- Files: `mirrorchat/supabase-schema.sql` (lines 30-31)
- Impact: If RLS is later enforced without policies, all queries fail. If client accidentally gets service_role_key, user can access all data. If RLS policies are wrong, unintended access.
- Fix approach: Define explicit RLS policies: Users can only read/write their own contacts. Admins can read all. Add policy as migration step before RLS is enabled for clients.

**Speech Recognition API not supported on all browsers/devices:**
- Issue: `SpeechRecognition` (Web Speech API) is only supported on Chrome, Edge, Safari. Not supported on Firefox, not on all mobile browsers. Fallback is just error message.
- Files: `mirrorchat/src/pages/SafeVoice.jsx` (lines 112-145)
- Impact: On Firefox or unsupported mobile, voice feature completely breaks. User cannot record or analyze voice.
- Fix approach: Implement fallback to WebRTC-based transcription via `/api/voice-realtime` (which already exists using ElevenLabs). Or use Whisper.js (local ML model). Detect support upfront and offer alternative.

**Countdown can be cancelled but state is not rolled back:**
- Issue: If user presses cancel during 5-second countdown, `setStatus(IDLE)` is called but other state is not fully reset (e.g., `readings` array might persist).
- Files: `mirrorchat/src/pages/SafeVoice.jsx` (lines 173-188 - not shown in excerpt, but referenced in CLAUDE.md)
- Impact: If user re-triggers recording immediately after cancel, might see stale danger readings from previous session.
- Fix approach: Implement full state reset in cancel handler. Clear all refs: `setReadings([])`, `setTranscriptLines([])`, stop all timers.

---

## Missing Input Validation

**User phone number not validated:**
- Issue: `/api/auth/register` accepts `phone` without checking format. Could be `"aaa"`, `""`, very long string, etc.
- Files: `mirrorchat/server.js` (lines 344-363)
- Impact: Invalid phone stored in database. Emergency SMS/calls will fail. Cannot uniquely identify user.
- Fix approach: Validate phone format server-side. Accept E.164 format or common international formats. Reject if length > 20. Reject if non-digit/non-plus/non-space characters.

**Emergency contact name/surname/relationship not validated:**
- Issue: `/api/contacts` POST accepts contact fields without type checking or length limits.
- Files: `mirrorchat/server.js` (lines 395-403)
- Impact: Could store `{ name: null }` or `{ name: "<script>alert('xss')</script>" }`. Long strings could cause database bloat. XSS in name if later rendered unsafely.
- Fix approach: Validate each field: name/surname must be string, 1-100 chars, alphanumeric + spaces/dashes. Relationship must be from fixed list. Surname optional but if present, same rules.

**latitude/longitude coordinates in emergency SMS not validated:**
- Issue: `/api/emergency/sms` accepts `lat` and `lon` without range checking. Could be `"abc"` or `99999`.
- Files: `mirrorchat/server.js` (lines 512-522)
- Impact: Invalid coordinates in Google Maps URL. User unable to locate person in emergency.
- Fix approach: Validate `lat` is number between -90 and 90, `lon` between -180 and 180. Return 400 if invalid.

**Base64 audio length not validated before decoding:**
- Issue: `/api/voice-realtime` accepts `audio` field with max JSON size 10mb, but base64 string itself is not validated. Could be `"aaa"` (invalid base64) or extremely large.
- Files: `mirrorchat/server.js` (lines 434-442)
- Impact: `Buffer.from(audio, 'base64')` could create huge buffer, causing OOM. Invalid base64 fails silently. Malformed chunks cause ElevenLabs error.
- Fix approach: Validate base64 string before decoding: must match regex `/^[A-Za-z0-9+/]*={0,2}$/`. Check decoded buffer size < 5MB. Reject with 400 if invalid.

---

## Testing & Observability Gaps

**No automated tests:**
- Issue: Codebase has no test files. No unit tests for anonymization, emergency logic, or API validation.
- Files: No test directory found
- Impact: Regressions not caught. Impossible to refactor safely. New features break existing behavior without detection.
- Fix approach: Add Jest + React Testing Library for frontend. Add Node test suite for API endpoints. Aim for >70% coverage of critical paths (emergency, auth, anonymization).

**No logging/monitoring:**
- Issue: Server logs are console.log/console.error only. No structured logging, no alerting, no error tracking.
- Files: `mirrorchat/server.js` (lines 156, 173, 178, 221, 259, 282, 361, 410, 427, 475, 502, 539)
- Impact: In production, if API fails, nobody knows. Emergency calls failing silently. No way to debug user issues.
- Fix approach: Use structured logger (e.g., `winston`, `pino`). Log to file or cloud service (e.g., Datadog, CloudWatch). Create alerts for error rates, timeout threshold crossings, emergency call failures.

**No health check endpoint:**
- Issue: No way to verify server is running and dependencies (OpenAI, Supabase, Twilio) are available.
- Files: `mirrorchat/server.js`
- Impact: Deployed instance might be broken but not detected. Health checks cannot be set up in load balancer.
- Fix approach: Add `GET /health` endpoint that checks all external dependencies and returns `{ ok: true, services: { openai: ok, supabase: ok, ... } }`.

---

## Deployment & Configuration Risks

**Bland.ai integration incomplete:**
- Issue: CLAUDE.md notes that emergency calls are "currently mock" and Bland.ai is not fully configured. `BLAND_AI_API_KEY` is placeholder.
- Files: `mirrorchat/server.js` (lines 318-341), CLAUDE.md
- Impact: Emergency call feature doesn't work in production. User presses "call emergency" and nothing happens. Critical safety feature is non-functional.
- Fix approach: Obtain real Bland.ai API key. Test end-to-end call flow. Implement proper error handling if API fails. Document fallback (e.g., show user "call manually").

**Twilio configuration incomplete:**
- Issue: `TWILIO_PHONE_NUMBER` is required but may not be set. If not set, SMS calls will fail.
- Files: `mirrorchat/server.js` (lines 532, 532)
- Impact: Emergency SMS feature fails. Contacts don't receive alert during critical moment.
- Fix approach: Make `TWILIO_PHONE_NUMBER` a required env var with validation at startup. Fail fast if missing. Add to deployment checklist.

**No environment variable validation at startup:**
- Issue: Server doesn't validate required env vars before starting. If `OPENAI_API_KEY` is missing, error is only thrown on first `/api/chat` call.
- Files: `mirrorchat/server.js` (lines 17-22)
- Impact: Server starts successfully but is non-functional. Errors only surface after requests, wasting time.
- Fix approach: Validate all required vars at startup in `listen()` callback. Throw and exit(1) immediately if any missing. Log all config (without secrets) on startup.

**No HTTPS enforcement:**
- Issue: Server doesn't enforce HTTPS. Emergency contacts are sent over potentially unencrypted connection if deployed without reverse proxy.
- Files: `mirrorchat/server.js` (entire server)
- Impact: Attacker can MITM request and intercept emergency contacts, GPS location, danger context.
- Fix approach: In production, use reverse proxy (nginx, Vercel, Cloudflare) to enforce HTTPS. Add `Strict-Transport-Security` header. Document HTTPS requirement.

**No CORS origin restriction:**
- Issue: `app.use(cors())` allows requests from any origin. Malicious website can make API calls on behalf of user.
- Files: `mirrorchat/server.js` (line 25)
- Impact: CSRF attacks. Malicious website calls `/api/emergency/call` with attacker's contacts, triggering false emergency on behalf of unsuspecting user.
- Fix approach: Restrict CORS to known origins: `cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') })`. Or require CSRF token for state-changing requests.

---

## Scaling Limits

**Supabase upsert without conflict resolution:**
- Issue: `/api/auth/register` uses `upsert` with `onConflict: 'phone'`, but if two requests arrive simultaneously for same phone, race condition could occur.
- Files: `mirrorchat/server.js` (lines 352-355)
- Impact: Under load, duplicate user records could be created with same phone. User ID inconsistency.
- Fix approach: Use database uniqueness constraint + explicit conflict resolution. Add `on_conflict` parameter to handle race correctly. Or use pessimistic locking.

**In-memory emergency queue without persistence:**
- Issue: CLAUDE.md mentions `emergencyQueues` Map to track retry state. Not visible in current code, but if implemented in-memory, it will be lost on server restart.
- Files: Not shown in current code
- Impact: Emergency calls in progress during server restart are abandoned. User data lost.
- Fix approach: Persist queue state to Supabase. Use `voice_sessions` table to track state. Use webhook callbacks to confirm completion instead of in-memory polling.

---

## Dependencies at Risk

**Express 5.2.1 introduces breaking changes:**
- Issue: Package.json specifies `express: ^5.2.1`. Express 5.x has breaking changes from 4.x (e.g., routing parameters, middleware signature).
- Files: `mirrorchat/package.json` (line 21)
- Impact: If upgrading from Express 4, routes may break. Code uses `app.get('/{*splat}', ...)` which is Express 5 syntax and will fail on Express 4.
- Fix approach: Document minimum Express version. Test routes work on current version. Consider pinning to stable 4.x if upgrading introduces instability. Add explicit version constraint.

**Old Anthropic SDK version:**
- Issue: `@anthropic-ai/sdk: ^0.80.0` is old. Latest version is 1.x with different API.
- Files: `mirrorchat/package.json` (line 17)
- Impact: Anthropic provider in Python code may not work. If trying to use Anthropic for analysis, API mismatch.
- Fix approach: Update to latest `@anthropic-ai/sdk`. Update Python anthropic provider code accordingly. Test before deploying.

**OpenAI SDK breaking changes risk:**
- Issue: `openai: ^6.33.0` is fixed at major version 6, but version 7+ exists. Patch updates could introduce breaking changes.
- Files: `mirrorchat/package.json` (line 22)
- Impact: Security patches or feature updates might require code changes. Pinning to old version misses security fixes.
- Fix approach: Use caret to allow minor/patch updates. Monitor releases. Test major version upgrades in staging before production.

---

## Privacy & Data Protection Concerns

**Anonymization not truly anonymous if attacker has mapping:**
- Issue: Client-side anonymization stores mapping in `anonymized.mappings.persone` in response. If this is logged or exposed, attacker can de-anonymize.
- Files: `mirrorchat/src/utils/anonymizer.js` (line 65), `mirrorchat/server.js` (line 88)
- Impact: Anonymization provides false sense of privacy. Mappings in logs or responses can be cross-referenced to de-anonymize texts.
- Fix approach: Never return mappings to client. Discard mappings after anonymization. If mappings needed for UI (e.g., to show original name next to token), store only in user's local session, never on server.

**Voice recordings stored indefinitely:**
- Issue: Voice samples uploaded to `/api/voice-enroll` are stored in Supabase Storage indefinitely with no expiration or cleanup policy.
- Files: `mirrorchat/server.js` (mentioned in CLAUDE.md but not shown in current code)
- Impact: User data accumulates forever. GDPR/privacy regulations may require deletion after period. Storage costs increase.
- Fix approach: Set object expiration on Supabase Storage (e.g., 90 days). Add deletion endpoint. Implement data retention policy. Warn users data is stored.

**GPS coordinates exposed in SMS:**
- Issue: `/api/emergency/sms` includes GPS coordinates in plaintext SMS: `https://maps.google.com/?q=lat,lon`. If SMS is intercepted, location is revealed.
- Files: `mirrorchat/server.js` (lines 520-522)
- Impact: Attacker sees exact location of user in emergency. SMS is not encrypted end-to-end by default.
- Fix approach: Don't include coordinates in SMS. Provide short URL that requires authentication to reveal location. Or use different channel for coordinates (e.g., secure web link sent via SMS).

**Profile facts stored in localStorage in plaintext:**
- Issue: Extracted facts from conversations stored in localStorage with no encryption: `{ fact: 'relazione_tipo', value: 'genitore', source: 'voice', date: '...' }`.
- Files: `mirrorchat/src/utils/profiler.js` (lines 28, 52, 108, 129)
- Impact: If device is stolen, attacker sees all personal facts extracted from conversations. Device vulnerability becomes privacy vulnerability.
- Fix approach: Encrypt localStorage before writing. Use `crypto.subtle.encrypt()` with user-provided key. Or don't store locally; always retrieve from Supabase on demand.

---

## Accessibility & User Safety Gaps

**No accessibility labels for critical buttons:**
- Issue: Emergency trigger buttons may not have proper `aria-label` or `role="button"` for screen readers.
- Files: `mirrorchat/src/pages/SafeVoice.jsx` (not shown in excerpt, but mentioned in CLAUDE.md)
- Impact: Blind users cannot understand what buttons do. Cannot trigger emergency call via screen reader.
- Fix approach: Add `aria-label="Start voice recording"` to all interactive elements. Use semantic HTML (`<button>` not `<div>`). Test with screen reader (NVDA, JAWS).

**No offline detection or indication:**
- Issue: App makes critical API calls without detecting network availability. If user is offline during emergency, app appears to work but calls fail silently.
- Files: `mirrorchat/src/utils/api.js`, `mirrorchat/src/utils/emergency.js`
- Impact: During emergency, if network fails, user thinks help is being called but nothing happens.
- Fix approach: Use `navigator.onLine` to detect connectivity. Show banner when offline. Store pending emergency requests in queue. Attempt to resend when online.

---

*Concerns audit: 2026-03-29*
