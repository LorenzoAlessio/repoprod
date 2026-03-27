# MCP Cursor — note hackathon

Questo file è un **promemoria**: la configurazione reale degli MCP sta in Cursor (**Settings → MCP** o `mcp.json` utente/progetto).

## Supabase (già disponibile come plugin)

- Nel progetto Cursor può comparire il server **`supabase`** (plugin `plugin-supabase-supabase`).
- Se richiesto, completa l’autenticazione dal pannello MCP (tool `mcp_auth` del plugin).

## Server MCP utili aggiuntivi

| Server | Ruolo |
|--------|--------|
| **Filesystem** | Leggere/scrivere file del repo da parte dell’LLM in modo strutturato. |
| **GitHub** | Branch, PR, issue (se usi GitHub per il hackathon). |
| **Fetch / web** | Consultare documentazione o pagine pubbliche dall’IDE. |
| **Playwright** (browser) | Solo se il task richiede automazione web; setup più pesante. |

Esempi di comando per riferimento (adatta path e policy del tuo PC):

- Filesystem: `@modelcontextprotocol/server-filesystem` con argomento la **cartella root** del progetto.
- Fetch: `@modelcontextprotocol/server-fetch` o equivalente documentato in quel momento su MCP Anthropic / Cursor.

## Relazione con questo repo Python

Gli MCP in Cursor aiutano **te** mentre sviluppi. Il codice in `src/` chiama le API (**OpenAI**, **Gemini**, **Claude**, **Supabase**) direttamente tramite SDK e variabili in `.env`, salvo che tu non integri un host MCP nel runtime.

Vedi anche [`mcp.config.example.json`](../mcp.config.example.json) per un esempio di struttura JSON da adattare.
