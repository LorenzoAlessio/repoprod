import { useState, useEffect, useRef, useCallback } from 'react'
import SeverityIndicator from '../components/SeverityIndicator'
import { createAudioRecorder } from '../utils/speech.js'
import styles from './SafeVoice.module.css'

const STATES = { IDLE: 'idle', STARTING: 'starting', RECORDING: 'recording', COUNTDOWN: 'countdown', CALLING: 'calling' }
const COUNTDOWN_SECONDS = 15
const NUM_BARS = 16

const HARD_TRIGGERS = /ti ammazzo|ti uccido|ti faccio fuori|crepa|muori|ti riempio di sberle|ti gonfio|ti do due schiaffi|ti spacco|sberle|menare|ti meno|strangolar|ti ammazz|ti stupr|violentar/i

function dangerAccent(level) {
  if (level >= 4) return '#E8634A'
  if (level === 3) return '#E8A838'
  return '#5B9A8B'
}

// Calcola il livello (1-5) dal punteggio (0-100)
function getLevelFromScore(s) {
  if (s >= 100) return 5
  if (s >= 60) return 4
  if (s >= 35) return 3
  if (s >= 15) return 2
  return 1
}

export default function SafeVoice() {
  const user = JSON.parse(localStorage.getItem('mirrorUser') || '{}')
  const shortcut = localStorage.getItem('mirrorShortcut') || 'button'

  const [status, setStatus] = useState(STATES.IDLE)
  
  // Nuovo sistema di scala punteggio: 0-100
  const [score, setScore] = useState(0)
  const scoreRef = useRef(score)
  useEffect(() => { scoreRef.current = score }, [score])

  const [transcriptLines, setTranscriptLines] = useState([])
  const [interimText, setInterimText] = useState('')
  const [lastMotivo, setLastMotivo] = useState('')
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [freqBars, setFreqBars] = useState(Array(NUM_BARS).fill(0))

  const recorderRef = useRef(null)
  const recognitionRef = useRef(null)
  const wakeLockRef = useRef(null)
  const countdownTimerRef = useRef(null)
  const elapsedTimerRef = useRef(null)
  const decayTimerRef = useRef(null)
  const statusRef = useRef(status)

  useEffect(() => { statusRef.current = status }, [status])

  // Deriviamo il livello attuale dal punteggio
  const currentDanger = getLevelFromScore(score)

  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch (_) {}
    }
  }
  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  // ── Analisi testo e punteggio scalare ─────────────────────
  const analyzeText = useCallback(async (text) => {
    if (statusRef.current !== STATES.RECORDING) return

    // 1. HARD TRIGGER LATO CLIENT (ultra-veloce, bypassa l'API per minacce palesi)
    if (HARD_TRIGGERS.test(text)) {
      setLastMotivo("Minaccia fisica esplicita o di morte intercettata immediatamente.")
      setScore(100)
      if (statusRef.current === STATES.RECORDING) startCountdown()
      return
    }

    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      if (!res.ok) return
      const data = await res.json()

      // 2. CONVERSIONE PERICOLO → PUNTI
      if (data.pericolo) {
        if (data.motivo) setLastMotivo(data.motivo)
        
        let pointIncrement = 0
        const tags = data.tag || []

        if (data.pericolo === 5) pointIncrement = 100 // Hard trigger AI
        else if (data.pericolo === 4) pointIncrement = 30
        else if (data.pericolo === 3) pointIncrement = 15
        else if (data.pericolo === 2) pointIncrement = 5
        else if (data.pericolo === 1 || tags.includes('neutro') || tags.includes('calma')) pointIncrement = -3

        // Extra penalità per tag psicologicamente specifici
        if (pointIncrement > 0 && pointIncrement < 100) {
           if (tags.includes('gaslighting') || tags.includes('svalutazione')) pointIncrement += 5
           if (tags.includes('isolamento') || tags.includes('restrizione')) pointIncrement += 10
        }

        if (pointIncrement !== 0) {
          setScore(prev => {
            const newScore = Math.max(0, Math.min(100, prev + pointIncrement))
            // Se scatta il livello 5 (>=100) avvia il timer
            if (newScore >= 100 && statusRef.current === STATES.RECORDING) {
              startCountdown()
            }
            return newScore
          })
        }
      }
    } catch (_) {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Avvia registrazione ───────────────────────────────────
  async function startRecording() {
    setError('')
    setStatus(STATES.STARTING)
    setScore(0)
    setTranscriptLines([])
    setInterimText('')
    setLastMotivo('')
    setElapsed(0)
    setFreqBars(Array(NUM_BARS).fill(0))

    try {
      const recorder = createAudioRecorder({
        onChunk: () => {},
        chunkInterval: 99999,
        onLevel: (freqData) => {
          const step = Math.floor(freqData.length / NUM_BARS)
          const bars = Array.from({ length: NUM_BARS }, (_, i) => (freqData[i * step] || 0) / 255)
          setFreqBars(bars)
        },
      })
      recorderRef.current = recorder
      await recorder.start()
      await acquireWakeLock()
      setStatus(STATES.RECORDING)
      
      elapsedTimerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      
      // Decay Timer: -1 punto ogni 5 secondi (Raffreddamento della conversazione)
      decayTimerRef.current = setInterval(() => {
        setScore(prev => Math.max(0, prev - 1))
      }, 5000)

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SR) {
        setError('Trascrizione vocale non supportata. Usa Chrome o Edge.')
        return
      }
      const recognition = new SR()
      recognition.lang = 'it-IT'
      recognition.continuous = true
      recognition.interimResults = true

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            setTranscriptLines(prev => [...prev, text].slice(-8))
            setInterimText('')
            analyzeText(text)
          } else {
            interim += text
          }
        }
        if (interim) setInterimText(interim)
      }

      recognition.onerror = () => {}
      recognition.onend = () => {
        if (statusRef.current === STATES.RECORDING) {
          try { recognition.start() } catch (_) {}
        }
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (err) {
      setStatus(STATES.IDLE)
      setError(err.name === 'NotAllowedError'
        ? 'Permesso microfono negato.'
        : 'Errore avvio: ' + err.message)
    }
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    recorderRef.current?.stop()
    recorderRef.current = null
    clearInterval(elapsedTimerRef.current)
    clearInterval(countdownTimerRef.current)
    clearInterval(decayTimerRef.current)
    releaseWakeLock()
    setStatus(STATES.IDLE)
    setScore(0)
    setTranscriptLines([])
    setInterimText('')
    setElapsed(0)
    setFreqBars(Array(NUM_BARS).fill(0))
  }

  function startCountdown() {
    if (statusRef.current === STATES.COUNTDOWN || statusRef.current === STATES.CALLING) return
    setStatus(STATES.COUNTDOWN)
    setCountdown(COUNTDOWN_SECONDS)
    let rem = COUNTDOWN_SECONDS
    countdownTimerRef.current = setInterval(() => {
      rem--
      setCountdown(rem)
      if (rem <= 0) {
        clearInterval(countdownTimerRef.current)
        fireEmergency()
      }
    }, 1000)
  }

  function cancelCountdown() {
    clearInterval(countdownTimerRef.current)
    setStatus(STATES.RECORDING)
    setScore(55) // Resetta sotto la soglia per non re-triggerare immediatamente
  }

  async function fireEmergency() {
    setStatus(STATES.CALLING)
    recognitionRef.current?.stop()
    recognitionRef.current = null
    recorderRef.current?.stop()
    recorderRef.current = null
    clearInterval(elapsedTimerRef.current)
    clearInterval(decayTimerRef.current)
    releaseWakeLock()
  }

  useEffect(() => {
    if (shortcut !== 'double-tap') return
    let lastTap = 0
    function handleTap() {
      const now = Date.now()
      if (now - lastTap < 350) {
        if (statusRef.current === STATES.IDLE) startRecording()
        else if (statusRef.current === STATES.RECORDING) stopRecording()
      }
      lastTap = now
    }
    document.addEventListener('touchend', handleTap)
    return () => document.removeEventListener('touchend', handleTap)
  }, [shortcut])

  useEffect(() => () => {
    recognitionRef.current?.stop()
    recorderRef.current?.stop()
    clearInterval(elapsedTimerRef.current)
    clearInterval(countdownTimerRef.current)
    clearInterval(decayTimerRef.current)
    releaseWakeLock()
  }, [])

  function formatTime(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  const accent = dangerAccent(currentDanger)

  if (status === STATES.CALLING) {
    const dangerContext = lastMotivoRef.current || 'segnali di pericolo rilevati'
    return (
      <div className={styles.callingScreen}>
        <div className={styles.mockCallBadge}>🚨 MODALITÀ DI TEST - CHIAMATA SIMULATA 🚨</div>
        <div className={styles.mockCallBox}>
          <span className={styles.mockCallIcon}>📞</span>
          <p className={styles.mockCallTitle}>In uno scenario reale, ora partirebbe la chiamata automatica ed l'SMS.</p>
          <p className={styles.mockCallContext}>
            Pattern critico rilevato: <strong>{dangerContext}</strong>
          </p>
          <p className={styles.mockCallContacts}>
            Contatti che verrebbero allertati:{' '}
            <strong>
              {JSON.parse(localStorage.getItem('mirrorContacts') || '[]')
                .map(c => c.name).join(', ') || 'nessuno configurato'}
            </strong>
          </p>
        </div>
        <button className={styles.btnClose} onClick={() => { setStatus(STATES.IDLE); setError('') }}>
          Torna alla home
        </button>
      </div>
    )
  }

  if (status === STATES.IDLE || status === STATES.STARTING) {
    return (
      <div className={`page-container ${styles.idlePage}`}>
        <header className={`${styles.idleHero} page-enter`}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            Protezione in tempo reale
          </div>
          <h1 className={styles.idleTitle}>SafeVoice</h1>
          <p className={styles.idleDesc}>
            Avvia la registrazione. L'IA attribuisce un punteggio scalare alla conversazione. Se si accumulano più gravità, avvia una chiamata di soccorso in 15 secondi. Trigger immediato per minacce di morte.
          </p>
        </header>

        {error && <div className={`${styles.errorBanner} page-enter`}>{error}</div>}

        <div className={`${styles.recordArea} page-enter page-enter--delay-1`}>
          <button
            className={`${styles.bigRecordBtn} ${status === STATES.STARTING ? styles.bigRecordBtnSpinning : ''}`}
            onClick={startRecording}
            disabled={status === STATES.STARTING}
            aria-label="Avvia protezione"
          >
            <span className={styles.micIcon}>🎤</span>
          </button>
          <p className={styles.recordHint}>
            {status === STATES.STARTING ? 'Accesso al microfono in corso…' : 'Premi per avviare la protezione'}
          </p>
          {shortcut === 'double-tap' && status === STATES.IDLE && (
            <p className={styles.recordHintSub}>o doppio tap sullo schermo</p>
          )}
        </div>

        <div className={`${styles.featureRow} page-enter page-enter--delay-2`}>
           {[['🔒', 'Audio solo locale'], ['⚡', 'Hard-trigger rapido'], ['⚖️', 'Scoring scalare']].map(([icon, label]) => (
            <div key={label} className={styles.featurePill}>
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${styles.recordingPage} ${currentDanger >= 4 ? styles.recordingPageDanger : ''}`}
      style={{ '--accent': accent }}
    >
      <div className={styles.recHeader}>
        <div className={styles.recStatus}>
          <span className={styles.recDot} />
          <span className={styles.recTimer}>{formatTime(elapsed)}</span>
        </div>
        
        {/* Nuovo indicatore grafico del punteggio scalare */}
        <div className={styles.scoreIndicatorWrapper}>
          <div
            className={styles.dangerChip}
            style={{ color: accent, borderColor: `${accent}55`, background: `${accent}18` }}
          >
            Livello {currentDanger}/5
          </div>
          <div className={styles.scoreBarContainer}>
            <div className={styles.scoreBarFill} style={{ width: `${score}%`, background: accent }} />
          </div>
        </div>

        <button className={styles.stopBtn} onClick={stopRecording}>Ferma</button>
      </div>

      <div className={styles.recLayout}>
        <div className={styles.recMain}>
          <div className={styles.dangerSection}>
            <SeverityIndicator level={currentDanger} />
            {lastMotivo && <p className={styles.motivoText}>{lastMotivo}</p>}
          </div>

          <div className={styles.transcriptBox}>
            <span className={styles.transcriptLabel}>Trascrizione live immediata</span>
            {transcriptLines.length === 0 && !interimText
              ? <p className={styles.transcriptEmpty}>In ascolto…</p>
              : (
                <ul className={styles.transcriptLines}>
                  {transcriptLines.map((line, i) => (
                    <li
                      key={i}
                      className={`${styles.transcriptLine} ${i === transcriptLines.length - 1 && !interimText ? styles.transcriptLineLatest : ''}`}
                    >
                      {line}
                    </li>
                  ))}
                  {interimText && (
                    <li className={`${styles.transcriptLine} ${styles.transcriptLineInterim}`}>
                      {interimText}
                    </li>
                  )}
                </ul>
              )
            }
          </div>
        </div>

        <div className={styles.micPanel}>
          <span className={styles.micPanelLabel}>MIC</span>
          <div className={styles.micBars}>
            {freqBars.map((val, i) => (
              <div
                key={i}
                className={styles.micBar}
                style={{
                  height: `${Math.max(3, val * 100)}%`,
                  background: accent,
                  opacity: 0.35 + val * 0.65,
                }}
              />
            ))}
          </div>
          <div className={styles.micLevelDot} style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
        </div>
      </div>

      {status === STATES.COUNTDOWN && (
        <div className={styles.countdownOverlay}>
          <div className={styles.countdownModal}>
            <div className={styles.countdownWarning}>⚠️</div>
            <h2 className={styles.countdownTitle}>Pericolo Rilevato!</h2>
            <p className={styles.countdownDesc}>Chiamata automatica SOS tra:</p>
            <div className={styles.countdownNumber}>{countdown}</div>
            <button className={styles.cancelBtn} onClick={cancelCountdown}>
              ANNULLA CHIAMATA
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
