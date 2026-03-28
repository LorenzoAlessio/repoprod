(function () {
  'use strict';

  // Sections
  var stateInactive = document.getElementById('state-inactive');
  var stateActive = document.getElementById('state-active');
  var stateAlert = document.getElementById('state-alert');
  var stateEscalation = document.getElementById('state-escalation');

  // Form
  var personForm = document.getElementById('person-form');
  var personName = document.getElementById('person-name');
  var personRelation = document.getElementById('person-relation');
  var personNotes = document.getElementById('person-notes');
  var noSpeechWarning = document.getElementById('no-speech-warning');

  // Active state
  var voiceStatus = document.getElementById('voice-status');
  var dangerFill = document.getElementById('danger-fill');
  var dangerText = document.getElementById('danger-text');
  var transcriptLive = document.getElementById('transcript-live');
  var analysisResult = document.getElementById('analysis-result');
  var analysisMotivo = document.getElementById('analysis-motivo');
  var btnDeactivate = document.getElementById('btn-deactivate');

  // Alert
  var countdownNumber = document.getElementById('countdown-number');
  var btnCancelAlert = document.getElementById('btn-cancel-alert');

  // Escalation
  var escPosition = document.getElementById('esc-position');
  var escPerson = document.getElementById('esc-person');
  var escSummary = document.getElementById('esc-summary');
  var btnReset = document.getElementById('btn-reset');

  var DANGER_LABELS = {
    1: 'Normale',
    2: 'Tensione',
    3: 'Aggressivit\u00E0 verbale',
    4: 'Intimidazione',
    5: 'Pericolo'
  };

  var DANGER_CLASSES = {
    1: 'danger-1',
    2: 'danger-2',
    3: 'danger-3',
    4: 'danger-4',
    5: 'danger-5'
  };

  var countdownInterval = null;

  function showState(name) {
    stateInactive.hidden = name !== 'inactive';
    stateActive.hidden = name !== 'active';
    stateAlert.hidden = name !== 'alert';
    stateEscalation.hidden = name !== 'escalation';
  }

  // Check speech support
  if (typeof window.SpeechEngine !== 'undefined' && !window.SpeechEngine.isSupported()) {
    noSpeechWarning.hidden = false;
  }

  // ACTIVATE
  personForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var personData = {
      nome: personName.value.trim(),
      relazione: personRelation.value,
      note: personNotes.value.trim()
    };

    showState('active');
    transcriptLive.textContent = '';
    updateDanger(1);
    analysisResult.hidden = true;

    if (typeof window.SafeVoice === 'undefined') {
      voiceStatus.textContent = 'SafeVoice non disponibile';
      voiceStatus.className = 'voice-status';
      return;
    }

    window.SafeVoice.onTranscript = function (text) {
      transcriptLive.textContent += text + ' ';
      transcriptLive.scrollTop = transcriptLive.scrollHeight;
    };

    window.SafeVoice.onAnalysis = function (result) {
      if (result.error) return;
      updateDanger(result.pericolo);
      voiceStatus.textContent = 'Analisi completata';
      voiceStatus.className = 'voice-status analyzing';

      analysisMotivo.textContent = result.motivo;
      analysisResult.hidden = false;

      setTimeout(function () {
        if (!stateActive.hidden) {
          voiceStatus.textContent = 'In ascolto...';
          voiceStatus.className = 'voice-status recording';
        }
      }, 3000);
    };

    window.SafeVoice.onAlert = function () {
      showState('alert');
      var count = 30;
      countdownNumber.textContent = count;

      countdownInterval = setInterval(function () {
        count--;
        countdownNumber.textContent = count;
        if (count <= 0) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
      }, 1000);
    };

    window.SafeVoice.onEscalation = function (data) {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }

      showState('escalation');

      if (data.posizione) {
        escPosition.textContent = 'Lat: ' + data.posizione.lat.toFixed(5) + ', Lng: ' + data.posizione.lng.toFixed(5);
      } else {
        escPosition.textContent = 'Posizione non disponibile';
      }

      escPerson.textContent = data.personData.nome + ' (' + data.personData.relazione + ')';
      escSummary.textContent = data.sintesi || 'Pericolo rilevato durante conversazione dal vivo.';
    };

    window.SafeVoice.activate(personData);
  });

  // DEACTIVATE
  btnDeactivate.addEventListener('click', function () {
    if (typeof window.SafeVoice !== 'undefined') {
      window.SafeVoice.deactivate();
    }
    showState('inactive');
  });

  // CANCEL ALERT
  btnCancelAlert.addEventListener('click', function () {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (typeof window.SafeVoice !== 'undefined') {
      window.SafeVoice.cancelAlert();
    }
    showState('active');
  });

  // RESET from escalation
  btnReset.addEventListener('click', function () {
    if (typeof window.SafeVoice !== 'undefined') {
      window.SafeVoice.deactivate();
    }
    showState('inactive');
    personForm.reset();
    transcriptLive.textContent = '';
  });

  function updateDanger(level) {
    var l = Math.max(1, Math.min(5, level));
    dangerFill.setAttribute('data-level', l);
    dangerFill.style.width = (l * 20) + '%';

    // Remove old classes
    Object.values(DANGER_CLASSES).forEach(function (cls) {
      dangerFill.classList.remove(cls);
    });
    dangerFill.classList.add(DANGER_CLASSES[l]);

    dangerText.textContent = l + '/5 \u2014 ' + (DANGER_LABELS[l] || '');
  }

})();
