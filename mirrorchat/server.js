const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
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

app.use(cors());
app.use(express.json({ limit: '10mb' }));
// In production serve the Vite build; in development Vite's dev server handles static files
app.use(express.static(path.join(__dirname, 'dist')));

const CHAT_SYSTEM = `Sei un esperto di psicologia delle relazioni e violenza psicologica. Analizza il seguente messaggio. Il messaggio è stato anonimizzato: i nomi sono [PERSONA_1], [PERSONA_2], ecc. NON tentare di de-anonimizzare. IMPORTANTE: analizza la manipolazione indipendentemente dal genere di chi scrive o riceve. La violenza psicologica non ha genere. Rispondi SOLO con JSON valido (nessun testo prima o dopo): { "tecnica": "gaslighting|love_bombing|colpevolizzazione|isolamento|controllo|svalutazione|idealizzazione|nessuna", "traduzione": "riscrittura del vero significato nascosto", "spiegazione": "perché è dannoso", "gravita": 1-5, "risposte": ["2-3 risposte assertive"], "risorse": true se gravità >= 3 }`;

const VOICE_SYSTEM = `Sei un sistema di rilevamento pericolo in tempo reale. Analizza questa trascrizione anonimizzata. Valuta il livello di PERICOLO IMMEDIATO (1-5): 1=normale, 2=tensione, 3=aggressività verbale, 4=intimidazione/minacce implicite, 5=minacce esplicite/violenza imminente. Rispondi SOLO con JSON: { "pericolo": 1-5, "motivo": "breve", "escalation": boolean, "sintesi_emergenza": "frase per 112 se pericolo>=4" }. CRITICO: minimizza falsi positivi.`;

function extractJSON(text) {
  var trimmed = text.trim();
  var start = trimmed.indexOf('{');
  var end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in response');
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function callLLM(systemPrompt, userMessage) {
  var response = await getOpenAIClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ]
  });
  var text = response.choices[0].message.content;
  return extractJSON(text);
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

// ── API: Chat analysis ────────────────────────────────────────
app.post('/api/chat', async function (req, res) {
  try {
    var message = req.body.message;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Campo "message" richiesto' });
    }
    var data = await callLLM(CHAT_SYSTEM, message);
    res.json(data);
  } catch (err) {
    console.error('[/api/chat]', err);
    res.status(500).json({
      error: true,
      tecnica: 'Errore',
      traduzione: '',
      spiegazione: 'Errore durante l\'analisi. Riprova tra qualche secondo.',
      gravita: 0,
      risposte: [],
      risorse: false
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

// SPA fallback
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, function () {
  console.log('MirrorChat server running on http://localhost:' + PORT);
});
