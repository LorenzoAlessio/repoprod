# Coding Conventions

**Analysis Date:** 2026-03-29

## Naming Patterns

**Files:**
- React components: PascalCase with `.jsx` extension (e.g., `ChatAnalysis.jsx`, `SeverityIndicator.jsx`)
- Utility modules: camelCase with `.js` extension (e.g., `api.js`, `emergency.js`, `speech.js`)
- CSS modules: `.module.css` (e.g., `ChatAnalysis.module.css`)
- Python modules: snake_case with `.py` extension (e.g., `openai_client.py`, `config.py`)

**Functions:**
- JavaScript: camelCase (e.g., `analyzeChat`, `shouldTriggerAlert`, `createAudioRecorder`)
- React hooks: camelCase prefixed with `use` (e.g., `useDebounce`, `useState`)
- Async functions: camelCase with `async` keyword (e.g., `async function startRecording()`, `export async function analyzeChat()`)
- Helper functions: lowercase or camelCase (e.g., `getFileExt()`, `isTextFile()`, `readFileAsText()`)
- Python: snake_case (e.g., `get_settings()`, `complete()`)

**Variables:**
- Constants: SCREAMING_SNAKE_CASE or const declaration (e.g., `COUNTDOWN_SECONDS`, `STATES`, `NUM_BARS`)
- State variables: camelCase with `set` prefix for setState (e.g., `const [loading, setLoading] = useState(false)`)
- Private references: camelCase with `Ref` suffix (e.g., `recorderRef`, `fileInputRef`, `statusRef`)
- Python: lowercase snake_case (e.g., `_openaiClient`, `system_instruction`)

**Types & Interfaces:**
- Python TypedDict: PascalCase (e.g., `ChatMessage`)
- Python dataclass: PascalCase (e.g., `Settings`)
- Component props: no specific convention, passed inline or destructured

## Code Style

**Formatting:**
- No explicit formatter configured (ESLint config present but no Prettier config found)
- Indentation: 2 spaces (observed in `.jsx` and `.js` files)
- Line length: no strict limit enforced, lines typically 80-120 characters
- Semicolons: present in JavaScript, optional in some statements

**Linting:**
- Tool: ESLint with React Hooks plugin
- Config: `mirrorchat/mirrorchat-react/eslint.config.js` (flat config format)
- Key rules:
  - `no-unused-vars`: error with exception for variables matching `^[A-Z_]` (constants)
  - `react-hooks/rules-of-hooks`: enforced
  - `react-refresh/only-export-components`: enforced
- Ignores: `dist/` directory

**JavaScript style observations:**
- `var` used in server-side code for backward compatibility (`server.js`)
- `const` preferred in React/modern code
- Arrow functions common in React components (`const handleFile = async (f) => { ... }`)
- Regular functions in utility modules (e.g., `function useDebounce()`, `function isTextFile()`)

**Python style observations:**
- Type hints with `from __future__ import annotations` (Python 3.7+ style)
- Dataclass with `frozen=True` for immutable settings (`config.py`)
- Class methods with `self` parameter
- Private attributes prefixed with `_` (e.g., `_settings`, `_openaiClient`)

## Import Organization

**Order (JavaScript/JSX):**
1. React imports (`import { useState, useEffect } from 'react'`)
2. React Router imports (`import { useNavigate } from 'react-router-dom'`)
3. Third-party libraries (e.g., `import SeverityIndicator from '../components/SeverityIndicator'`)
4. Local utilities and hooks (e.g., `import { analyzeChat } from '../utils/api'`)
5. Data/constants (e.g., `import { examples } from '../data/examples'`)
6. CSS modules (e.g., `import styles from './ChatAnalysis.module.css'`)

**Order (Python):**
1. `from __future__ import annotations` (future imports)
2. Standard library (`import os`, `from dataclasses import dataclass`)
3. Third-party imports (`from openai import OpenAI`)
4. Local imports (`from src.config import Settings`)

**Path conventions:**
- Relative imports used throughout (e.g., `'../utils/api'`, `'../components/Layout'`)
- No path aliases or @ prefixes detected
- Absolute imports in Python (`from src.config import ...`)

## Error Handling

**JavaScript patterns:**
- Try-catch blocks for async operations (e.g., `try { ... } catch (err) { ... }`)
- Error state in React (`const [error, setError] = useState('')`)
- Error messages displayed in UI via `error &&` conditional rendering
- console.error() used for background tasks (e.g., `console.error('[profiler] extractFacts error:', err.message)`)
- Fallback error messages: `err.message || 'Errore durante l\'analisi. Riprova.'`
- Silent error handling (`.catch(() => {})`) for non-critical operations (e.g., `extractFacts(...).catch(() => {})`)

