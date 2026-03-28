/**
 * Analyse a (pre-anonymised) chat message.
 * @param {string} message
 * @returns {Promise<{tecnica, traduzione, spiegazione, gravita, risposte, risorse}>}
 */
export async function analyzeChat(message) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.spiegazione || 'Errore durante l\'analisi. Riprova.')
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
