const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI.default({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const CHAT_SYSTEM = `Sei un esperto di psicologia delle relazioni e violenza psicologica. Analizza il seguente messaggio ricevuto da un adolescente. Il messaggio è stato anonimizzato: i nomi sono [PERSONA_1], [PERSONA_2], ecc. NON tentare di de-anonimizzare. IMPORTANTE: analizza la manipolazione indipendentemente dal genere di chi scrive o riceve. La violenza psicologica non ha genere. Rispondi SOLO con JSON valido (nessun testo prima o dopo): { "tecnica": "gaslighting|love_bombing|colpevolizzazione|isolamento|controllo|svalutazione|idealizzazione|nessuna", "traduzione": "riscrittura del vero significato nascosto", "spiegazione": "perché è dannoso, linguaggio 14-19 anni", "gravita": 1-5, "risposte": ["2-3 risposte assertive"], "risorse": true se gravità >= 3 }`;

const VOICE_SYSTEM = `Sei un sistema di rilevamento pericolo in tempo reale. Analizza questa trascrizione anonimizzata. Valuta il livello di PERICOLO IMMEDIATO (1-5): 1=normale, 2=tensione, 3=aggressività verbale, 4=intimidazione/minacce implicite, 5=minacce esplicite/violenza imminente. Rispondi SOLO con JSON: { "pericolo": 1-5, "motivo": "breve", "escalation": boolean, "sintesi_emergenza": "frase per 112 se pericolo>=4" }. CRITICO: minimizza falsi positivi.`;

function extractJSON(text) {
  var trimmed = text.trim();
  var start = trimmed.indexOf('{');
  var end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in response');
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function callLLM(systemPrompt, userMessage) {
  var response = await client.chat.completions.create({
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

app.listen(PORT, function () {
  console.log('MirrorChat server running on http://localhost:' + PORT);
});
