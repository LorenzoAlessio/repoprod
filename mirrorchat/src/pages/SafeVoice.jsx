import { Link } from 'react-router-dom'
import styles from './SafeVoice.module.css'

const features = [
  {
    icon: '◎',
    title: 'Ascolto in tempo reale',
    desc: 'Il microfono trascrive la conversazione istantaneamente, senza registrare audio.',
  },
  {
    icon: '⬡',
    title: 'Rilevamento pericolo',
    desc: "L'AI valuta il livello di rischio 1-5 e ti avvisa se la conversazione diventa pericolosa.",
  },
  {
    icon: '▲',
    title: 'Escalation automatica',
    desc: 'Se il pericolo supera la soglia, prepara automaticamente i dati per contattare il 112.',
  },
  {
    icon: '◈',
    title: 'Zero tracce',
    desc: 'La trascrizione viene analizzata e poi eliminata. Niente rimane sul server.',
  },
]

export default function SafeVoice() {
  return (
    <div className={`page-container ${styles.page}`}>

      {/* ── Hero ── */}
      <header className={`${styles.hero} page-enter`}>
        <span className="section-label">SafeVoice</span>
        <div className={styles.badge}>In sviluppo</div>
        <h1 className={styles.title}>Protezione vocale<br />in tempo reale</h1>
        <p className={styles.subtitle}>
          SafeVoice ascolta la conversazione in tempo reale, riconosce i segnali di pericolo
          e ti avvisa prima che la situazione peggiori. Nessun audio registrato.
        </p>
      </header>

      {/* ── Preview mockup ── */}
      <div className={`${styles.mockup} page-enter page-enter--delay-1`} aria-hidden="true">
        <div className={styles.mockupInner}>
          <div className={styles.mockupStatus}>
            <span className={styles.mockupDot} />
            <span>In ascolto…</span>
          </div>
          <div className={styles.mockupMeter}>
            <div className={styles.mockupMeterLabel}>
              <span>Livello pericolo</span>
              <span className={styles.mockupMeterValue}>2 / 5</span>
            </div>
            <div className={styles.mockupBar}>
              <div className={styles.mockupFill} style={{ width: '40%' }} />
            </div>
          </div>
          <div className={styles.mockupTranscript}>
            <p className={styles.mockupLine}>
              <span className={styles.mockupToken}>[PERSONA_1]</span>
              : «Non mi hai risposto per due ore, mi dici il perché?»
            </p>
            <p className={styles.mockupLine} style={{ opacity: 0.45 }}>
              Trascrizione live in corso…
            </p>
          </div>
        </div>
      </div>

      {/* ── Feature list ── */}
      <section className={`${styles.features} page-enter page-enter--delay-2`}>
        <span className="section-label">Cosa farà</span>
        <div className={styles.featuresGrid}>
          {features.map(f => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <div className={`${styles.cta} page-enter page-enter--delay-3`}>
        <p className={styles.ctaText}>
          Nel frattempo puoi analizzare i messaggi scritti con <strong>Analisi Chat</strong>.
        </p>
        <Link to="/chat" className="btn btn--aurora">
          Vai all'analisi chat →
        </Link>
      </div>

    </div>
  )
}
