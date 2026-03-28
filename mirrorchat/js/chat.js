(function () {
  'use strict';

  var textarea = document.getElementById('message-input');
  var anonPreviewText = document.getElementById('anon-preview-text');
  var analyzeBtn = document.getElementById('analyze-btn');
  var loading = document.getElementById('loading');
  var errorMsg = document.getElementById('error-msg');
  var resultsSection = document.getElementById('results');
  var severityLight = document.getElementById('severity-light');
  var severityLabel = document.getElementById('severity-label');
  var techniqueName = document.getElementById('technique-name');
  var translationText = document.getElementById('translation-text');
  var explanationText = document.getElementById('explanation-text');
  var responsesList = document.getElementById('responses-list');
  var resourcesBanner = document.getElementById('resources-banner');
  var resourcesList = document.getElementById('resources-list');
  var examplesContainer = document.getElementById('examples-container');

  var SEVERITY_MAP = {
    1: { cls: 'severity-green', label: 'Basso rischio' },
    2: { cls: 'severity-green', label: 'Basso rischio' },
    3: { cls: 'severity-yellow', label: 'Attenzione' },
    4: { cls: 'severity-red', label: 'Alto rischio' },
    5: { cls: 'severity-red', label: 'Pericolo' }
  };

  function updateAnonPreview() {
    var text = textarea.value.trim();
    if (!text) {
      anonPreviewText.textContent = 'Il testo anonimizzato apparir\u00E0 qui...';
      return;
    }
    if (typeof window.Anonymizer !== 'undefined') {
      var result = window.Anonymizer.anonymize(text);
      anonPreviewText.textContent = result.anonymized;
    } else {
      anonPreviewText.textContent = text;
    }
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
  }

  function hideError() {
    errorMsg.hidden = true;
  }

  function setLoading(on) {
    loading.hidden = !on;
    analyzeBtn.disabled = on;
  }

  function clearSeverityClasses() {
    severityLight.classList.remove('severity-green', 'severity-yellow', 'severity-red');
  }

  function renderResults(data) {
    resultsSection.hidden = false;

    var sev = SEVERITY_MAP[data.gravita] || SEVERITY_MAP[1];
    clearSeverityClasses();
    severityLight.classList.add(sev.cls);
    severityLabel.textContent = sev.label + ' (' + data.gravita + '/5)';

    techniqueName.textContent = data.tecnica;
    translationText.textContent = data.traduzione;
    explanationText.textContent = data.spiegazione;

    responsesList.innerHTML = '';
    (data.risposte || []).forEach(function (r) {
      var li = document.createElement('li');
      li.className = 'response-card';
      li.textContent = r;
      responsesList.appendChild(li);
    });

    if (data.risorse) {
      resourcesBanner.hidden = false;
      renderResources();
    } else {
      resourcesBanner.hidden = true;
    }

    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderResources() {
    resourcesList.innerHTML = '';
    var resources = [];
    if (typeof window.Resources !== 'undefined' && typeof window.Resources.getAll === 'function') {
      resources = window.Resources.getAll();
    }
    if (!resources.length) {
      resources = [
        { nome: '1522 \u2014 Antiviolenza e Stalking', url: 'tel:1522' },
        { nome: 'Chat 1522', url: 'https://www.1522.eu' }
      ];
    }
    resources.forEach(function (r) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = r.url;
      a.className = 'resource-link';
      a.textContent = r.nome;
      a.target = '_blank';
      a.rel = 'noopener';
      li.appendChild(a);
      resourcesList.appendChild(li);
    });
  }

  async function runAnalysis() {
    var text = textarea.value.trim();
    if (!text) {
      showError('Inserisci un messaggio da analizzare.');
      return;
    }

    hideError();
    resultsSection.hidden = true;
    setLoading(true);

    try {
      var anonymized = text;
      if (typeof window.Anonymizer !== 'undefined') {
        anonymized = window.Anonymizer.anonymize(text).anonymized;
      }

      if (typeof window.ChatApi === 'undefined') {
        throw new Error('ChatApi non disponibile');
      }

      var data = await window.ChatApi.analyze(anonymized);

      if (data.error) {
        showError(data.spiegazione || 'Si \u00E8 verificato un errore. Riprova.');
        return;
      }

      renderResults(data);
    } catch (err) {
      showError('Errore durante l\'analisi. Verifica la connessione e riprova.');
      console.error('[chat.js]', err);
    } finally {
      setLoading(false);
    }
  }

  function loadExamples() {
    if (typeof window.Examples === 'undefined' || typeof window.Examples.getAll !== 'function') {
      return;
    }
    var examples = window.Examples.getAll();
    examples.forEach(function (ex) {
      var btn = document.createElement('button');
      btn.className = 'btn btn-example example-pill';
      btn.textContent = ex.label;
      btn.type = 'button';
      btn.addEventListener('click', function () {
        textarea.value = ex.text;
        updateAnonPreview();
        runAnalysis();
      });
      examplesContainer.appendChild(btn);
    });
  }

  textarea.addEventListener('keyup', updateAnonPreview);
  analyzeBtn.addEventListener('click', runAnalysis);

  loadExamples();
})();
