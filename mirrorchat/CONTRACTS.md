# MirrorChat — Contratti API

Ogni agent DEVE rispettare queste interfacce. Sono il "contratto" che permette il lavoro parallelo.

## Risposta Chat Analysis (chatApi.js → chat.js)

```json
{
  "tecnica": "gaslighting|love_bombing|colpevolizzazione|isolamento|controllo|svalutazione|idealizzazione|nessuna",
  "traduzione": "string - riscrittura del vero significato",
  "spiegazione": "string - perché è dannoso, linguaggio 14-19 anni",
  "gravita": 1-5,
  "risposte": ["string - 2-3 risposte assertive"],
  "risorse": true/false
}
```

## Risposta Voice Analysis (voiceApi.js → safevoice.js)

```json
{
  "pericolo": 1-5,
  "motivo": "string - breve spiegazione",
  "escalation": true/false,
  "sintesi_emergenza": "string - frase per forze dell'ordine se pericolo >= 4"
}
```

## Funzione Anonymizer (anonymizer.js)

```javascript
// INPUT: stringa di testo originale
// OUTPUT: { anonymized: string, mappings: { [nomeOriginale]: "[PERSONA_N]" } }
window.Anonymizer.anonymize(text) → { anonymized, mappings }
```

## Server Proxy (server.js)

```
POST /api/chat
  Request body:  { message: "testo anonimizzato" }
  Response body: Chat Analysis JSON (vedi sopra)

POST /api/voice
  Request body:  { transcript: "trascritto anonimizzato" }
  Response body: Voice Analysis JSON (vedi sopra)
```

## Esportazioni Moduli (window.*)

Tutti i moduli esportano su `window` (no ES modules, no require):

| Modulo | Export | Metodi principali |
|--------|--------|-------------------|
| anonymizer.js | `window.Anonymizer` | `anonymize(text)` |
| chatApi.js | `window.ChatApi` | `async analyze(text)` |
| voiceApi.js | `window.VoiceApi` | `async analyze(transcript)` |
| speech.js | `window.SpeechEngine` | `start(onResult, onError)`, `stop()`, `isSupported()` |
| safevoice.js | `window.SafeVoice` | `activate(personData)`, `deactivate()`, `cancelAlert()` |
| examples.js | `window.Examples` | `getAll()` |
| resources.js | `window.Resources` | `getAll()` |
| education.js | `window.Education` | `getAll()` |
