const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const SOCIAL_RE = /@[a-zA-Z0-9_.]{2,}/g
const DATE_RE = /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g

const STOP_WORDS = new Set([
  'Non','Per','Con','Chi','Che','Come','Dove','Quando','Perché','Anche',
  'Ogni','Sempre','Dopo','Prima','Sono','Questa','Quello','Nella','Delle',
  'Agli','Alle','Degli','Sulle','Sulla','Negli','Nelle','Quella','Questo',
])

function detectProperNames(text) {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const names = new Set()

  sentences.forEach(sentence => {
    const words = sentence.split(/\s+/)
    words.forEach((word, i) => {
      if (i === 0) return
      const clean = word.replace(/[^a-zA-ZÀ-ÿ]/g, '')
      if (
        clean.length >= 3 &&
        /^[A-ZÀ-Ÿ]/.test(clean) &&
        !STOP_WORDS.has(clean)
      ) {
        names.add(clean)
      }
    })
  })

  return Array.from(names)
}

/**
 * Anonymize text by replacing PII with tokens.
 * @param {string} text
 * @returns {{ anonymized: string, mappings: object }}
 */
export function anonymize(text) {
  let result = text
  const nameMap = {}

  result = result.replace(PHONE_RE, '[TELEFONO]')
  result = result.replace(EMAIL_RE, '[EMAIL]')
  result = result.replace(SOCIAL_RE, '@[USERNAME]')
  result = result.replace(DATE_RE, '[DATA]')

  const names = detectProperNames(result)
  let personCount = 0

  names.forEach(name => {
    if (!nameMap[name]) {
      personCount++
      nameMap[name] = `[PERSONA_${personCount}]`
    }
  })

  Object.keys(nameMap)
    .sort((a, b) => b.length - a.length)
    .forEach(name => {
      const re = new RegExp(`\\b${name}\\b`, 'g')
      result = result.replace(re, nameMap[name])
    })

  return { anonymized: result, mappings: { persone: nameMap } }
}
