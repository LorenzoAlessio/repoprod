import { useState, useEffect, useRef, useCallback } from 'react'
import SeverityIndicator from '../components/SeverityIndicator'
import { createAudioRecorder } from '../utils/speech.js'
import { shouldTriggerAlert } from '../utils/emergency.js'
import styles from './SafeVoice.module.css'

const STATES = { IDLE: 'idle', STARTING: 'starting', RECORDING: 'recording', COUNTDOWN: 'countdown', CALLING: 'calling' }
const COUNTDOWN_SECONDS = 5
const NUM_BARS = 16

function dangerAccent(level) {
  if (level >= 4) return '#E8634A'
  if (level === 3) return '#E8A838'
  return '#5B9A8B'
}

export default function SafeVoice() {
  const user = JSON.parse(localStorage.getItem('mirrorUser') || '{}')
  const shortcut = localStorage.getItem('mirrorShortcut') || 'button'

  const [status, setStatus] = useState(STATES.IDLE)
  const [readings, setReadings] = useState([])
  const [transcriptLines, setTranscriptLines] = useState([])
  const [interimText, setInterimText] = useState('')
  const [currentDanger, setCurrentDanger] = useState(1)
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
  const statusRef = useRef(status)
  const lastMotivoRef = useRef(lastMotivo)

  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { lastMotivoRef.current = lastMotivo }, [lastMotivo])

  // ── Wake Lock ─────────────────────────────────────────────
  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch (_) {}
    }
  }
  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  // ── Analisi testo via /api/voice ──────────────────────────
  const analyzeText = useCallback(async (text) => {
    if (statusRef.current !== STATES.RECORDING) return
    try {
      const res = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.pericolo) {
        setCurrentDanger(data.pericolo)
        if (data.motivo) setLastMotivo(data.motivo)
        setReadings(prev => {
          const updated = [...prev, { pericolo: data.pericolo, timestamp: Date.now() }]
          if (statusRef.current === STATES.RECORDING && shouldTriggerAlert(updated)) {
            startCountdown()
          }
          return updated
        })
      }
    } catch (_) {}
  }, [])

  // ── Avvia registrazione ───────────────────────────────────
  async function startRecording() {
    setError('')
    setStatus(STATES.STARTING)
    setReadings([])
    setTranscriptLines([])
    setInterimText('')
    setCurrentDanger(1)
    setLastMotivo('')
    setElapsed(0)
    setFreqBars(Array(NUM_BARS).fill(0))

    try {
      // Recorder per livelli mic (non invia chunk all'API)
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

      // ── SpeechRecognition (trascrizione nativa browser) ───
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
            setTranscriptLines(prev => [...prev, text].slice(-4))
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
        ? 'Permesso microfono negato. Abilitalo nelle impostazioni del browser.'
        : 'Errore avvio: ' + err.message)
    }
  }

  // ── Ferma registrazione ───────────────────────────────────
  function stopRecording() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    recorderRef.current?.stop()
    recorderRef.current = null
    clearInterval(elapsedTimerRef.current)
    clearInterval(countdownTimerRef.current)
    releaseWakeLock()
    setStatus(STATES.IDLE)
    setReadings([])
    setTranscriptLines([])
    setInterimText('')
    setCurrentDanger(1)
    setElapsed(0)
    setFreqBars(Array(NUM_BARS).fill(0))
  }

  // ── Countdown ─────────────────────────────────────────────
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
    setReadings([])
  }

  // ── Emergenza mock ────────────────────────────────────────
  async function fireEmergency() {
    setStatus(STATES.CALLING)
    recognitionRef.current?.stop()
    recognitionRef.current = null
    recorderRef.current?.stop()
    recorderRef.current = null
    clearInterval(elapsedTimerRef.current)
    releaseWakeLock()
  }

  // ── Doppio tap ────────────────────────────────────────────
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
    releaseWakeLock()
  }, [])

  function formatTime(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  const accent = dangerAccent(currentDanger)

  // ── CALLING (mock) ────────────────────────────────────────
  if (status === STATES.CALLING) {
    const dangerContext = lastMotivoRef.current || 'segnali di pericolo rilevati'
    return (
      <div className={styles.callingScreen}>
        <div className={styles.mockCallBadge}>🧪 MODALITÀ TEST</div>
        <div className={styles.mockCallBox}>
          <span className={styles.mockCallIcon}>📞</span>
          <p className={styles.mockCallTitle}>In questa occasione sarebbe partita la chiamata</p>
          <p className={styles.mockCallContext}>
            Pattern rilevato: <strong>{dangerContext}</strong>
          </p>
          <p className={styles.mockCallContacts}>
            Contatti che sarebbero stati chiamati:{' '}
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

  // ── IDLE ──────────────────────────────────────────────────
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
            Avvia la registrazione prima di un incontro a rischio. Se MirrorChat rileva
            segnali di pericolo, chiama automaticamente i tuoi contatti.
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
          {[['🔒', 'Audio mai salvato'], ['👤', 'Testo anonimizzato'], ['📍', 'GPS in emergenza']].map(([icon, label]) => (
            <div key={label} className={styles.featurePill}>
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── RECORDING + COUNTDOWN ─────────────────────────────────
  return (
    <div
      className={`${styles.recordingPage} ${currentDanger >= 4 ? styles.recordingPageDanger : ''}`}
      style={{ '--accent': accent }}
    >
      {/* Header */}
      <div className={styles.recHeader}>
        <div className={styles.recStatus}>
          <span className={styles.recDot} />
          <span className={styles.recTimer}>{formatTime(elapsed)}</span>
        </div>
        <div
          className={styles.dangerChip}
          style={{ color: accent, borderColor: `${accent}55`, background: `${accent}18` }}
        >
          Pericolo {currentDanger}/5
        </div>
        <button className={styles.stopBtn} onClick={stopRecording}>Ferma</button>
      </div>

      {/* Layout: main + mic panel */}
      <div className={styles.recLayout}>

        {/* Left: danger + transcript */}
        <div className={styles.recMain}>
          <div className={styles.dangerSection}>
            <SeverityIndicator level={currentDanger} />
            {lastMotivo && <p className={styles.motivoText}>{lastMotivo}</p>}
          </div>

          <div className={styles.transcriptBox}>
            <span className={styles.transcriptLabel}>Trascrizione live</span>
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

        {/* Right: mic level visualizer */}
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

      {/* Countdown overlay */}
      {status === STATES.COUNTDOWN && (
        <div className={styles.countdownOverlay}>
          <div className={styles.countdownModal}>
            <div className={styles.countdownWarning}>⚠️</div>
            <h2 className={styles.countdownTitle}>Pericolo rilevato</h2>
            <p className={styles.countdownDesc}>Chiamata automatica tra:</p>
            <div className={styles.countdownNumber}>{countdown}</div>
            <button className={styles.cancelBtn} onClick={cancelCountdown}>
              ANNULLA
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