**Python patterns:**
- `raise ValueError()` for configuration/setup errors (e.g., missing API keys)
- Direct exception propagation (no try-catch at provider level)
- Return type hints indicate expected output (e.g., `-> str`)

**HTTP error handling:**
- Check `res.ok` before parsing JSON
- Extract error message from response: `const err = await res.json().catch(() => ({}))` then `err.error || 'Default message'`
- Status code validation: `if (!res.ok) throw new Error(...)`

## Logging

**Framework:** `console.error()` only (no logger library)

**Patterns:**
- Errors logged with prefix context: `console.error('[profiler] extractFacts error:', err.message)`
- Silent failures preferred for background tasks that don't block UI
- No info/debug logging observed—only error logging

## Comments

**When to Comment:**
- Multi-step algorithms (e.g., address matching in `qwenAnonymizer.js`)
- Complex regex patterns (documented inline with descriptions)
- Section headers using `// ──` separator style

**Example section header pattern:**
```javascript
// ── Avvia registrazione ───────────────────────────────────
async function startRecording() { ... }
```

**JSDoc/TSDoc:**
- Used in API utility functions (`api.js`):
```javascript
/**
 * Analyse a (pre-anonymised) chat message.
 * @param {string} message
 * @returns {Promise<{tecnica, traduzione, spiegazione, gravita, risposte, risorse}>}
 */
export async function analyzeChat(message, genereUtente = 'non_specificato', persone = {}) { ... }
```
- Light documentation style; not comprehensive
- Function parameter and return types documented

## Function Design

**Size:** Typical functions 30-80 lines, components 100-200 lines

**Parameters:**
- React: props destructured in function signature (e.g., `export default function SeverityIndicator({ level, size = 48, showLabel = true })`)
- Utility functions: single parameter or multiple discrete params (e.g., `analyzeChat(message, genereUtente, persone)`)
- Callbacks passed as inline arrow functions in JSX (e.g., `onClick={() => handleExample(ex)}`)

**Return Values:**
- React components: JSX elements
- Async functions: Promises (e.g., `Promise<{tecnica, ...}>`)
- Utility functions: objects with multiple properties (e.g., `{ anonymized, mappings, method }`)
- Python: explicit return type hints (e.g., `-> str`, `-> None`)

**Async patterns:**
- `.then()` chains used minimally; `async/await` preferred
- Error handling via try-catch
- Non-blocking operations wrapped in `.catch(() => {})` when failures are acceptable

## Module Design

**Exports:**
- Default exports for React components (`export default function ChatAnalysis()`)
- Named exports for utilities (`export async function analyzeChat()`, `export function shouldTriggerAlert()`)
- Mixed exports in Python files (classes exported as classes, functions as functions)

**Barrel Files:**
- `src/providers/__init__.py` imports providers and exports them
- No barrel files (index.js) observed in JavaScript

**Organization patterns:**
- Components in `mirrorchat/src/components/` (e.g., `Layout.jsx`, `SeverityIndicator.jsx`)
- Pages in `mirrorchat/src/pages/` (e.g., `ChatAnalysis.jsx`, `SafeVoice.jsx`)
- Utilities in `mirrorchat/src/utils/` (e.g., `api.js`, `emergency.js`)
- Data in `mirrorchat/src/data/` (e.g., `examples.js`, `resources.js`)
- Python logic in `src/` (config, providers, agent)

## State Management

**React state:**
- `useState` hook for local component state
- `localStorage` for user persistence (e.g., `mirrorUser`, `mirrorContacts`)
- No Redux, Context API, or global state library used
- State shape examples:
  - `const [status, setStatus] = useState(STATES.IDLE)` (enum pattern)
  - `const [readings, setReadings] = useState([])` (array of danger readings)
  - `const [result, setResult] = useState(null)` (nullable result object)

## Styling

**CSS Modules:**
- Each component paired with `.module.css` file
- Classes accessed via `styles.className` pattern (e.g., `className={styles.page}`)
- BEM-like naming in CSS (e.g., `dropZone`, `dropZoneDragging`, `dropZoneHasFile`)
- Dynamic styles via inline `style` prop with variables from component logic

---

*Convention analysis: 2026-03-29*
