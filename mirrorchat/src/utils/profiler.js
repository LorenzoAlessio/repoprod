// src/utils/profiler.js
// Extracts anonymous facts from text via Qwen, accumulates in localStorage,
// triggers profile consolidation every 3 analyses.

const API_BASE = '';
const FACTS_KEY = 'mirrorchat_profile_facts';
const PROFILE_KEY = 'mirrorchat_profile_md';
const COUNT_KEY = 'mirrorchat_analysis_count';
const CONSOLIDATE_EVERY = 3;

const EXTRACT_PROMPT = `Leggi questo messaggio e estrai informazioni sulla persona che lo ha scritto o ricevuto. Rispondi SOLO con una lista di fatti, uno per riga, nel formato: categoria=valore

Categorie possibili: genere, eta_stimata, ha_partner, genere_partner, tipo_relazione, ha_figli, vive_con, studia, lavora, stato_emotivo, isolamento

Messaggio: mio marito non vuole che esco con le mie amiche, dice che sono una cattiva influenza. Ho paura, devo portare i bambini a scuola domani
genere=donna, ha_partner=si, genere_partner=uomo, tipo_relazione=marito, ha_figli=si, stato_emotivo=paura, isolamento=si

Messaggio: {TEXT}
`;

function getStoredFacts() {
  try {
    return JSON.parse(localStorage.getItem(FACTS_KEY) || '[]');
  } catch { return []; }
}

function storeFacts(facts) {
  localStorage.setItem(FACTS_KEY, JSON.stringify(facts));
}

export function getStoredProfile() {
  return localStorage.getItem(PROFILE_KEY) || '';
}

export function getStoredProfileData() {
  return {
    profile: getStoredProfile(),
    facts: getStoredFacts(),
    analysisCount: parseInt(localStorage.getItem(COUNT_KEY) || '0', 10)
  };
}

function parseFacts(output, source) {
  const facts = [];
  const date = new Date().toISOString().split('T')[0];
  // Match category=value patterns
  const matches = output.matchAll(/([a-z_]+)\s*=\s*([^,\n]+)/gi);
  for (const m of matches) {
    const fact = m[1].trim().toLowerCase();
    const value = m[2].trim().toLowerCase();
    if (fact && value && fact.length > 2 && value.length > 0) {
      facts.push({ fact, value, confidence: 0.9, source, date });
    }
  }
  return facts;
}

function mergeFacts(existing, newFacts) {
  const merged = [...existing];
  for (const nf of newFacts) {
    const idx = merged.findIndex(f => f.fact === nf.fact);
    if (idx >= 0) {
      // Keep more recent
      merged[idx] = nf;
    } else {
      merged.push(nf);
    }
  }
  return merged;
}

async function callQwen(prompt) {
  const res = await fetch(`${API_BASE}/api/qwen-ner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error(`Qwen HTTP ${res.status}`);
  const data = await res.json();
  return data.text || '';
}

async function callConsolidate(facts, previousProfile) {
  const res = await fetch(`${API_BASE}/api/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ facts, previousProfile })
  });
  if (!res.ok) throw new Error(`Profile API HTTP ${res.status}`);
  const data = await res.json();
  return data.profile || '';
}

// Call this after every chat/voice analysis (in background, non-blocking)
export async function extractFacts(originalText, source = 'chat') {
  try {
    const prompt = EXTRACT_PROMPT.replace('{TEXT}', originalText);
    const output = await callQwen(prompt);
    const newFacts = parseFacts(output, source);

    if (newFacts.length > 0) {
      const existing = getStoredFacts();
      const merged = mergeFacts(existing, newFacts);
      storeFacts(merged);
    }

    // Increment analysis count
    const count = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10) + 1;
    localStorage.setItem(COUNT_KEY, String(count));

    // Consolidate every N analyses
    if (count % CONSOLIDATE_EVERY === 0) {
      await consolidateProfile();
    }
  } catch (err) {
    console.error('[profiler] extractFacts error:', err.message);
  }
}

export async function consolidateProfile() {
  try {
    const facts = getStoredFacts();
    if (facts.length === 0) return;

    const previousProfile = getStoredProfile();
    const profile = await callConsolidate(facts, previousProfile);

    if (profile && profile.length > 20) {
      localStorage.setItem(PROFILE_KEY, profile);
    }
  } catch (err) {
    console.error('[profiler] consolidateProfile error:', err.message);
  }
}

export function clearProfile() {
  localStorage.removeItem(FACTS_KEY);
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(COUNT_KEY);
}

// Returns the scheda sintetica section for inclusion in system prompts
export function getProfileContext() {
  const profile = getStoredProfile();
  if (!profile) return '';
  // Extract just the scheda sintetica section
  const schedaMatch = profile.match(/### Scheda sintetica\n([\s\S]*?)(?=\n### |$)/);
  if (schedaMatch) return schedaMatch[1].trim();
  // Fallback: return first 500 chars
  return profile.slice(0, 500);
}
