# MirrorChat — Profilazione Utente Anonima con ML

## Sommario

Costruire progressivamente un profilo anonimo dell'utente a partire dalle conversazioni analizzate (chat e voice). Qwen 2.5 1.5B estrae fatti dal testo originale in locale (prima dell'anonimizzazione), poi OpenAI consolida i fatti anonimi in un profilo MD strutturato ogni 3 analisi. Il profilo migliora la qualita delle analisi future e e visibile all'utente con possibilita di modifica e cancellazione.

## Architettura

```
DOPO OGNI ANALISI (background, non blocca l'utente)

1. QWEN LOCALE (vede testo originale)
   │  Prompt: "Elenca i fatti sulla persona"
   │  Input: testo originale completo
   │  Output: ha_marito=si, ha_figli=si, genere=donna
   └──► Fatti salvati in localStorage (array accumulato)

2. OGNI 3 ANALISI → SERVER (consolidamento)
   │  POST /api/profile { facts: [...fatti anonimi...], previousProfile }
   │  OpenAI genera/aggiorna profilo MD strutturato
   └──► MD salvato in localStorage + sync Supabase
```

### Cosa vede chi

- **Qwen**: testo originale completo → estrae fatti
- **Server/OpenAI**: solo lista di fatti anonimi (ha_figli=si, genere=donna) → genera profilo MD
- **Supabase**: solo profilo MD anonimo + fatti JSON → backup
- Nessun nome, indirizzo o dato identificabile raggiunge mai il server per il profiling

## Estrazione fatti con Qwen

### Categorie di fatti

| Categoria | Esempi | Fonte nel testo |
|-----------|--------|-----------------|
| Relazione | ha_partner, genere_partner, tipo_relazione | "mio marito", "il mio ragazzo", "la mia ex" |
| Figli | ha_figli, numero_figli | "devo portare i bambini", "mio figlio" |
| Famiglia | vive_con_genitori, ha_fratelli | "mia madre dice che", "a casa con i miei" |
| Istruzione/lavoro | studente, tipo_scuola, lavora | "a scuola", "il prof", "al lavoro" |
| Eta stimata | fascia_eta | contesto linguistico, riferimenti scolastici |
| Sociale | ha_amici, isolamento | "le mie amiche", "non esco piu con nessuno" |
| Pattern abuso | tipo_pattern, frequenza | accumulato dalle analisi precedenti |
| Stato emotivo | paura, confusione, dipendenza | "ho paura", "non so cosa fare" |

### Prompt Qwen

```
Leggi questo messaggio e estrai informazioni sulla persona che lo ha scritto o ricevuto. Rispondi SOLO con una lista di fatti, uno per riga, nel formato: categoria=valore

Categorie possibili: genere, eta_stimata, ha_partner, genere_partner, tipo_relazione, ha_figli, vive_con, studia, lavora, stato_emotivo, isolamento

Messaggio: mio marito non vuole che esco con le mie amiche, dice che sono una cattiva influenza. Ho paura, devo portare i bambini a scuola domani
genere=donna, ha_partner=si, genere_partner=uomo, tipo_relazione=marito, ha_figli=si, stato_emotivo=paura, isolamento=si

Messaggio: {TEXT}
```

### Formato fatto

```javascript
{
  fact: "ha_partner",
  value: "si",
  confidence: 0.9,
  source: "chat",        // "chat" o "voice"
  date: "2026-03-28"
}
```

Salvati in localStorage sotto `mirrorchat_profile_facts`. Se un fatto contraddice uno precedente, si tiene il piu recente.

## Consolidamento profilo MD con OpenAI

### Trigger

Ogni 3 analisi completate (chat o voice). Contatore in localStorage `mirrorchat_analysis_count`.

### Endpoint

```
POST /api/profile
Body: {
  facts: [
    { fact: "ha_partner", value: "si", source: "chat", date: "2026-03-28" },
    ...
  ],
  previousProfile: "## Profilo Utente\n..."
}
Response: {
  profile: "## Profilo Utente\n\n### Scheda sintetica\n..."
}
```

### System prompt OpenAI

```
Sei un assistente che costruisce un profilo anonimo di una persona
a partire da fatti estratti dalle sue conversazioni. Il profilo serve
a fornire assistenza e protezione alla persona.

Genera un documento Markdown con due sezioni:
1. Scheda sintetica (bullet list: genere, età stimata, relazione,
   figli, contesto, pattern rilevati, livello rischio 1-5)
2. Sezioni narrative (situazione relazionale, contesto sociale,
   pattern di rischio, stato emotivo)

Se hai un profilo precedente, aggiornalo con i nuovi fatti senza
perdere informazioni precedenti. Se un nuovo fatto contraddice uno
vecchio, usa il più recente.

NON inventare informazioni. Se un dato non è noto, non includerlo.
Scrivi in italiano. Il profilo deve essere completamente anonimo:
nessun nome, luogo o dato identificabile.
```

### Formato output MD

