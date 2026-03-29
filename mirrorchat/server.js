const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const { spawn } = require('child_process');

// Load .env if present (optional — no crash if file is missing)
try { require('dotenv').config(); } catch (_) {}

const app = express();
const PORT = process.env.PORT || 3000;

// Lazy OpenAI client — created only when first API call is made
let _openaiClient = null;
function getOpenAIClient() {
  if (!_openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY non impostata. Aggiungila al file .env o come variabile d\'ambiente.');
    }
    _openaiClient = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openaiClient;
}

// Lazy Gemini client — used as fallback when OpenAI is unavailable
let _geminiClient = null;
function getGeminiClient() {
  if (!_geminiClient) {
    const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GOOGLE_API_KEY / GEMINI_API_KEY non impostata.');
    _geminiClient = new GoogleGenerativeAI(key);
  }
  return _geminiClient;
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false })); // Twilio webhooks
// In production serve the Vite build; in development Vite's dev server handles static files
app.use(express.static(path.join(__dirname, 'dist')));

const CHAT_SYSTEM = `Sei un esperto di psicologia delle relazioni e violenza psicologica. Analizza il seguente messaggio. Il messaggio è stato anonimizzato: i nomi sono [PERSONA_1], [PERSONA_2], ecc. NON tentare di de-anonimizzare. IMPORTANTE: analizza la manipolazione indipendentemente dal genere di chi scrive o riceve. La violenza psicologica non ha genere. Rispondi SOLO con JSON valido (nessun testo prima o dopo): { "tecnica": "gaslighting|love_bombing|colpevolizzazione|isolamento|controllo|svalutazione|idealizzazione|nessuna", "traduzione": "riscrittura del vero significato nascosto", "spiegazione": "perché è dannoso", "gravita": 1-5, "risposte": ["2-3 risposte assertive"], "risorse": true se gravità >= 3 }`;

const VOICE_SYSTEM = `Sei un sistema di rilevamento pericolo in tempo reale. Analizza questa trascrizione anonimizzata in tempo reale. Il tuo OBBIETTIVO CRITICO è valutare l'aggressività delle frasi con un livello da 1 a 5. Questo livello alimenterà un sistema a punteggio scalare.

Assegna anche un array di TAG alla frase scegliendo tra: neutro, calma, rassicurazione, disaccordo, gelosia, possessivita, svalutazione, aggressivita, gaslighting, restrizione, isolamento, intimidazione, minaccia_maledizioni, minaccia_morte, minaccia_percosse.

Regole ferree di assegnazione PERICOLO:
1 = normale/neutro/calma -> Indica una situazione sicura o che si sta disinnescando.
2 = disaccordo/tensione lieve/gelosia lieve.
3 = aggressività verbale media, gaslighting, svalutazione della persona.
4 = PRESENZA DI PATTERN GRAVI: violenza mentale distruttiva, restrizione della libertà, isolamento forzato, intimidazione generica.
5 = HARD TRIGGER IMMEDIATO: assegan 5 *SOLO ED ESCLUSIVAMENTE* in caso di minacce di morte esplicite ("ti ammazzo", "ti uccido") o promesse di violenza fisica diretta e immediata ("ti riempio di sberle", "ti spezzo le gambe"). 

Rispondi SOLO ed ESCLUSIVAMENTE con JSON valido: { "pericolo": 1-5, "tag": ["tag_applicabile"], "motivo": "breve motivo del punteggio e dei tag scelti", "escalation": boolean, "sintesi_emergenza": "frase per soccorsi (se 4-5)" }.`;

