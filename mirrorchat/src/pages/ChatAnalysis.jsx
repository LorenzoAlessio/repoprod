import { useState, useEffect, useRef, useCallback } from 'react'
import SeverityIndicator from '../components/SeverityIndicator'
import { analyzeChatReport, anonymizeText } from '../utils/api'
import { splitIntoMessages } from '../utils/chunker'
import { getStoredGender } from './Settings'
import { extractFacts } from '../utils/profiler'
import { saveChatReport } from '../utils/chatStorage'
import { examples } from '../data/examples'
import { resources } from '../data/resources'
import styles from './ChatAnalysis.module.css'

const CATEGORY_LABELS = {
  gelosia:               'Gelosia Possessiva',
  violenza_psicologica:  'Violenza Psicologica',
  violenza_fisica:       'Violenza / Minaccia Fisica',
  limitazione_personale: 'Limitazione Personale',
  maltrattamento:        'Maltrattamento',
  love_bombing:          'Love Bombing',
  controllo_digitale:    'Controllo Digitale',
  nessuna:               'Nessuna manipolazione',
}

// File extensions we can read as plain text
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'log', 'json', 'xml', 'html', 'htm'])

function getFileExt(filename) {
  return filename.split('.').pop().toLowerCase()
}

function isTextFile(file) {
  const ext = getFileExt(file.name)
  return TEXT_EXTENSIONS.has(ext) || file.type.startsWith('text/')
}

function isImageFile(file) {
  return file.type.startsWith('image/')
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file, 'utf-8')
  })
}

