(function () {
  'use strict';

  var DEFAULT_ERROR = {
    tecnica: 'Errore',
    traduzione: '',
    spiegazione: 'Impossibile analizzare il messaggio. Riprova.',
    gravita: 0,
    risposte: [],
    risorse: false,
    error: true
  };

  async function analyze(anonymizedText) {
    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: anonymizedText })
      });

      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }

      var data = await res.json();

      return {
        tecnica: data.tecnica || '',
        traduzione: data.traduzione || '',
        spiegazione: data.spiegazione || '',
        gravita: Number(data.gravita) || 0,
        risposte: Array.isArray(data.risposte) ? data.risposte : [],
        risorse: Boolean(data.risorse)
      };
    } catch (err) {
      console.error('[ChatApi]', err);
      return Object.assign({}, DEFAULT_ERROR, { errorDetail: err.message });
    }
  }

  window.ChatApi = { analyze: analyze };
})();