// ── Report System Prompt — analisi multi-messaggio ────────────
const REPORT_SYSTEM = `Sei un esperto di psicologia delle relazioni, violenza domestica e abuso psicologico. Il tuo compito è analizzare una serie di messaggi di chat (già anonimizzati: i nomi sono [PERSONA_1], [PERSONA_2], ecc.) e produrre un report dettagliato.

Per OGNI messaggio, identifica se contiene comportamenti riconducibili a:
- "gelosia" — gelosia possessiva, controllo ossessivo dei contatti
- "violenza_psicologica" — gaslighting, svalutazione, manipolazione emotiva
- "violenza_fisica" — minacce fisiche, intimidazioni violente
- "limitazione_personale" — isolamento, divieti, restrizioni della libertà
- "maltrattamento" — colpevolizzazione, ricatto emotivo, umiliazione
- "love_bombing" — bombardamento affettivo, idealizzazione/devalutazione
- "controllo_digitale" — monitoraggio telefono, social, posizione
- "nessuna" — messaggio neutro senza elementi problematici

IMPORTANTE:
- Analizza indipendentemente dal genere di chi scrive o riceve.
- NON tentare di de-anonimizzare.
- Sii preciso: non classificare come problematico un messaggio se non lo è realmente.
- La gravità va da 1 (lieve segnale) a 5 (pericolo grave).
- SE LA CHAT È MOLTO LUNGA (più di 30 messaggi), includi nell'array "report" ESCLUSIVAMENTE i messaggi problematici (gravità > 1), omettendo quelli neutri/nessuna, per evitare di tagliare l'output.

Rispondi SOLO con JSON valido (nessun testo prima o dopo):
{
  "report": [
    {
      "indice": 0,
      "autore": "chi ha inviato il messaggio",
      "messaggio": "testo originale del messaggio",
      "categoria": "gelosia|violenza_psicologica|violenza_fisica|limitazione_personale|maltrattamento|love_bombing|controllo_digitale|nessuna",
      "gravita": 1-5,
      "spiegazione": "perché è problematico (vuoto se nessuna)"
    }
  ],
  "riepilogo": {
    "messaggi_totali": N,
    "messaggi_problematici": N,
    "gravita_media": X.X,
    "categorie_rilevate": ["lista categorie trovate"],
    "valutazione_complessiva": "breve valutazione complessiva della situazione relazionale"
  }
}`;

const SAFE_PLACES_SYSTEM = `Sei un assistente di sicurezza per l'app MirrorChat. Il tuo compito è analizzare la richiesta di aiuto di un utente e consigliargli il posto più sicuro e adatto tra quelli disponibili nelle vicinanze.
Ti verranno forniti:
1. Il messaggio dell'utente (cosa sta succendendo).
2. Un elenco di "posti sicuri" (farmacie, stazioni di polizia, ospedali, centri d'ascolto) con nome, categoria, orari e coordinate.

REGOLE:
- Se l'utente è in pericolo immediato (violenza fisica in corso), dai priorità assoluta alla Polizia/Carabinieri.
- Se l'utente ha bisogno di parlare o è vittima di violenza psicologica, consiglia Centri d'Ascolto o Farmacie (spesso formate per il primo aiuto).
- Se l'utente è ferito, consiglia l'Ospedale.
- Fornisce una risposta empatica e rassicurante.
- Rispondi SOLO con un JSON valido (nessun testo prima o dopo):
{
  "text": "Messaggio di risposta rassicurante che spiega cosa fare.",
  "recommendedPlaceId": "ID del posto consigliato",
  "reason": "Breve motivo per cui hai scelto questo posto."
}`;

function extractJSON(text) {
  var trimmed = text.trim();
  // Try to find JSON — could be a simple object or may contain array bracket
  var start = trimmed.indexOf('{');
  var end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in response');
  return JSON.parse(trimmed.slice(start, end + 1));
}

// ── Session tracking per diarizzazione vocale ─────────────────
// voiceSessions[sessionId] = { userSpeakerId: 'speaker_0' | null, userName: 'Marco' }
const voiceSessions = new Map();
// Pulizia automatica sessioni inattive dopo 30 minuti
setInterval(() => {
  const now = Date.now();
  for (const [id, sess] of voiceSessions.entries()) {
    if (now - (sess.lastActivity || 0) > 30 * 60 * 1000) voiceSessions.delete(id);
  }
}, 5 * 60 * 1000);

// ── Gemini LLM call ───────────────────────────────────────────
async function callGemini(systemPrompt, userMessage, maxTokens = 1024) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
  });
  const result = await model.generateContent(userMessage);
  const text = result.response.text();
  return extractJSON(text);
}

// ── LLM call with OpenAI → Gemini fallback ────────────────────
async function callLLM(systemPrompt, userMessage, maxTokens = 1024) {
  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    try {
      var response = await getOpenAIClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      });
      var text = response.choices[0].message.content;
      return extractJSON(text);
    } catch (openaiErr) {
      console.warn('[callLLM] OpenAI fallito, provo Gemini...', openaiErr.message);
    }
  }

  // Fallback: Gemini
  const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      return await callGemini(systemPrompt, userMessage, maxTokens);
    } catch (geminiErr) {
      console.error('[callLLM] Anche Gemini fallito:', geminiErr.message);
      throw geminiErr;
    }
  }

  throw new Error('Nessun provider AI disponibile. Configura OPENAI_API_KEY o GOOGLE_API_KEY.');
}

