/**
 * Analyse a (pre-anonymised) chat message.
 * @param {string} message
 * @returns {Promise<{tecnica, traduzione, spiegazione, gravita, risposte, risorse}>}
 */
export async function analyzeChat(message, genereUtente = 'non_specificato', persone = {}) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, genere_utente: genereUtente, persone }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.spiegazione || 'Errore durante l\'analisi. Riprova.')
  }

  return res.json()
}

/**
 * Analyse a (pre-anonymised) array of chat messages for a full report.
 * @param {string[]} messages
 * @param {string} genereUtente
 * @param {object} persone
 * @returns {Promise<{report, riepilogo}>}
 */
export async function analyzeChatReport(messages, genereUtente = 'non_specificato', persone = {}) {
  const res = await fetch('/api/chat-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, genere_utente: genereUtente, persone }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.valutazione_complessiva || 'Errore durante l\'analisi del report. Riprova.')
  }

  return res.json()
}

/**
 * Analyse a (pre-anonymised) voice transcript.
 * @param {string} transcript
 * @returns {Promise<{pericolo, motivo, escalation, sintesi_emergenza}>}
 */
export async function analyzeVoice(transcript) {
  const res = await fetch('/api/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.motivo || 'Errore durante l\'analisi. Riprova.')
  }

  return res.json()
}

/**
 * Anonymize text via Python script endpoint
 * @param {string} text 
 * @returns {Promise<{anonymized: string, mappings: any}>}
 */
export async function anonymizeText(text) {
  const res = await fetch('/api/anonymize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || err.error || 'Errore nell\'anonimizzazione.')
  }

  return res.json()
}

/**
 * Generates an AI quiz based on detected chat tags and context.
 * @param {string[]} tags
 * @param {string[]} contesti
 */
export async function generateQuiz(tags, contesti = []) {
  const res = await fetch('/api/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags, contesti }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Errore durante la generazione del quiz. Riprova.')
  }

  return res.json()
}
