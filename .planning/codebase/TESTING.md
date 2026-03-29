# Testing Patterns

**Analysis Date:** 2026-03-29

## Test Framework

**Runner:**
- Not detected: No Jest, Vitest, or other test runner configured
- No test scripts in `package.json`

**Assertion Library:**
- Not detected: No test framework dependencies present

**Run Commands:**
- Not configured: Testing infrastructure not implemented

## Test File Organization

**Location:**
- No test files found in project
- Test framework not set up

**Naming:**
- Convention not established (no `.test.js`, `.spec.js` files exist)

**Structure:**
- Not applicable

## Current State: No Automated Testing

This codebase has **no test infrastructure**. All verification is manual or through browser/API testing.

### Implications

**Risk Areas:**
- `mirrorchat/src/utils/api.js` — HTTP wrapper functions (`analyzeChat`, `analyzeVoice`) with error handling paths not covered
- `mirrorchat/src/utils/emergency.js` — Critical `shouldTriggerAlert()` algorithm with time-window logic not tested
- `mirrorchat/src/utils/qwenAnonymizer.js` — Regex-based anonymization patterns for PII (phone, email, addresses, fiscal codes, IBAN) not validated
- `mirrorchat/src/utils/speech.js` — Audio recording lifecycle (`start`, `stop`, `onLevel`, `onChunk`) not tested
- `src/providers/` — LLM client wrappers (OpenAI, Gemini, Anthropic) that parse and adapt messages not tested
- `mirrorchat/server.js` — Express API endpoints, JSON extraction from LLM responses, fallback logic not tested

**Critical Paths Needing Tests:**
1. **Danger threshold logic** (`emergency.js`): Edge cases around 30-second window, max=5 OR highCount≥2
2. **PII masking** (`qwenAnonymizer.js`): Ensure regex patterns catch all Italian address formats, phone numbers, fiscal codes
3. **LLM response parsing** (`server.js`): `extractJSON()` must handle malformed JSON responses
4. **File type detection** (`ChatAnalysis.jsx`): Logic for determining if file is text, image, or binary

## Recommended Testing Strategy

### Phase 1: Unit Tests (High Priority)

**Test file locations to create:**
- `mirrorchat/src/utils/__tests__/emergency.test.js`
- `mirrorchat/src/utils/__tests__/qwenAnonymizer.test.js`
- `mirrorchat/src/utils/__tests__/api.test.js`
- `src/providers/__tests__/` (for each provider)

**Test runner recommendation:** Vitest (lightweight, fast, works with Vite)

**Critical test cases:**

1. **`emergency.js::shouldTriggerAlert()`**
   ```javascript
   describe('shouldTriggerAlert', () => {
     it('returns true when max pericolo = 5', () => {
       const readings = [{ pericolo: 5, timestamp: Date.now() }]
       expect(shouldTriggerAlert(readings)).toBe(true)
     })

     it('returns true when 2+ readings with pericolo >= 4 in last 30s', () => {
       const now = Date.now()
       const readings = [
         { pericolo: 4, timestamp: now },
         { pericolo: 4, timestamp: now - 5000 }
       ]
       expect(shouldTriggerAlert(readings)).toBe(true)
     })

     it('ignores readings older than 30s', () => {
       const now = Date.now()
       const readings = [
         { pericolo: 5, timestamp: now - 31000 },
         { pericolo: 2, timestamp: now }
       ]
       expect(shouldTriggerAlert(readings)).toBe(false)
     })

     it('returns false when max < 5 and highCount < 2', () => {
       const readings = [
         { pericolo: 3, timestamp: Date.now() },
         { pericolo: 4, timestamp: Date.now() - 5000 }
       ]
       expect(shouldTriggerAlert(readings)).toBe(false)
     })
   })
   ```