// ── JS fallback anonymizer (used if Python is unavailable) ───
function jsAnonymize(text) {
  var result = text;
  var nameMap = {};
  var personCount = 0;

  result = result.replace(/(\+?\d{1,3}[\s.\-]?)?\(?\d{2,4}\)?[\s.\-]?\d{3,4}[\s.\-]?\d{3,4}/g, '[TELEFONO]');
  result = result.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  result = result.replace(/@[a-zA-Z0-9_.]{2,}/g, '@[USERNAME]');
  result = result.replace(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g, '[DATA]');

  var stopWords = new Set(['Non','Per','Con','Chi','Che','Come','Dove','Quando','Anche',
    'Ogni','Sempre','Dopo','Prima','Sono','Questa','Quello','Nella','Delle']);

  var sentences = result.split(/(?<=[.!?])\s+/);
  var names = new Set();
  sentences.forEach(function(sentence) {
    var words = sentence.split(/\s+/);
    words.forEach(function(word, i) {
      if (i === 0) return;
      var clean = word.replace(/[^a-zA-ZÀ-ÿ]/g, '');
      if (clean.length >= 3 && /^[A-ZÀ-Ÿ]/.test(clean) && !stopWords.has(clean)) {
        names.add(clean);
      }
    });
  });

  Array.from(names).sort(function(a,b){ return b.length - a.length; }).forEach(function(name) {
    if (!nameMap[name]) { personCount++; nameMap[name] = '[PERSONA_' + personCount + ']'; }
    result = result.replace(new RegExp('\\b' + name + '\\b', 'g'), nameMap[name]);
  });

  return { anonymized: result, mappings: { persone: nameMap }, method: 'js-fallback' };
}

// ── Python anonymizer ─────────────────────────────────────────
function runPythonAnonymizer(text) {
  return new Promise(function (resolve, reject) {
    var scriptPath = path.join(__dirname, 'scripts', 'anonymize.py');

    // Try 'python3' first, fall back to 'python'
    var cmd = process.platform === 'win32' ? 'python' : 'python3';
    var py = spawn(cmd, [scriptPath]);

    var stdout = '';
    var stderr = '';
    var timedOut = false;

    var timer = setTimeout(function () {
      timedOut = true;
      py.kill();
      reject(new Error('timeout'));
    }, 8000);

    py.stdin.write(text, 'utf8');
    py.stdin.end();

    py.stdout.on('data', function (d) { stdout += d.toString(); });
    py.stderr.on('data', function (d) { stderr += d.toString(); });

    py.on('close', function (code) {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0) {
        reject(new Error(stderr || 'Python script exited with code ' + code));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error('Invalid JSON from Python script'));
        }
      }
    });

    py.on('error', function (err) {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Qwen NER via Ollama (local model for name extraction + gender)
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

app.post('/api/qwen-ner', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Campo "prompt" richiesto' });
    }
    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false })
    });
    if (!ollamaRes.ok) throw new Error(`Ollama HTTP ${ollamaRes.status}`);
    const data = await ollamaRes.json();
    res.json({ text: data.response || '' });
  } catch (err) {
    console.error('[/api/qwen-ner]', err.message);
    res.status(500).json({ error: true, text: '' });
  }
});

// ── API: Anonymize ────────────────────────────────────────────
app.post('/api/anonymize', async function (req, res) {
  var text = req.body.text;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Campo "text" richiesto' });
  }
  // Try Python first, fall back to JS if Python is unavailable
  try {
    var result = await runPythonAnonymizer(text);
    result.method = 'python';
    res.json(result);
  } catch (err) {
    console.warn('[/api/anonymize] Python non disponibile, uso fallback JS:', err.message);
    try {
      var fallback = jsAnonymize(text);
      res.json(fallback);
    } catch (jsErr) {
      console.error('[/api/anonymize] Fallback JS fallito:', jsErr.message);
      res.status(500).json({ error: 'impossibile_anonimizzare', message: jsErr.message });
    }
  }
});

// ── Profile consolidation ──
const PROFILE_SYSTEM = `Sei un assistente che costruisce un profilo anonimo di una persona a partire da fatti estratti dalle sue conversazioni. Il profilo serve a fornire assistenza e protezione alla persona.

Genera un documento Markdown con due sezioni:
1. Scheda sintetica (bullet list: genere, età stimata, relazione, figli, contesto, pattern rilevati, livello rischio 1-5)
2. Sezioni narrative (situazione relazionale, contesto sociale, pattern di rischio, stato emotivo)

Se hai un profilo precedente, aggiornalo con i nuovi fatti senza perdere informazioni precedenti. Se un nuovo fatto contraddice uno vecchio, usa il più recente.

NON inventare informazioni. Se un dato non è noto, non includerlo.
Scrivi in italiano. Il profilo deve essere completamente anonimo: nessun nome, luogo o dato identificabile.`;