// Debounce helper
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function ChatAnalysis() {
  const [rawText, setRawText]           = useState('')
  const [file, setFile]                 = useState(null)
  const [isDragging, setIsDragging]     = useState(false)
  const [anonState, setAnonState]       = useState({ status: 'idle', text: '', error: false })
  // status: 'idle' | 'loading' | 'done' | 'impossible'
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [result, setResult]             = useState(null)
  const [personeGender, setPersoneGender] = useState({})
  const [activeFilter, setActiveFilter] = useState(null)
  const [expandedMessages, setExpandedMessages] = useState({})
  const [isAnonExpanded, setIsAnonExpanded] = useState(false)
  
  const fileInputRef                    = useRef(null)
  const resultsRef                      = useRef(null)

  // The text to anonymize — either typed text or extracted file content
  const textToAnon = rawText.trim()
  const debouncedText = useDebounce(textToAnon, 700)

  // ── Anonymise via Python Script ──
  const anonymize = useCallback(async (text) => {
    if (!text) { setAnonState({ status: 'idle', text: '', error: false }); return }
    setAnonState({ status: 'loading', text: '', error: false })
    try {
      const anonResult = await anonymizeText(text)
      setAnonState({ status: 'done', text: anonResult.anonymized, error: false })
      setPersoneGender({})
    } catch {
      setAnonState({ status: 'impossible', text: '', error: true })
    }
  }, [])

  // Trigger anonymization when debounced text changes
  useEffect(() => {
    anonymize(debouncedText)
  }, [debouncedText, anonymize])

  const toggleFilter = (category) => {
    setActiveFilter(prev => prev === category ? null : category)
  }

  const toggleExpand = (index) => {
    setExpandedMessages(prev => ({ ...prev, [index]: !prev[index] }))
  }

  const toggleAnonExpand = () => {
    setIsAnonExpanded(prev => !prev)
  }

  // ── File handling ──
  const handleFile = async (f) => {
    setFile(f)
    setResult(null)
    setError('')
    setRawText('') // clear typed text

    if (isImageFile(f)) {
      setRawText('')
      setAnonState({ status: 'impossible', text: '', error: true })
      return
    }

    if (isTextFile(f)) {
      try {
        const content = await readFileAsText(f)
        setRawText(content)
      } catch {
        setError("Impossibile leggere il file. Prova a incollare il testo direttamente.")
      }
      return
    }

    // Unknown type
    setAnonState({ status: 'impossible', text: '', error: true })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleFileInput = (e) => {
    const f = e.target.files[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  const clearFile = () => {
    setFile(null)
    setRawText('')
    setAnonState({ status: 'idle', text: '', error: false })
    setResult(null)
    setError('')
  }

  // ── Analysis ──
  const handleAnalyze = async () => {
    setError('')
    setResult(null)

    const textForLLM = anonState.status === 'done' ? anonState.text : rawText.trim()

    if (!textForLLM) {
      setError('Inserisci o importa un messaggio prima di analizzare.')
      return
    }

    if (anonState.status === 'impossible') {
      setError("Impossibile anonimizzare il contenuto. L'analisi non può procedere per proteggere la tua privacy.")
      return
    }

    if (anonState.status === 'loading') {
      setError('Anonimizzazione in corso, attendi un momento.')
      return
    }

    setLoading(true)
    try {
      const genere = getStoredGender()
      const messages = splitIntoMessages(textForLLM)
      const data = await analyzeChatReport(messages, genere, personeGender)
      setResult(data)
      
      // Save data locally for personalized Learning Quiz
      saveChatReport(data)

      // Extract profile facts in background
      extractFacts(textForLLM, 'chat')
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExample = (ex) => {
    setFile(null)
    setRawText(ex.text)
    setResult(null)
    setError('')
  }

  // ── Anon preview UI ──
  const renderAnonPreview = () => {
    if (!textToAnon && anonState.status === 'idle') return null

    if (anonState.status === 'loading') {
      return (
        <div className={styles.anonBox}>
          <div className={styles.anonHeader}>
            <span className={styles.anonBadge} style={{ background: 'rgba(200,196,188,0.15)', color: 'var(--fog)' }}>
              🔒 Anonimizzazione in corso…
            </span>
          </div>
          <div className={styles.anonLoading}>
            <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            <span>Anonimizzazione Qwen in esecuzione…</span>
          </div>
        </div>
      )
    }

    if (anonState.status === 'impossible') {
      return (
        <div className={`${styles.anonBox} ${styles.anonImpossible}`}>
          <div className={styles.anonHeader}>
            <span className={styles.anonBadge} style={{ background: 'rgba(193,68,51,0.1)', color: 'var(--danger-deep)' }}>
              ⚠ Impossibile anonimizzare
            </span>
          </div>
          <p className={styles.anonImpossibleText}>
            {file && isImageFile(file)
              ? "Le immagini verranno anonimizzate dall'AI locale (QWen 2.5, in sviluppo)."
              : "Impossibile anonimizzare il contenuto. Assicurati che Python sia installato oppure incolla il testo direttamente."}
          </p>
        </div>
      )
    }

    if (anonState.status === 'done' && anonState.text) {
      const anonTextRows = anonState.text.split('\n')
      const isLong = anonTextRows.length > 2 || anonState.text.length > 150
      return (
        <div className={styles.anonBox}>
          <div className={styles.anonHeader}>
            <span className={styles.anonBadge}>🔒 Testo anonimizzato</span>
            <span className={styles.anonNote}>Questo testo sicuro è l'unico che verrà analizzato dall'AI</span>
          </div>
          <div className={`${styles.anonTextWrapper} ${!isAnonExpanded && isLong ? styles.anonTextCollapsed : ''}`}>
            <p className={styles.anonText}>{anonState.text}</p>
          </div>
          {isLong && (
            <button className={styles.expandAnonBtn} onClick={toggleAnonExpand}>
              {isAnonExpanded ? 'Riduci' : 'Leggi tutto'}
            </button>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <div className={`page-container ${styles.page}`}>

      {/* ── Header ── */}
      <header className={`${styles.hero} page-enter`}>
        <span className="section-label">Analisi Chat</span>
        <h1 className={styles.title}>Analizza un messaggio</h1>
        <p className={styles.subtitle}>
          Incolla un messaggio, carica un file o uno screenshot. L'AI rivela cosa si nasconde
          dietro le parole — dopo averlo anonimizzato.
        </p>
      </header>

      {/* ── Input area ── */}
      <section className={`${styles.inputSection} page-enter page-enter--delay-1`}>

        {/* Drop zone / textarea wrapper */}
        <div
          className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''} ${file ? styles.dropZoneHasFile : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {file ? (
            /* File chip */
            <div className={styles.fileChip}>
              <span className={styles.fileChipIcon}>
                {isImageFile(file) ? '🖼' : '📄'}
              </span>
              <div className={styles.fileChipInfo}>
                <span className={styles.fileChipName}>{file.name}</span>
                <span className={styles.fileChipSize}>
                  {(file.size / 1024).toFixed(1)} KB
                  {isImageFile(file) && ' · immagine'}
                  {isTextFile(file) && ' · testo estratto'}
                </span>
              </div>
              <button
                className={`btn btn--ghost btn--sm ${styles.fileRemove}`}
                onClick={clearFile}
                aria-label="Rimuovi file"
              >✕</button>
            </div>
          ) : (
            /* Drag hint (visible when no text) */
            !rawText && (
              <div className={styles.dropHint}>
                <span className={styles.dropIcon}>⬆</span>
                <span>Trascina qualsiasi file qui</span>
              </div>
            )
          )}

          {/* Textarea — always visible unless image file loaded */}
          {(!file || isTextFile(file)) && (
            <textarea
              className={`textarea ${styles.textarea}`}
              placeholder={file ? '' : 'Oppure scrivi o incolla il messaggio qui…'}
              rows={file ? 6 : 7}
              value={rawText}
              onChange={e => { setRawText(e.target.value); setFile(null); setResult(null); setError('') }}
              aria-label="Messaggio da analizzare"
            />
          )}
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <button
            className={`btn btn--ghost btn--sm ${styles.uploadBtn}`}
            onClick={() => fileInputRef.current?.click()}
          >
            📎 Allega file
          </button>
          <span className={styles.uploadHint}>Qualsiasi formato accettato</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="*"
            className="sr-only"
            onChange={handleFileInput}
            aria-label="Carica file"
          />
        </div>

        {/* Anon preview */}
        {renderAnonPreview()}

        {/* Analyze CTA */}
        <button
          className={`btn btn--aurora btn--full ${styles.analyzeBtn}`}
          onClick={handleAnalyze}
          disabled={loading || (!rawText.trim() && !file)}
        >
          {loading
            ? <><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2.5 }} /> Generazione report in corso…</>
            : 'Genera Report Chat'
          }
        </button>

        {error && <div className={styles.error} role="alert">{error}</div>}
      </section>

      {/* ── Examples ── */}
      <section className={`${styles.examplesSection} page-enter page-enter--delay-2`}>
        <span className="section-label">Prova con un esempio</span>
        <div className={styles.examplePills}>
          {examples.map(ex => (
            <button
              key={ex.id}
              className={styles.examplePill}
              onClick={() => handleExample(ex)}
            >
              <span className={styles.pillLabel}>{ex.label}</span>
              <span className={styles.pillTech}>{ex.technique}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Results ── */}
      {result && result.riepilogo && (
        <section
          ref={resultsRef}
          className={`${styles.results} page-enter`}
          aria-live="polite"
        >
          <div className={styles.thankYouMessage}>
            Grazie per aver utilizzato l'Analisi Chat. Ecco il tuo report.
          </div>

          {/* Summary Card */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <SeverityIndicator level={Math.round(result.riepilogo.gravita_media) || 1} size={48} />
              <div className={styles.summaryStats}>
                <div className={styles.statBox}>
                  <span className={styles.statValue}>{result.riepilogo.messaggi_totali}</span>
                  <span className={styles.statLabel}>Messaggi Totali</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statValue} style={{ color: result.riepilogo.messaggi_problematici > 0 ? 'var(--danger-deep)' : 'var(--sage-safe)' }}>
                    {result.riepilogo.messaggi_problematici}
                  </span>
                  <span className={styles.statLabel}>Problematici</span>
                </div>
              </div>
            </div>

            <p className={styles.summaryEval}>{result.riepilogo.valutazione_complessiva}</p>

            {(() => {
              // Extract unique categories directly from the messages to ensure 100% accuracy
              const actualCategories = result.report
                ? [...new Set(result.report.map(m => m.categoria?.trim().toLowerCase()))].filter(c => c && c !== 'nessuna')
                : [];

              if (actualCategories.length > 0) {
                return (
                  <div className={styles.summaryCategories}>
                    {actualCategories.map(c => {
                      // Try to match the lowercase category to our labels, or fallback to capitalize
                      const label = CATEGORY_LABELS[c] || Object.values(CATEGORY_LABELS).find(l => l.toLowerCase() === c) || c;
                      return (
                        <button 
                          key={c} 
                          className={`${styles.categoryPill} ${activeFilter === c ? styles.categoryPillActive : ''}`}
                          onClick={() => toggleFilter(c)}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )
              }
              return null;
            })()}
          </div>

          <span className="section-label" style={{ marginTop: 'var(--space-5)' }}>
            {activeFilter 
              ? `Filtrando per: ${CATEGORY_LABELS[activeFilter] || activeFilter}` 
              : 'Dettaglio Messaggi'}
          </span>

          <div className={styles.messageList}>
            {result.report?.filter(msg => !activeFilter || msg.categoria?.trim().toLowerCase() === activeFilter).map((msg, idx) => {
              const categoryMatch = msg.categoria?.trim().toLowerCase();
              const isProblematic = categoryMatch !== 'nessuna' && msg.gravita > 1;
              const isExpanded = expandedMessages[idx] || false;
              const shouldTruncate = msg.messaggio.length > 200;
              const displayText = shouldTruncate && !isExpanded ? msg.messaggio.slice(0, 200) + '...' : msg.messaggio;

              return (
                <div key={idx} className={`${styles.messageItem} ${isProblematic ? styles[`messageSeverity${msg.gravita}`] : styles.messageNeutral}`}>
                  <div className={styles.messageContent}>
                    {msg.autore && (
                      <div className={styles.messageAuthor}>
                        Inviato da: <strong>{msg.autore}</strong>
                      </div>
                    )}
                    <div className={styles.messageTextWrapper}>
                      <span className={styles.messageText}>{displayText}</span>
                      {shouldTruncate && (
                        <button className={styles.expandBtn} onClick={() => toggleExpand(idx)}>
                          {isExpanded ? 'Riduci' : 'Scopri di più'}
                        </button>
                      )}
                    </div>
                    {isProblematic && (
                      <div className={styles.messageAnalysis}>
                        <div className={styles.messageHeader}>
                          <span className={styles.messageCategory}>{CATEGORY_LABELS[msg.categoria] || msg.categoria}</span>
                          <span className={styles.messageSeverityBadge}>Livello {msg.gravita}</span>
                        </div>
                        <p className={styles.messageExplanation}>{msg.spiegazione}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {result.riepilogo.gravita_media >= 3 && (
            <div className={styles.resourcesBanner} style={{ marginTop: 'var(--space-6)' }}>
              <h3 className={styles.resourcesTitle}>Hai bisogno di aiuto?</h3>
              <p className={styles.resourcesSub}>Servizi gratuiti, anonimi e riservati.</p>
              <div className={styles.resourcesList}>
                {resources.map(r => (
                  <a
                    key={r.nome}
                    href={r.url}
                    className={styles.resourceItem}
                    target={r.url.startsWith('http') ? '_blank' : undefined}
                    rel={r.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                  >
                    <span className={styles.resourceName}>{r.nome}</span>
                    {r.number && <span className={styles.resourceNumber}>{r.number}</span>}
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

    </div>
  )
}
