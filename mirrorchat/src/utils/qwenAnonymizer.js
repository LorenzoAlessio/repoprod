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

const NER_PROMPT = `Elenca i nomi propri di persona in questa frase. Scrivi ogni nome su una riga nel formato: nome - uomo oppure nome - donna

Frase: anna ha litigato con luca
anna - donna
luca - uomo

Frase: ieri sono stato da elena e il suo ragazzo paolo
elena - donna
paolo - uomo

Frase: {TEXT}
`;

const SKIP_WORDS = new Set([
  'ieri','oggi','domani','sempre','anche','come','dove','quando',
  'picchiata','picchiato','uscita','uscito','chiamata','chiamato',
  'arrabbiata','arrabbiato','stanca','stanco','tornata','tornato',
  'andata','andato','detta','detto','fatta','fatto','messa','messo',
  'presa','preso','vista','visto','stata','stato','avuta','avuto'
]);

function parseNerOutput(output, originalText) {
  const entities = [];
  // Match "Nome - Genere" or "Nome = Genere" or "Nome: Genere" or "Nome (Genere)"
  const matches = output.matchAll(/([a-zA-ZÀ-ÿ]{2,})\s*[-=:(]\s*(\w+)/gi);
  for (const m of matches) {
    let name = m[1].trim();
    let gender = m[2].trim().toLowerCase();
    // Normalize gender variants
    if (['maschio','mascio','maschile','m','male'].includes(gender)) gender = 'uomo';
    if (['femmina','femminile','f','female'].includes(gender)) gender = 'donna';
    if (!['uomo','donna'].includes(gender)) gender = 'non_determinato';
    // Skip common words and names not in original text
    if (SKIP_WORDS.has(name.toLowerCase())) continue;
    if (!originalText.toLowerCase().includes(name.toLowerCase())) continue;
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

    const entities = parseNerOutput(output, chunks[i]);
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