app.post('/api/profile', async (req, res) => {
  try {
    const { facts, previousProfile } = req.body;
    if (!facts || !Array.isArray(facts)) {
      return res.status(400).json({ error: 'Campo "facts" richiesto (array)' });
    }

    const factsStr = facts.map(f => `${f.fact}=${f.value} (${f.source}, ${f.date})`).join('\n');
    let userMessage = `Fatti estratti:\n${factsStr}`;
    if (previousProfile) {
      userMessage += `\n\nProfilo precedente:\n${previousProfile}`;
    }
    userMessage += '\n\nGenera il profilo aggiornato in Markdown.';

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: PROFILE_SYSTEM },
        { role: 'user', content: userMessage }
      ]
    });
    const profile = response.choices[0].message.content.trim();
    res.json({ profile });
  } catch (err) {
    console.error('[/api/profile]', err);
    res.status(500).json({ error: true, profile: '' });
  }
});

// ── API: Chat analysis ────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, genere_utente, persone } = req.body;
    if (!message || typeof message !== 'string')
      return res.status(400).json({ error: 'Campo "message" richiesto' });

    let systemPrompt = CHAT_SYSTEM;

    const personeEntries = Object.entries(persone || {});
    if (personeEntries.length > 0) {
      systemPrompt += '\n\nPersone nella conversazione:';
      for (const [token, genere] of personeEntries) {
        systemPrompt += `\n- ${token}: ${genere}`;
      }
    }

    if (genere_utente && genere_utente !== 'non_specificato') {
      systemPrompt += `\n\nL'utente che ha ricevuto il messaggio si identifica come: ${genere_utente}.`;
    }

    if (personeEntries.length > 0 || (genere_utente && genere_utente !== 'non_specificato')) {
      systemPrompt += '\n\nUsa queste informazioni per contestualizzare le dinamiche relazionali, senza stereotipi.';
    }

    const result = await callLLM(systemPrompt, message);
    res.json(result);
  } catch (err) {
    console.error('[/api/chat]', err);
    res.status(500).json({
      error: true,
      tecnica: 'Errore',
      traduzione: '',
      spiegazione: "Errore durante l'analisi. Riprova tra qualche secondo.",
      gravita: 0,
      risposte: [],
      risorse: false
    });
  }
});

// ── API: Chat report — analisi multi-messaggio ────────────────
app.post('/api/chat-report', async (req, res) => {
  try {
    const { messages, genere_utente, persone } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Campo "messages" richiesto (array non vuoto)' });
    }

    // Build system prompt with optional context
    let systemPrompt = REPORT_SYSTEM;

    const personeEntries = Object.entries(persone || {});
    if (personeEntries.length > 0) {
      systemPrompt += '\n\nPersone nella conversazione:';
      for (const [token, genere] of personeEntries) {
        systemPrompt += `\n- ${token}: ${genere}`;
      }
    }

    if (genere_utente && genere_utente !== 'non_specificato') {
      systemPrompt += `\n\nL'utente che ha ricevuto i messaggi si identifica come: ${genere_utente}.`;
    }

    if (personeEntries.length > 0 || (genere_utente && genere_utente !== 'non_specificato')) {
      systemPrompt += '\nUsa queste informazioni per contestualizzare le dinamiche relazionali, senza stereotipi.';
    }

    // Format messages as numbered list for the LLM
    const numberedMessages = messages.map((m, i) => `[${i}] ${m}`).join('\n');
    const userMessage = `Analizza i seguenti ${messages.length} messaggi di chat:\n\n${numberedMessages}`;

    // Use higher token limit for reports (can be large). 8192 is the default safe max for standard models.
    const result = await callLLM(systemPrompt, userMessage, 8192);

    // Validate and sanitize the response
    if (!result.report || !Array.isArray(result.report)) {
      throw new Error('Risposta AI non valida: mancano i dati del report');
    }

    // Ensure riepilogo exists
    if (!result.riepilogo) {
      const problematic = result.report.filter(r => r.categoria !== 'nessuna');
      const gravities = problematic.map(r => r.gravita).filter(g => g > 0);
      result.riepilogo = {
        messaggi_totali: messages.length,
        messaggi_problematici: problematic.length,
        gravita_media: gravities.length > 0 ? +(gravities.reduce((a, b) => a + b, 0) / gravities.length).toFixed(1) : 0,
        categorie_rilevate: [...new Set(problematic.map(r => r.categoria))],
        valutazione_complessiva: 'Analisi completata.'
      };
    }

    res.json(result);
  } catch (err) {
    console.error('[/api/chat-report]', err);
    res.status(500).json({
      error: true,
      report: [],
      riepilogo: {
        messaggi_totali: 0,
        messaggi_problematici: 0,
        gravita_media: 0,
        categorie_rilevate: [],
        valutazione_complessiva: 'Errore durante l\'analisi. Riprova tra qualche secondo.'
      }
    });
  }
});

