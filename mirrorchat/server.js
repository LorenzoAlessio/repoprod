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
app.use(express.urlencoded({ extended: false })); // Twilio webhooks
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

// ── API: Trascrizione + Analisi real-time ─────────────────────
app.post('/api/voice-realtime', async function (req, res) {
  try {
    var audio = req.body.audio;
    var mimeType = req.body.mimeType || 'audio/webm';
    if (!audio) return res.status(400).json({ error: 'audio richiesto' });
    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: 'ELEVENLABS_API_KEY non impostata' });
    }

    // 1. Trascrivi con ElevenLabs Scribe
    var buffer = Buffer.from(audio, 'base64');
    var formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), 'chunk.webm');
    formData.append('model_id', 'scribe_v1');

    var elRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      body: formData,
    });

    if (!elRes.ok) {
      var elErr = await elRes.text();
      console.error('[ElevenLabs Scribe]', elErr);
      return res.status(502).json({ error: 'Trascrizione fallita', transcript: '', pericolo: 1, motivo: '', escalation: false, sintesi_emergenza: '' });
    }

    var elData = await elRes.json();
    var transcript = (elData.text || '').trim();

    if (!transcript) {
      return res.json({ transcript: '', anonymized: '', pericolo: 1, motivo: 'Silenzio', escalation: false, sintesi_emergenza: '' });
    }

    // 2. Anonimizza (JS locale, veloce)
    var anonResult = jsAnonymize(transcript);
    var anonymized = anonResult.anonymized;

    // 3. Analizza con LLM
    var analysis = await callLLM(VOICE_SYSTEM, anonymized);

    res.json(Object.assign({ transcript: transcript, anonymized: anonymized }, analysis));
  } catch (err) {
    console.error('[/api/voice-realtime]', err.message);
    res.status(500).json({ error: err.message, transcript: '', pericolo: 1, motivo: 'Errore interno', escalation: false, sintesi_emergenza: '' });
  }
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


// SPA fallback
app.get('/{*splat}', function (req, res) {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, function () {
  console.log('MirrorChat server running on http://localhost:' + PORT);
});
