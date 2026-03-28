#!/usr/bin/env python3
"""
MirrorChat — Python anonymizer script
Reads text from stdin, outputs anonymised JSON to stdout.
Usage: echo "text" | python scripts/anonymize.py
"""

import sys
import json
import re

# ── Regex patterns ────────────────────────────────────────────
PHONE_RE  = re.compile(r'(\+?\d{1,3}[\s.\-]?)?\(?\d{2,4}\)?[\s.\-]?\d{3,4}[\s.\-]?\d{3,4}')
EMAIL_RE  = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
SOCIAL_RE = re.compile(r'@[a-zA-Z0-9_.]{2,}')
DATE_RE   = re.compile(r'\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b')
IBAN_RE   = re.compile(r'\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16}\b')
CF_RE     = re.compile(r'\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b')

STOP_WORDS = {
    'Non', 'Per', 'Con', 'Chi', 'Che', 'Come', 'Dove', 'Quando', 'Perché',
    'Anche', 'Ogni', 'Sempre', 'Dopo', 'Prima', 'Sono', 'Questa', 'Quello',
    'Nella', 'Delle', 'Agli', 'Alle', 'Degli', 'Sulle', 'Sulla', 'Negli',
    'Nelle', 'Quella', 'Questo', 'Lui', 'Lei', 'Loro', 'Noi', 'Voi',
    'Ciao', 'Grazie', 'Prego', 'Scusa', 'Sì', 'No', 'Forse', 'Bene', 'Male',
    'Okay', 'Vabbè', 'Però', 'Anzi', 'Quindi', 'Oppure', 'Ancora',
}


def detect_proper_names(text: str) -> list[str]:
    """Heuristic: capitalised words that are not sentence-starters and not stopwords."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    names: set[str] = set()
    for sentence in sentences:
        words = sentence.split()
        for i, word in enumerate(words):
            if i == 0:
                continue
            clean = re.sub(r'[^a-zA-ZÀ-ÿ]', '', word)
            if (
                len(clean) >= 3
                and clean and clean[0].isupper()
                and clean not in STOP_WORDS
            ):
                names.add(clean)
    return list(names)


def anonymize(text: str) -> dict:
    result = text
    name_map: dict[str, str] = {}

    # Replace structured PII
    result = PHONE_RE.sub('[TELEFONO]', result)
    result = EMAIL_RE.sub('[EMAIL]', result)
    result = SOCIAL_RE.sub('@[USERNAME]', result)
    result = DATE_RE.sub('[DATA]', result)
    result = IBAN_RE.sub('[IBAN]', result)
    result = CF_RE.sub('[CODICE_FISCALE]', result)

    # Replace proper names
    names = detect_proper_names(result)
    person_count = 0

    for name in names:
        if name not in name_map:
            person_count += 1
            name_map[name] = f'[PERSONA_{person_count}]'

    for name in sorted(name_map.keys(), key=len, reverse=True):
        result = re.sub(r'\b' + re.escape(name) + r'\b', name_map[name], result)

    return {
        'anonymized': result,
        'mappings': {'persone': name_map},
    }


if __name__ == '__main__':
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps({'anonymized': '', 'mappings': {}}))
            sys.exit(0)
        output = anonymize(raw)
        print(json.dumps(output, ensure_ascii=False))
    except Exception as exc:
        sys.stderr.write(str(exc) + '\n')
        sys.exit(1)