// ── API: Voice analysis ───────────────────────────────────────
app.post('/api/voice', async function (req, res) {
  try {
    var transcript = req.body.transcript;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Campo "transcript" richiesto' });
    }
    var data = await callLLM(VOICE_SYSTEM, transcript);
    res.json(data);
  } catch (err) {
    console.error('[/api/voice]', err.message);
    res.status(500).json({
      error: true,
      pericolo: 0,
      motivo: 'Errore durante l\'analisi.',
      escalation: false,
      sintesi_emergenza: ''
    });
  }
});

// ── Learning Quiz System ──────────────────────────────────────
const QUIZ_SYSTEM = `Sei un esperto psicologo e formatore. Il tuo obiettivo è educare le vittime di dinamiche relazionali tossiche.
Riceverai in input un set di "tematiche problematiche" (es. limitazione personale, gelosia possessiva) ed eventualmente frammenti di contesto anonimo estratti dalle loro chat.
Il tuo compito è generare un quiz educativo di 3-4 domande a scelta multipla specificamente incentrate su quei temi per far ragionare la persona.

REGOLE CRITICHE:
Le domande devono essere INDIRETTE: non puntare il dito sull'utente ("Perché lui ti controlla?") e non far capire esplicitamente che si parla della sua situazione, ma usa scenari in terza persona (es. "Se in una relazione di coppia un partner esige le password, questo è segnale di:"). L'obiettivo è instillare un dubbio e far capire l'inaccettabilità di quelle azioni.

Rispondi SOLO con un JSON valido (nessun testo prima o dopo):
{
  "titolo": "Riconoscere l'abuso invisibile",
  "introduzione": "Mettiti alla prova su alcune dinamiche di coppia.",
  "domande": [
    {
      "testo": "Testo della domanda...",
      "opzioni": ["A...", "B...", "C..."],
      "risposta_corretta_index": 0,
      "spiegazione": "Breve spiegazione psicologica del perché questa è la risposta corretta e perché l'azione descritta non è giustificabile."
    }
  ]
}`;

app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { tags, contesti } = req.body;
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Nessun tag fornito per il quiz' });
    }

    let userMessage = `TEMA/I DEL QUIZ:\n${tags.join(', ')}\n\n`;
    if (contesti && Array.isArray(contesti) && contesti.length > 0) {
      userMessage += `CONTESTO ANONIMIZZATO DA CUI PRENDERE ISPIRAZIONE (Non menzionare i nomi, crea scenari simili ma slegati):\n${contesti.join('\\n')}\n\n`;
    }
    userMessage += "Genera il quiz in formato JSON.";

    const data = await callLLM(QUIZ_SYSTEM, userMessage, 8000); // 8k tokens handle large JSON nicely
    res.json(data);
  } catch (err) {
    console.error('[/api/generate-quiz]', err.message);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// ── Lazy Supabase client ──────────────────────────────────────
var _supabaseClient = null;
function getSupabase() {
  if (!_supabaseClient) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY non impostate.');
    }
    var supabase = require('@supabase/supabase-js');
    _supabaseClient = supabase.createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return _supabaseClient;
}

// ── Lazy Twilio client (solo SMS) ────────────────────────────
var _twilioClient = null;
function getTwilio() {
  if (!_twilioClient) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN non impostate.');
    }
    _twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return _twilioClient;
}

// ── Bland.ai — chiama un numero con messaggio vocale ─────────
async function blandAiCall(phoneNumber, message) {
  if (!process.env.BLAND_AI_API_KEY) throw new Error('BLAND_AI_API_KEY non impostata.');
  var res = await fetch('https://api.bland.ai/v1/calls', {
    method: 'POST',
    headers: {
      'authorization': process.env.BLAND_AI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone_number: phoneNumber,
      task: message,
      language: 'it',
      max_duration: 2,
      record: false,
      wait_for_greeting: false,
    }),
  });
  if (!res.ok) {
    var err = await res.text();
    throw new Error('Bland.ai error: ' + err);
  }
  return res.json();
}

