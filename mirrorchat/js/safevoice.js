(function () {
  'use strict';

  var ANALYSIS_INTERVAL = 20000;
  var COUNTDOWN_SECONDS = 30;
  var VIBRATION_PATTERN = [500, 200, 500, 200, 500];

  var active = false;
  var personData = null;
  var transcriptBuffer = '';
  var analysisTimer = null;
  var countdownTimer = null;
  var countdownValue = 0;

  var callbacks = {
    onTranscript: null,
    onAnalysis: null,
    onAlert: null,
    onEscalation: null
  };

  function emit(name, data) {
    if (typeof callbacks[name] === 'function') {
      callbacks[name](data);
    }
  }

  function getPosition() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        function () {
          resolve(null);
        },
        { timeout: 5000, maximumAge: 30000 }
      );
    });
  }

  function startCountdown(sintesi) {
    countdownValue = COUNTDOWN_SECONDS;
    emit('onAlert');

    if (navigator.vibrate) {
      navigator.vibrate(VIBRATION_PATTERN);
    }

    countdownTimer = setInterval(function () {
      countdownValue--;
      if (countdownValue <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        triggerEscalation(sintesi);
      }
    }, 1000);
  }

  async function triggerEscalation(sintesi) {
    var posizione = await getPosition();
    emit('onEscalation', {
      posizione: posizione,
      personData: personData,
      sintesi: sintesi
    });
  }

  async function runAnalysis() {
    if (!transcriptBuffer.trim()) return;

    var textToAnalyze = transcriptBuffer;
    var result = window.Anonymizer.anonymize(textToAnalyze);
    var analysis = await window.VoiceApi.analyze(result.anonymized);

    emit('onAnalysis', analysis);

    if (!analysis.error && analysis.pericolo >= 4 && !countdownTimer) {
      startCountdown(analysis.sintesi_emergenza);
    }
  }

  function activate(data) {
    if (active) return;
    active = true;
    personData = data;
    transcriptBuffer = '';

    window.SpeechEngine.start(
      function (result) {
        if (result.isFinal) {
          transcriptBuffer += result.transcript + ' ';
        }
        emit('onTranscript', result.transcript);
      },
      function (err) {
        console.error('[SafeVoice] Speech error:', err);
      }
    );

    analysisTimer = setInterval(runAnalysis, ANALYSIS_INTERVAL);
  }

  function deactivate() {
    active = false;
    personData = null;
    transcriptBuffer = '';

    window.SpeechEngine.stop();

    if (analysisTimer) {
      clearInterval(analysisTimer);
      analysisTimer = null;
    }

    cancelAlert();
  }

  function cancelAlert() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    countdownValue = 0;
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
  }

  window.SafeVoice = {
    activate: activate,
    deactivate: deactivate,
    cancelAlert: cancelAlert,

    get countdownValue() { return countdownValue; },
    get isActive() { return active; },

    set onTranscript(fn) { callbacks.onTranscript = fn; },
    set onAnalysis(fn) { callbacks.onAnalysis = fn; },
    set onAlert(fn) { callbacks.onAlert = fn; },
    set onEscalation(fn) { callbacks.onEscalation = fn; }
  };
})();
