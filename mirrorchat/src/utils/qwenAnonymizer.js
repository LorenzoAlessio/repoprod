import { chunkText } from './chunker';
import { anonymize as anonymizeRegex } from './anonymizer';

const API_BASE = '';

async function callQwenViaServer(prompt) {
  const res = await fetch(`${API_BASE}/api/qwen-ner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error(`Qwen NER HTTP ${res.status}`);
  const data = await res.json();
  return data.text || '';
}

const NER_PROMPT = `Quali nomi di persona ci sono in questo testo? Per ognuno scrivi se è uomo, donna o non_determinato.

Testo: "Marco ha chiamato Sara dal bar"
Marco=uomo, Sara=donna

Testo: "ieri ho parlato con luca e la sua ragazza giulia mi ha detto che"
luca=uomo, giulia=donna

Testo: "{TEXT}"
`;

const SKIP_WORDS = new Set([
  'ieri','oggi','domani','sempre','anche','come','dove','quando',
  'picchiata','picchiato','uscita','uscito','chiamata','chiamato',
  'arrabbiata','arrabbiato','stanca','stanco','tornata','tornato',
  'andata','andato','detta','detto','fatta','fatto','messa','messo',
  'presa','preso','vista','visto','stata','stato','avuta','avuto'
]);

function parseNerOutput(output) {
  const entities = [];
  const matches = output.matchAll(/([a-zA-ZÀ-ÿ]{2,})\s*=\s*(uomo|donna|maschio|femmina|non_determinato|non determinato)/gi);
  for (const m of matches) {
    let name = m[1].trim();
    let gender = m[2].trim().toLowerCase();
    if (gender === 'maschio') gender = 'uomo';
    if (gender === 'femmina') gender = 'donna';
    if (gender === 'non determinato') gender = 'non_determinato';
    if (SKIP_WORDS.has(name.toLowerCase())) continue;
    if (!entities.find(e => e.value.toLowerCase() === name.toLowerCase())) {
      entities.push({ type: 'PERSONA', value: name, gender });
    }
  }
  return entities;
}

const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SOCIAL_RE = /@[a-zA-Z0-9_.]{2,}/g;
const DATE_RE = /\b\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?\b/g;

function substituteEntities(text, personEntities) {
  let result = text;
  const personeGender = {};
  const mappings = {};
  let personaCount = 0;

  const sorted = [...personEntities].sort((a, b) => b.value.length - a.value.length);
  for (const ent of sorted) {
    if (mappings[ent.value]) continue;
    personaCount++;
    const token = `[PERSONA_${personaCount}]`;
    personeGender[token] = ent.gender || 'non_determinato';
    mappings[ent.value] = token;
    const escaped = ent.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), token);
  }

  result = result.replace(PHONE_RE, '[TELEFONO]');
  result = result.replace(EMAIL_RE, '[EMAIL]');
  result = result.replace(SOCIAL_RE, '@[USERNAME]');
  result = result.replace(DATE_RE, '[DATA]');

  return { anonymized: result, mappings, personeGender };
}

export async function anonymizeWithQwen(text, onProgress) {
  const chunks = chunkText(text);
  const allEntities = [];
  let anySuccess = false;

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.({
      phase: 'anonymizing',
      current: i + 1,
      total: chunks.length,
      entities: allEntities.length
    });

    const prompt = NER_PROMPT.replace('{TEXT}', chunks[i]);
    let output;

    try {
      output = await callQwenViaServer(prompt);
    } catch {
      try { output = await callQwenViaServer(prompt); } catch { continue; }
    }

    const entities = parseNerOutput(output);
    if (entities.length > 0) {
      for (const ent of entities) {
        if (!allEntities.find(e => e.value.toLowerCase() === ent.value.toLowerCase())) {
          allEntities.push(ent);
        }
      }
      anySuccess = true;
    }
  }

  if (!anySuccess || allEntities.length === 0) {
    onProgress?.({ phase: 'done', usedFallback: true });
    const result = anonymizeRegex(text);
    return { ...result, personeGender: {} };
  }

  const { anonymized, mappings, personeGender } = substituteEntities(text, allEntities);

  onProgress?.({
    phase: 'done',
    usedFallback: false,
    entityCount: allEntities.length,
    personeCount: Object.keys(personeGender).length
  });

  return {
    anonymized,
    mappings: { persone: mappings },
    personeGender
  };
}
