// Anonymization — regex only, no name replacement.
// Covers: phone, email, addresses, dates, social handles, URLs, fiscal codes, IBANs.
// Names are intentionally NOT anonymized — they're needed for context.

// ── Phone numbers (Italian + international) ──
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,7}/g;

// ── Email ──
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// ── Social handles ──
const SOCIAL_RE = /@[a-zA-Z0-9_.]{2,}/g;

// ── Dates (dd/mm, dd-mm-yyyy, dd.mm.yy, etc.) ──
const DATE_RE = /\b\d{1,2}[\/.\\-]\d{1,2}(?:[\/.\\-]\d{2,4})?\b/g;

// ── URLs ──
const URL_RE = /https?:\/\/[^\s,)]+/gi;

// ── Italian addresses ──
// Strategy: match the prefix (via/piazza/etc) + articulated preposition + capitalized words.
// Use a function to stop at common non-address words.
const ADDRESS_PREFIX_RE = /\b(?:via|piazza|piazzale|corso|viale|vicolo|largo|lungotevere|lungarno|contrada|strada|loc\.|località|localita)\s+/gi;

const ADDRESS_STOP_WORDS = new Set([
  'e','o','a','da','di','in','che','non','per','con','ma','se','come','dove',
  'quando','perché','perche','sono','ho','hai','ha','siamo','hanno','era','ero',
  'alle','alla','allo','agli','al','nel','nella','nello','negli','dal','dalla',
  'sul','sulla','sullo','sugli','ci','mi','ti','si','lo','la','le','li',
  'io','tu','lui','lei','noi','voi','loro','un','uno','una','il','i','gli',
  'poi','qui','già','più','ora','mai','molto','tanto','sempre','anche',
  'ieri','oggi','domani','dopo','prima','vicino','lontano','piano',
  'ti','mi','ci','vi','ne','se','te','me',
]);

function matchAddresses(text) {
  const matches = [];
  let m;
  const re = new RegExp(ADDRESS_PREFIX_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    const prefix = m[0];
    const rest = text.slice(m.index + prefix.length);
    // Consume optional articulated preposition (del, della, delle, dei, degli, dell')
    let consumed = '';
    const artMatch = rest.match(/^(?:del(?:la|le|lo|l')?|dei|degli|delle)\s+/i);
    if (artMatch) consumed = artMatch[0];
    // Consume capitalized/name words (stop at common words, punctuation, or lowercase non-name)
    const remaining = rest.slice(consumed.length);
    const words = remaining.split(/\s+/);
    const nameWords = [];
    for (const w of words) {
      const clean = w.replace(/[,;:!?.]+$/, '');
      if (!clean) break;
      if (ADDRESS_STOP_WORDS.has(clean.toLowerCase())) break;
      if (nameWords.length > 0 && /^[a-zà-ÿ]/.test(clean) && clean.length <= 3) break;
      nameWords.push(clean);
      if (nameWords.length >= 4) break;
      // If original word had trailing punctuation, stop after this word
      if (w !== clean) break;
    }
    if (nameWords.length === 0) continue;
    let fullMatch = prefix + consumed + nameWords.join(' ');
    // Optional number after name: ", 15" or " 15" or " n. 15" or " 15/A"
    const afterName = text.slice(m.index + fullMatch.length);
    const numMatch = afterName.match(/^(?:\s*,?\s*(?:n\.?\s*)?\d{1,5}(?:\s*\/?\s*[a-zA-Z])?)/);
    if (numMatch) fullMatch += numMatch[0];
    matches.push({ index: m.index, text: fullMatch.trim() });
  }
  return matches;
}

// ── CAP (codice avviamento postale) ──
const CAP_RE = /\b\d{5}\b/g;

// ── Codice fiscale ──
const CF_RE = /\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi;

// ── IBAN ──
const IBAN_RE = /\b[A-Z]{2}\d{2}\s?[A-Z0-9]{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}(?:\s?\d{1,4})?\b/gi;

// ── Targa auto italiana ──
const PLATE_RE = /\b[A-Z]{2}\s?\d{3}\s?[A-Z]{2}\b/gi;

export function anonymizeText(text) {
  let result = text;
  const replacements = {};

  // Order matters: longer patterns first to avoid partial matches

  // URLs first (contain dots, slashes that could match other patterns)
  result = result.replace(URL_RE, (match) => {
    replacements[match] = '[URL]';
    return '[URL]';
  });

  // Email before social (contains @)
  result = result.replace(EMAIL_RE, (match) => {
    replacements[match] = '[EMAIL]';
    return '[EMAIL]';
  });

  // Addresses (multi-word, custom parser to avoid over-matching)
  const addrMatches = matchAddresses(result);
  // Replace longest first, from end to start to preserve indices
  addrMatches.sort((a, b) => b.index - a.index);
  for (const addr of addrMatches) {
    replacements[addr.text] = '[INDIRIZZO]';
    result = result.slice(0, addr.index) + '[INDIRIZZO]' + result.slice(addr.index + addr.text.length);
  }

  // IBAN
  result = result.replace(IBAN_RE, (match) => {
    replacements[match] = '[IBAN]';
    return '[IBAN]';
  });

  // Codice fiscale
  result = result.replace(CF_RE, (match) => {
    replacements[match] = '[CODICE_FISCALE]';
    return '[CODICE_FISCALE]';
  });

  // Phone numbers
  result = result.replace(PHONE_RE, (match) => {
    // Avoid false positives: must have at least 6 digits
    const digits = match.replace(/\D/g, '');
    if (digits.length < 6) return match;
    replacements[match] = '[TELEFONO]';
    return '[TELEFONO]';
  });

  // Social handles
  result = result.replace(SOCIAL_RE, (match) => {
    replacements[match] = '@[USERNAME]';
    return '@[USERNAME]';
  });

  // Dates
  result = result.replace(DATE_RE, (match) => {
    replacements[match] = '[DATA]';
    return '[DATA]';
  });

  // Targa
  result = result.replace(PLATE_RE, (match) => {
    replacements[match] = '[TARGA]';
    return '[TARGA]';
  });

  // CAP (only if 5 digits standing alone, after addresses are already replaced)
  result = result.replace(CAP_RE, (match) => {
    replacements[match] = '[CAP]';
    return '[CAP]';
  });

  return {
    anonymized: result,
    mappings: replacements,
    personeGender: {}
  };
}

// Main export — no Qwen needed, pure regex
export async function anonymizeWithQwen(text, onProgress) {
  onProgress?.({ phase: 'anonymizing', current: 1, total: 1, entities: 0 });

  const result = anonymizeText(text);

  // Count what was found
  const counts = {};
  for (const token of Object.values(result.mappings)) {
    counts[token] = (counts[token] || 0) + 1;
  }

  onProgress?.({
    phase: 'done',
    usedFallback: false,
    entityCount: Object.keys(result.mappings).length,
    personeCount: 0
  });

  return result;
}