2. **`qwenAnonymizer.js::anonymizeText()`**
   ```javascript
   describe('anonymizeText', () => {
     it('masks Italian phone numbers', () => {
       const text = "Mio numero è +39 335 1234567"
       const result = anonymizeText(text)
       expect(result).not.toMatch(/335 1234567/)
       expect(result).toMatch(/\[TELEFONO\]/)
     })

     it('masks email addresses', () => {
       const text = "Contattami a mario@example.com"
       const result = anonymizeText(text)
       expect(result).not.toMatch(/mario@example\.com/)
       expect(result).toMatch(/\[EMAIL\]/)
     })

     it('masks Italian addresses with optional house numbers', () => {
       const cases = [
         "via Roma 15",
         "Piazza San Marco 3/A",
         "Corso Vittorio Emanuele, 120"
       ]
       cases.forEach(addr => {
         const result = anonymizeText(addr)
         expect(result).not.toMatch(/\b(via|Piazza|Corso).+\d/)
       })
     })

     it('masks fiscal codes', () => {
       const text = "Il suo codice fiscale è RSSMRA80A01H501T"
       const result = anonymizeText(text)
       expect(result).not.toMatch(/RSSMRA80A01H501T/)
       expect(result).toMatch(/\[CODICE_FISCALE\]/)
     })

     it('masks IBAN', () => {
       const text = "Versare su IT60X0542811101000000123456"
       const result = anonymizeText(text)
       expect(result).not.toMatch(/IT60X0542811101000000123456/)
       expect(result).toMatch(/\[IBAN\]/)
     })

     it('does not mask names (intentionally)', () => {
       const text = "Mario mi ha detto"
       const result = anonymizeText(text)
       expect(result).toContain("Mario")
     })
   })
   ```

3. **`server.js::extractJSON()`**
   ```javascript
   describe('extractJSON', () => {
     it('extracts valid JSON from LLM response with surrounding text', () => {
       const response = 'Here is the analysis:\n{"tecnica": "gaslighting", "gravita": 4}\nEnd.'
       const result = extractJSON(response)
       expect(result.tecnica).toBe('gaslighting')
       expect(result.gravita).toBe(4)
     })

     it('throws when no JSON found', () => {
       expect(() => extractJSON('No JSON here')).toThrow()
     })

     it('handles nested objects', () => {
       const response = '{"outer": {"inner": "value"}}'
       const result = extractJSON(response)
       expect(result.outer.inner).toBe('value')
     })
   })
   ```

### Phase 2: Integration Tests (Medium Priority)

**Test file locations:**
- `mirrorchat/src/__tests__/api-integration.test.js` — Mock `/api/chat` and `/api/voice` endpoints

**Focus areas:**
- Request formatting to API endpoints
- Error handling when API returns invalid JSON
- State updates after async responses

### Phase 3: React Component Tests (Lower Priority)

**Test file locations:**
- `mirrorchat/src/pages/__tests__/ChatAnalysis.test.jsx`
- `mirrorchat/src/pages/__tests__/SafeVoice.test.jsx`

**Patterns to test:**
- File input handling (drag-drop, file type detection)
- Form submission and error states
- Conditional rendering based on state changes

## Mocking

**Framework:** Vitest (recommended) with `vi.mock()`

**Mock Examples:**

1. **Mock API calls:**
   ```javascript
   import { vi } from 'vitest'

   vi.mock('../utils/api', () => ({
     analyzeChat: vi.fn().mockResolvedValue({
       tecnica: 'gaslighting',
       gravita: 4,
       traduzione: 'Mock translation',
       spiegazione: 'Mock explanation',
       risposte: ['Response 1'],
       risorse: true
     })
   }))
   ```

2. **Mock fetch:**
   ```javascript
   global.fetch = vi.fn((url) => {
     if (url === '/api/chat') {
       return Promise.resolve({
         ok: true,
         json: () => Promise.resolve({ tecnica: 'love_bombing', gravita: 3 })
       })
     }
     return Promise.reject(new Error('Not mocked'))
   })
   ```

3. **Mock localStorage:**
   ```javascript
   const localStorageMock = {
     getItem: vi.fn(),
     setItem: vi.fn(),
     clear: vi.fn()
   }
   global.localStorage = localStorageMock
   ```

**What to Mock:**
- HTTP requests (`fetch`, API calls)
- External services (Supabase, ElevenLabs, OpenAI)
- Browser APIs (localStorage, navigator.wakeLock, geolocation)
- Audio recording APIs (MediaRecorder)

