(function () {
  'use strict';

  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null;

  function isSupported() {
    return Boolean(SpeechRecognition);
  }

  function start(onResult, onError) {
    if (!isSupported()) {
      onError('Web Speech API non supportata in questo browser. Usa Chrome o Edge.');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = function (event) {
      var last = event.results[event.results.length - 1];
      onResult({
        transcript: last[0].transcript,
        isFinal: last.isFinal
      });
    };

    recognition.onerror = function (event) {
      if (event.error === 'no-speech') return;
      onError('Errore riconoscimento vocale: ' + event.error);
    };

    recognition.onend = function () {
      if (recognition) {
        try { recognition.start(); } catch (e) { /* already started */ }
      }
    };

    recognition.start();
  }

  function stop() {
    if (recognition) {
      var ref = recognition;
      recognition = null;
      ref.onend = null;
      ref.abort();
    }
  }

  window.SpeechEngine = {
    start: start,
    stop: stop,
    isSupported: isSupported
  };
})();
