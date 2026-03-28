import styles from './Settings.module.css'

const ANON_METHODS = [
  {
    id: 'python',
    icon: '🐍',
    title: 'Script Python',
    status: 'active',
    desc: 'Anonimizzazione tramite regex avanzate in Python. Sostituisce nomi, numeri, email, date e codici fiscali con token anonimi.',
  },
  {
    id: 'local-ai',
    icon: '🧠',
    title: 'AI Locale (QWen 2.5 — 1.5B)',
    status: 'coming',
    desc: 'Anonimizzazione tramite modello linguistico locale. Nessun dato inviato in rete. In sviluppo.',
  },
]

const PRIVACY_POINTS = [
  'I tuoi messaggi vengono anonimizzati prima di qualsiasi analisi AI.',
  "L'anonimizzazione avviene lato server tramite script locale — nessun dato grezzo raggiunge l'LLM.",
  'Nessun dato viene salvato o registrato su database.',
  'L\'analisi AI avviene tramite API OpenAI solo sul testo già anonimizzato.',
]

export default function Settings() {
  return (
    <div className={`page-container ${styles.page}`}>

      <header className={`${styles.hero} page-enter`}>
        <span className="section-label">Impostazioni</span>
        <h1 className={styles.title}>Impostazioni</h1>
        <p className={styles.subtitle}>
          Configura MirrorChat e scopri come vengono protetti i tuoi dati.
        </p>
      </header>

      {/* ── Anonimizzazione ── */}
      <section className={`${styles.section} page-enter page-enter--delay-1`}>
        <span className="section-label">01 — Metodo di anonimizzazione</span>
        <div className={styles.methodGrid}>
          {ANON_METHODS.map(m => (
            <div
              key={m.id}
              className={`${styles.methodCard} ${m.status === 'active' ? styles.methodCardActive : styles.methodCardComingSoon}`}
            >
              <div className={styles.methodTop}>
                <span className={styles.methodIcon}>{m.icon}</span>
                <div>
                  <h3 className={styles.methodTitle}>{m.title}</h3>
                  <span className={`${styles.methodBadge} ${m.status === 'active' ? styles.badgeActive : styles.badgeSoon}`}>
                    {m.status === 'active' ? 'Attivo' : 'In arrivo'}
                  </span>
                </div>
              </div>
              <p className={styles.methodDesc}>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Privacy ── */}
      <section className={`${styles.section} page-enter page-enter--delay-2`}>
        <span className="section-label">02 — Privacy e dati</span>
        <div className={styles.privacyCard}>
          <h3 className={styles.privacyTitle}>Come proteggiamo i tuoi dati</h3>
          <ul className={styles.privacyList}>
            {PRIVACY_POINTS.map((p, i) => (
              <li key={i} className={styles.privacyItem}>
                <span className={styles.privacyCheck}>✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── About ── */}
      <section className={`${styles.section} page-enter page-enter--delay-3`}>
        <span className="section-label">03 — Informazioni</span>
        <div className={styles.aboutCard}>
          <div className={styles.aboutLogo}>
            <span>Mirror</span><span className={styles.aboutLogoAccent}>Chat</span>
          </div>
          <p className={styles.aboutDesc}>
            MirrorChat aiuta a riconoscere la manipolazione psicologica nelle
            comunicazioni digitali. Uno strumento per chiunque voglia capire meglio
            le dinamiche relazionali e proteggersi.
          </p>
          <div className={styles.aboutMeta}>
            <span className={styles.metaItem}>v2.0.0</span>
            <span className={styles.metaSep}>·</span>
            <span className={styles.metaItem}>OpenAI GPT-4o-mini</span>
            <span className={styles.metaSep}>·</span>
            <span className={styles.metaItem}>Python anonymizer</span>
          </div>
        </div>
      </section>

    </div>
  )
}