**What NOT to Mock:**
- Pure utility functions (regex, string manipulation, math)
- React hooks (`useState`, `useEffect`)
- Local state logic
- Router navigation (use BrowserRouter in test if needed)

## Fixtures and Factories

**Test Data Location (to create):**
- `mirrorchat/src/__fixtures__/` — Static test data
- `mirrorchat/src/__factories__/` — Factories for building test objects

**Example fixture:**
```javascript
// mirrorchat/src/__fixtures__/dangers.js
export const dangerReadings = {
  safe: [
    { pericolo: 1, timestamp: Date.now() },
    { pericolo: 2, timestamp: Date.now() - 5000 }
  ],
  critical: [
    { pericolo: 5, timestamp: Date.now() },
    { pericolo: 4, timestamp: Date.now() - 10000 }
  ],
  escalating: [
    { pericolo: 4, timestamp: Date.now() },
    { pericolo: 4, timestamp: Date.now() - 15000 }
  ]
}
```

**Example factory:**
```javascript
// mirrorchat/src/__factories__/userFactory.js
export function createUser(overrides = {}) {
  return {
    id: 'test-id-123',
    name: 'Test User',
    phone: '+39 335 1234567',
    ...overrides
  }
}
```

## Coverage

**Requirements:** None enforced currently

**Recommended targets (after setup):**
- Critical utilities: 90%+ (emergency.js, anonymizer.js)
- API wrappers: 80%+ (api.js)
- Components: 60%+ (UI coverage less critical)
- Overall: 70%+

**View Coverage:**
```bash
npm run test -- --coverage
```

(Requires Vitest `coverage` config)

## Test Types

**Unit Tests:**
- Scope: Individual functions (pure functions, utilities, helpers)
- Approach: Fast, deterministic, test one behavior per test
- Example: `anonymizeText('text with phone')`
- Run: `npm run test -- mirrorchat/src/utils/__tests__/*.test.js`

**Integration Tests:**
- Scope: Function interactions, API request/response cycles
- Approach: Mock external APIs, test data flow
- Example: User submits form → calls API → updates state
- Run: `npm run test -- mirrorchat/src/__tests__/*-integration.test.js`

**E2E Tests:**
- Framework: Not used (no Playwright, Cypress, etc. configured)
- Recommendation: Consider for critical flows if test budget allows:
  - Onboarding → create user → save contacts → navigate to chat
  - SafeVoice recording → danger detection → emergency call mock

## Common Patterns

**Async Testing:**
```javascript
// Vitest with async/await
test('analyzeChat returns result on success', async () => {
  const result = await analyzeChat('test message')
  expect(result.tecnica).toBeDefined()
})

// With error handling
test('analyzeChat throws on API error', async () => {
  vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
  await expect(analyzeChat('text')).rejects.toThrow()
})
```

**Error Testing:**
```javascript
test('shouldTriggerAlert with empty readings returns false', () => {
  expect(shouldTriggerAlert([])).toBe(false)
})

test('extractJSON throws on malformed JSON', () => {
  expect(() => extractJSON('{ invalid json')).toThrow()
})
```

**State Updates in React:**
```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

test('ChatAnalysis shows loading spinner during analysis', async () => {
  render(<ChatAnalysis />)
  fireEvent.change(screen.getByPlaceholderText(/messaggio/i), {
    target: { value: 'test message' }
  })
  fireEvent.click(screen.getByText(/Analizza/i))
  expect(screen.getByRole('status')).toHaveClass('spinner')
})
```

## Setup Instructions (To Implement)

**1. Install Vitest and testing utilities:**
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
```

**2. Create `vitest.config.js` in mirrorchat/:**
```javascript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.js']
  }
})
```

**3. Create `vitest.setup.js`:**
```javascript
import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
```

**4. Add test scripts to `package.json`:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

**5. Create test directory structure:**
```bash
mkdir -p mirrorchat/src/utils/__tests__
mkdir -p mirrorchat/src/pages/__tests__
mkdir -p mirrorchat/src/__tests__
mkdir -p mirrorchat/src/__fixtures__
mkdir -p mirrorchat/src/__factories__
```

---

*Testing analysis: 2026-03-29*