// ── API: Registrazione utente (senza OTP) ────────────────────
app.post('/api/auth/register', async function (req, res) {
  try {
    var name = req.body.name;
    var phone = req.body.phone;
    if (!name || !phone) {
      return res.status(400).json({ error: 'name e phone richiesti' });
    }
    var supabase = getSupabase();
    var result = await supabase
      .from('users')
      .upsert({ name: name, phone: phone }, { onConflict: 'phone' })
      .select()
      .single();
    if (result.error) throw result.error;
    res.json({ user: result.data });
  } catch (err) {
    console.error('[/api/auth/register]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: Profilo utente ───────────────────────────────────────
app.get('/api/user/:phone', async function (req, res) {
  try {
    var supabase = getSupabase();
    var phone = decodeURIComponent(req.params.phone);
    var result = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .single();
    if (result.error || !result.data) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Salva contatti (sostituisce tutti per userId) ────────
app.post('/api/contacts', async function (req, res) {
  try {
    var userId = req.body.userId;
    var contacts = req.body.contacts;
    if (!userId || !Array.isArray(contacts)) {
      return res.status(400).json({ error: 'userId e contacts[] richiesti' });
    }
    var supabase = getSupabase();
    await supabase.from('emergency_contacts').delete().eq('user_id', userId);
    if (contacts.length > 0) {
      var rows = contacts.map(function (c, i) {
        return {
          user_id: userId,
          name: c.name,
          surname: c.surname || '',
          relationship: c.relationship || '',
          phone: c.phone,
          priority: i,
        };
      });
      var insertResult = await supabase.from('emergency_contacts').insert(rows);
      if (insertResult.error) throw insertResult.error;
    }
    res.json({ saved: contacts.length });
  } catch (err) {
    console.error('[/api/contacts POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: Leggi contatti per userId ────────────────────────────
app.get('/api/contacts/:userId', async function (req, res) {
  try {
    var supabase = getSupabase();
    var result = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', req.params.userId)
      .order('priority', { ascending: true });
    if (result.error) throw result.error;
    res.json({ contacts: result.data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers diarizzazione ─────────────────────────────────────
/**
 * Converte l'array di words ElevenLabs (con speaker_id) in segmenti speaker.
 * Restituisce: [{ speaker_id, text }]
 */
function buildSpeakerSegments(words) {
  if (!words || words.length === 0) return [];
  const segments = [];
  let current = null;
  for (const w of words) {
    if (w.type !== 'word' && w.type !== 'spacing') continue;
    const sid = w.speaker_id || 'speaker_0';
    if (!current || current.speaker_id !== sid) {
      current = { speaker_id: sid, text: '' };
      segments.push(current);
    }
    current.text += (current.text ? ' ' : '') + (w.text || '').trim();
  }
  return segments.filter(s => s.text.trim());
}

/**
 * Etichetta i segmenti sostituendo speaker_id con nomi umani.
 * userSpeakerId: 'speaker_0' | null — il speaker che corrisponde all'utente
 * userName: 'Marco'
 */
function labelSegments(segments, userSpeakerId, userName) {
  return segments.map(seg => ({
    ...seg,
    label: userSpeakerId && seg.speaker_id === userSpeakerId
      ? userName
      : 'Soggetto Estraneo',
    isUser: userSpeakerId ? seg.speaker_id === userSpeakerId : null,
  }));
}

// ── API: Trascrizione + Analisi real-time (con diarizzazione) ──
app.post('/api/voice-realtime', async function (req, res) {
  try {
    var audio      = req.body.audio;
    var mimeType   = req.body.mimeType   || 'audio/webm';
    var sessionId  = req.body.sessionId  || null;   // ID univoco di sessione (generato lato client)
    var userName   = req.body.userName   || 'Tu';   // Nome dell'utente loggato

    if (!audio) return res.status(400).json({ error: 'audio richiesto' });

    // Recupera/crea sessione
    if (sessionId && !voiceSessions.has(sessionId)) {
      voiceSessions.set(sessionId, { userSpeakerId: null, userName, lastActivity: Date.now() });
    }
    const sess = sessionId ? voiceSessions.get(sessionId) : null;
    if (sess) { sess.lastActivity = Date.now(); sess.userName = userName; }

    // Pulisci il mimeType (es. "audio/webm;codecs=opus" -> "audio/webm")
    const cleanMimeType = mimeType.split(';')[0];
    var buffer = Buffer.from(audio, 'base64');

    // ── Variabili risultato ───────────────────────────────────────
    var transcript = '';          // testo grezzo unificato
    var speakerSegments = null;   // array [{speaker_id, label, isUser, text}] | null
    var diarizationAvailable = false;

    // ── 1a. Prova ElevenLabs Scribe CON diarizzazione ─────────────
    const elHasKey = !!process.env.ELEVENLABS_API_KEY;
    if (elHasKey) {
      try {
        var elForm = new FormData();
        elForm.append('file', new Blob([new Uint8Array(buffer)], { type: cleanMimeType }), 'chunk.webm');
        elForm.append('model_id', 'scribe_v1');
        elForm.append('diarize', 'true');          // ← abilita speaker diarization
        elForm.append('num_speakers', '2');        // massimo 2 speaker (utente + estraneo)

        var elRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
          body: elForm,
        });

        if (elRes.ok) {
          var elData = await elRes.json();
          transcript = (elData.text || '').trim();

          // Processa diarizzazione se presente
          if (elData.words && elData.words.length > 0) {
            const rawSegments = buildSpeakerSegments(elData.words);

            if (rawSegments.length > 0) {
              // Prima chiamata della sessione: il primo speaker che parla = utente loggato
              if (sess && !sess.userSpeakerId) {
                sess.userSpeakerId = rawSegments[0].speaker_id;
                console.log(`[Diarization] Sessione ${sessionId}: utente="${userName}" → ${sess.userSpeakerId}`);
              }

              const userSpk = sess ? sess.userSpeakerId : rawSegments[0].speaker_id;
              speakerSegments = labelSegments(rawSegments, userSpk, userName);
              diarizationAvailable = true;
            }
          }
        } else {
          const elErr = await elRes.text();
          console.warn('[ElevenLabs Scribe] Errore:', elErr);
          throw new Error('ElevenLabs fallback');
        }
      } catch (elErr) {
        console.log('[STT] ElevenLabs non disponibile, uso OpenAI Whisper...');
      }
    }

    // ── 1b. Fallback OpenAI Whisper (senza diarizzazione) ────────
    if (!transcript && process.env.OPENAI_API_KEY) {
      try {
        var wForm = new FormData();
        wForm.append('file', new Blob([new Uint8Array(buffer)], { type: 'audio/webm' }), 'chunk.webm');
        wForm.append('model', 'whisper-1');
        wForm.append('language', 'it');

        var wRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY },
          body: wForm,
        });

        if (!wRes.ok) throw new Error('Whisper HTTP ' + wRes.status);
        var wData = await wRes.json();
        transcript = (wData.text || '').trim();
        console.log('[STT] Whisper OK (no diarizzazione).');
      } catch (wErr) {
        console.error('[STT] Whisper fallito:', wErr.message);
      }
    }

    if (!transcript) {
      return res.json({
        transcript: '', anonymized: '',
        speakerSegments: [], diarizationAvailable: false,
        pericolo: 1, motivo: 'Silenzio', escalation: false, sintesi_emergenza: ''
      });
    }

    if (!transcript) {
      return res.status(502).json({
        error: 'Trascrizione fallita su tutti i provider',
        transcript: '', pericolo: 1, motivo: 'Errore STT', escalation: false, sintesi_emergenza: ''
      });
    }

    // 2. Anonimizza
    var anonResult = jsAnonymize(transcript);
    var anonymized = anonResult.anonymized;

    // 3. Analisi LLM
    var analysis = await callLLM(VOICE_SYSTEM, anonymized);

    res.json(Object.assign(
      { transcript, anonymized, speakerSegments: speakerSegments || [], diarizationAvailable },
      analysis
    ));
  } catch (err) {
    console.error('[/api/voice-realtime]', err.message);
    res.status(500).json({
      error: err.message, transcript: '', speakerSegments: [], diarizationAvailable: false,
      pericolo: 1, motivo: 'Errore interno', escalation: false, sintesi_emergenza: ''
    });
  }
});

// ── API: Reset sessione vocale ────────────────────────────────
app.delete('/api/voice-session/:sessionId', function (req, res) {
  voiceSessions.delete(req.params.sessionId);
  res.json({ ok: true });
});

// ── API: Emergenza — Chiamata (Bland.ai) ─────────────────────
app.post('/api/emergency/call', async function (req, res) {
  try {
    var userName = req.body.userName || 'Un utente';
    var contacts = req.body.contacts || [];
    var dangerContext = req.body.dangerContext || 'pericolo rilevato';

    if (contacts.length === 0) {
      return res.status(400).json({ error: 'Nessun contatto fornito' });
    }

    var message = 'Attenzione. ' + userName + ' potrebbe essere in pericolo. ' +
      'L\'app MirrorChat ha rilevato: ' + dangerContext + '. ' +
      'Per favore contatta immediatamente ' + userName + '.';

    var results = await Promise.allSettled(
      contacts.map(function (c) { return blandAiCall(c.phone, message); })
    );

    var called = results.filter(function (r) { return r.status === 'fulfilled'; }).length;
    res.json({ called: called, total: contacts.length });
  } catch (err) {
    console.error('[/api/emergency/call]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: Emergenza — SMS ──────────────────────────────────────
app.post('/api/emergency/sms', async function (req, res) {
  try {
    var userName = req.body.userName || 'Un utente';
    var contacts = req.body.contacts || [];
    var lat = req.body.lat;
    var lon = req.body.lon;
    var dangerContext = req.body.dangerContext || 'pericolo rilevato';

    if (contacts.length === 0) {
      return res.status(400).json({ error: 'Nessun contatto fornito' });
    }

    var locationPart = (lat != null && lon != null)
      ? ' Posizione: https://maps.google.com/?q=' + lat + ',' + lon
      : ' Posizione non disponibile.';

    var smsBody = 'SOS MirrorChat: ' + userName + ' potrebbe essere in pericolo. ' +
      'Pattern: ' + dangerContext + '.' + locationPart;

    var client = getTwilio();
    var results = await Promise.allSettled(contacts.map(function (c) {
      return client.messages.create({
        body: smsBody,
        to: c.phone,
        from: process.env.TWILIO_PHONE_NUMBER,
      });
    }));

    var sent = results.filter(function (r) { return r.status === 'fulfilled'; }).length;
    res.json({ sent: sent, total: contacts.length });
  } catch (err) {
    console.error('[/api/emergency/sms]', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ── API: Safe Places — Nearby search (Overpass API) ──────────
app.get('/api/places/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = 5000; // 5km radius

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Latitudine e Longitudine richieste' });
    }

    // Overpass QL query: find pharmacies, police, hospitals, and busy/safe facilities
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"pharmacy|police|hospital|social_facility|townhall|library|theatre|cinema|community_centre"](around:${radius},${lat},${lng});
        way["amenity"~"pharmacy|police|hospital|social_facility|townhall|library|theatre|cinema|community_centre"](around:${radius},${lat},${lng});
        node["shop"~"mall|supermarket"](around:${radius},${lat},${lng});
        way["shop"~"mall|supermarket"](around:${radius},${lat},${lng});
      );
      out center;
    `;

    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`Overpass error: ${response.status}`);
    
    const data = await response.json();
    
    // Map OSM data to our application format
    const places = data.elements.map(el => {
      const tags = el.tags || {};
      return {
        id: el.id.toString(),
        name: tags.name || tags.operator || (tags.amenity ? tags.amenity.charAt(0).toUpperCase() + tags.amenity.slice(1) : 'Luogo sicuro'),
        lat: el.center ? el.center.lat : el.lat,
        lng: el.center ? el.center.lng : el.lon,
        category: tags.amenity,
        phone: tags.phone || tags['contact:phone'] || '',
        opening_hours: tags.opening_hours || ''
      };
    });

    res.json({ places });
  } catch (err) {
    console.error('[/api/places/nearby]', err.message);
    res.status(500).json({ error: 'Errore nel recupero dei luoghi vicini', places: [] });
  }
});

// ── API: Safe Places — IA Chat Recommendation ────────────────
app.post('/api/places/chat', async (req, res) => {
  try {
    const { message, places } = req.body;
    if (!message) return res.status(400).json({ error: 'Messaggio richiesto' });

    const placesContext = (places || []).slice(0, 10).map(p => 
      `ID: ${p.id}, Nome: ${p.name}, Categoria: ${p.category}, Orari: ${p.opening_hours || 'N/A'}`
    ).join('\n');

    const userMessage = `Messaggio utente: "${message}"\n\nPosti disponibili:\n${placesContext}`;
    
    const result = await callLLM(SAFE_PLACES_SYSTEM, userMessage);
    res.json(result);
  } catch (err) {
    console.error('[/api/places/chat]', err.message);
    res.status(500).json({ 
      text: 'Mi dispiace, ho avuto un problema tecnico. Se sei in pericolo immediato scappa o chiama il 112.', 
      recommendedPlaceId: null,
      reason: 'Errore tecnico'
    });
  }
});

// SPA fallback
app.get('/{*splat}', function (req, res) {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, function () {
  console.log('MirrorChat server running on http://localhost:' + PORT);
});
