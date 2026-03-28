(function () {
  'use strict';

  const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const SOCIAL_RE = /@[a-zA-Z0-9_.]{2,}/g;
  const DATE_RE = /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g;

  function detectProperNames(text) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const names = new Set();

    sentences.forEach(function (sentence) {
      const words = sentence.split(/\s+/);
      words.forEach(function (word, i) {
        if (i === 0) return;
        const clean = word.replace(/[^a-zA-ZÀ-ÿ]/g, '');
        if (clean.length >= 3 && /^[A-ZÀ-Ÿ]/.test(clean) && !/^(Non|Per|Con|Chi|Che|Come|Dove|Quando|Perché|Anche|Ogni|Sempre|Dopo|Prima|Sono|Questa|Quello|Nella|Delle)$/.test(clean)) {
          names.add(clean);
        }
      });
    });

    return Array.from(names);
  }

  function anonymize(text) {
    var result = text;
    var mappings = {};

    result = result.replace(PHONE_RE, '[TELEFONO]');
    result = result.replace(EMAIL_RE, '[EMAIL]');
    result = result.replace(SOCIAL_RE, '@[USERNAME]');
    result = result.replace(DATE_RE, '[DATA]');

    var names = detectProperNames(result);
    var personCount = 0;
    var nameMap = {};

    names.forEach(function (name) {
      if (!nameMap[name]) {
        personCount++;
        nameMap[name] = '[PERSONA_' + personCount + ']';
      }
    });

    Object.keys(nameMap).sort(function (a, b) {
      return b.length - a.length;
    }).forEach(function (name) {
      var re = new RegExp('\\b' + name + '\\b', 'g');
      result = result.replace(re, nameMap[name]);
    });

    mappings = {
      persone: nameMap
    };

    return { anonymized: result, mappings: mappings };
  }

  window.Anonymizer = { anonymize: anonymize };
})();
