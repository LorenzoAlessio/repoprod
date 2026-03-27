# Base hackathon Agaton — agente multi-provider

Scheletro minimale per prototipare un agente con **OpenAI**, **Gemini**, **Claude** e variabili **Supabase**, senza committare segreti.

## Requisiti

- Python 3.11+
- Account e chiavi sui provider che userai (vedi `.env.example`)

## Setup

```powershell
cd "c:\Users\loren\Desktop\Claude sb"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

Copia il lembo delle variabili e compila i valori reali:

```powershell
copy .env.example .env
# Modifica .env con l'editor (mai incollare .env in chat o in README)
```

## Comandi utili

Esegue un turno di chat di prova con il provider scelto (`openai` | `gemini` | `anthropic`):

```powershell
python -m src.agent.runner --provider openai
```

Verifica connettività (solo per le chiavi presenti in `.env`):

```powershell
python scripts/sanity_check.py
```

## Sicurezza

- **Non** versionare `.env` né chiavi in issue, README o transcript.
- **SUPABASE_ANON_KEY**: uso tipico lato app con RLS attive.
- **SUPABASE_SERVICE_ROLE_KEY**: privilegi elevati; non usarla in client pubblici.

## Struttura

- `src/config.py` — caricamento env e default modelli
- `src/providers/` — wrapper OpenAI, Gemini, Anthropic (`complete(messages) -> str`)
- `src/agent/runner.py` — CLI minima per un turno
- `scripts/sanity_check.py` — ping leggero alle API
- `docs/mcp-hackathon.md` — note MCP Cursor (Supabase e altri)
- `mcp.config.example.json` — esempio da adattare in Cursor Settings → MCP

## Cursor MCP

Il plugin Supabase in Cursor può richiedere autenticazione dal pannello MCP. Dettagli e server opzionali in `docs/mcp-hackathon.md`.

## Nota Gemini SDK

Il pacchetto `google-generativeai` è deprecato a favore di `google-genai`; per il prototipo resta quello indicato nel piano (meno sorprese in hackathon). Quando vorrai migrare, aggiorna `GeminiProvider` e le dipendenze in `pyproject.toml`.