```markdown
## Profilo Utente

*Ultimo aggiornamento: 28/03/2026 — basato su 5 analisi*

### Scheda sintetica
- Genere: donna
- Età stimata: 16-18 anni
- Relazione: partner maschile, relazione attiva
- Figli: sì
- Contesto: studentessa, vive con i genitori
- Pattern rilevati: controllo digitale (3/5), isolamento (2/5)
- Livello di rischio complessivo: 3/5

### Situazione relazionale
L'utente è in una relazione con un partner maschile che mostra
pattern di controllo digitale ricorrente. In 3 analisi su 5 sono
emersi comportamenti di monitoraggio del telefono e limitazione
delle amicizie...

### Contesto sociale
L'utente sembra frequentare un ambiente scolastico. Ha menzionato
figure di riferimento adulte. Il contesto familiare include figli...

### Pattern di rischio
I pattern più frequenti sono controllo digitale e isolamento
progressivo. Si osserva un'escalation rispetto alle prime analisi...

### Stato emotivo
L'utente ha espresso paura e confusione in più occasioni...
```

## Storage e sync

1. **localStorage** `mirrorchat_profile_facts` — array fatti accumulati
2. **localStorage** `mirrorchat_profile_md` — profilo MD corrente
3. **localStorage** `mirrorchat_analysis_count` — contatore per trigger consolidamento
4. **Supabase** tabella `users` — colonne aggiunte: `profile_md` (TEXT), `profile_facts` (JSONB), `profile_updated_at` (TIMESTAMPTZ)
5. Sync dopo ogni consolidamento se utente registrato
6. Al login su nuovo dispositivo: pull da Supabase → localStorage

### Schema Supabase (aggiunta)

```sql
ALTER TABLE users ADD COLUMN profile_md TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN profile_facts JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN profile_updated_at TIMESTAMPTZ;
```

## Pagina profilo

### Route e navigazione

Route: `/profile`. Nuova voce nella sidebar "Il mio profilo" sotto Impostazioni.

### Layout

Card informativa in alto (sfondo Sage 8%, bordo sinistro Sage 3px):
- "Perche esiste questo profilo?"
- "MirrorChat costruisce un profilo anonimo per conoscerti meglio e proteggerti in modo piu efficace."
- Bullet: nessun nome, solo sul dispositivo, cancellabile, migliora le analisi

Scheda sintetica come card bianca con shadow-sm. Severity dots per il rischio.

Sezioni narrative espandibili (situazione relazionale, pattern di rischio, stato emotivo) con toggle.

Footer con due bottoni:
- "Modifica profilo" (secondary) — le sezioni diventano textarea editabili
- "Cancella tutti i dati" (Coral) — modale conferma, cancella localStorage + Supabase

### Stato vuoto

Quando non ci sono analisi: messaggio centrato "Il profilo si costruisce automaticamente analizzando i tuoi messaggi" con link a /chat.

### Modifica profilo

Cliccando "Modifica profilo", le sezioni narrative diventano textarea editabili. Al salvataggio il MD viene aggiornato in localStorage e sync su Supabase.

### Cancellazione

Modale conferma: "Sei sicuro? Questa azione cancellera il tuo profilo e tutti i fatti raccolti. Non e reversibile."
Cancella: `mirrorchat_profile_facts`, `mirrorchat_profile_md`, `mirrorchat_analysis_count` da localStorage + DELETE colonne da Supabase.

## Integrazione con le analisi

Il profilo MD (sezione scheda sintetica) viene incluso nel system prompt di OpenAI durante l'analisi chat. Aggiunta dinamica in `buildChatSystemPrompt()`:

```
Contesto sulla persona che ha ricevuto il messaggio:
{scheda sintetica dal profilo}

Usa questo contesto per contestualizzare meglio l'analisi.
```

Se il profilo non esiste o e vuoto, la sezione viene omessa.

## File

### Nuovi

| File | Responsabilita |
|------|---------------|
| `src/utils/profiler.js` | Estrazione fatti via Qwen, accumulo localStorage, trigger consolidamento, sync Supabase |
| `src/pages/Profile.jsx` | Pagina profilo: card info, scheda, sezioni espandibili, modifica, cancellazione |
| `src/pages/Profile.module.css` | Stili pagina profilo |

### Modificati

| File | Modifica |
|------|----------|
| `src/App.jsx` | Aggiunta route `/profile` |
| `src/components/Sidebar.jsx` | Aggiunta voce "Il mio profilo" |
| `src/pages/ChatAnalysis.jsx` | Dopo analisi, chiama `extractFacts()` in background |
| `src/pages/SafeVoice.jsx` | Dopo analisi voice, chiama `extractFacts()` in background |
| `src/utils/api.js` | Aggiunta `consolidateProfile(facts, previousProfile)` |
| `server.js` | Aggiunta endpoint `POST /api/profile` con system prompt consolidamento |

## Flusso completo

```
1. Utente analizza messaggio (chat o voice)
   └── Risultati mostrati normalmente

2. Background (non blocca):
   └── profiler.extractFacts(testoOriginale)
       ├── Qwen: "Elenca i fatti..."
       ├── Parse: [{fact, value, source, date}, ...]
       ├── Merge in localStorage
       └── Incrementa analysis_count

3. Se analysis_count % 3 === 0:
   └── profiler.consolidateProfile()
       ├── Legge fatti da localStorage
       ├── Legge MD precedente
       ├── POST /api/profile { facts, previousProfile }
       ├── OpenAI genera profilo MD
       ├── Salva MD in localStorage
       └── Sync Supabase

4. Prossima analisi:
   └── Scheda sintetica dal profilo inclusa nel system prompt
```
