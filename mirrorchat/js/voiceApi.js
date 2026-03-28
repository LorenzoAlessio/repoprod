(function () {
  'use strict';

  var DEFAULT_ERROR = {
    pericolo: 0,
    motivo: 'Impossibile analizzare il trascritto. Riprova.',
    escalation: false,
    sintesi_emergenza: '',
    error: true
  };

  async function analyze(anonymizedTranscript) {
    try {
      var res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: anonymizedTranscript })
      });

      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }

      var data = await res.json();

      return {
        pericolo: Number(data.pericolo) || 0,
        motivo: data.motivo || '',
        escalation: Boolean(data.escalation),
        sintesi_emergenza: data.sintesi_emergenza || ''
      };
    } catch (err) {
      console.error('[VoiceApi]', err);
      return Object.assign({}, DEFAULT_ERROR, { errorDetail: err.message });
    }
  }

  window.VoiceApi = { analyze: analyze };
})();
