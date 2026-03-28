import { useState } from 'react'
import { educationCards } from '../data/education'
import { resources } from '../data/resources'
import styles from './Learn.module.css'

function EducationCard({ card }) {
  const [open, setOpen] = useState(false)

  return (
    <article
      className={`${styles.eduCard} ${open ? styles.eduCardOpen : ''}`}
      onClick={() => setOpen(o => !o)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(o => !o))}
      tabIndex={0}
      role="button"
      aria-expanded={open}
      aria-label={`${card.title}: ${open ? 'comprimi' : 'espandi'}`}
    >
      {/* Header */}
      <div className={styles.eduCardHeader}>
        <span className={styles.eduEmoji}>{card.emoji}</span>
        <div className={styles.eduCardMeta}>
          <h3 className={styles.eduTitle}>{card.title}</h3>
          <p className={styles.eduShort}>{card.shortDesc}</p>
        </div>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          ↓
        </span>
      </div>

      {/* Expandable detail */}
      <div className={`${styles.eduDetail} ${open ? styles.eduDetailOpen : ''}`}>
        <p className={styles.eduLong}>{card.longDesc}</p>

        <div className={styles.eduExample}>
          <span className={styles.eduExampleLabel}>Esempio tipico</span>
          <blockquote className={styles.eduQuote}>{card.example}</blockquote>
        </div>

        <div className={styles.eduFlags}>
          <span className={styles.eduFlagsLabel}>Segnali da riconoscere</span>
          <ul className={styles.eduFlagsList}>
            {card.redFlags.map(flag => (
              <li key={flag} className={styles.eduFlag}>
                <span className={styles.eduFlagDot} />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

function ResourceCard({ resource }) {
  const isPhone = resource.url.startsWith('tel:')

  return (
    <a
      href={resource.url}
      className={styles.resourceCard}
      target={!isPhone ? '_blank' : undefined}
      rel={!isPhone ? 'noopener noreferrer' : undefined}
    >
      <div className={styles.resourceTop}>
        <h3 className={styles.resourceName}>{resource.nome}</h3>
        {resource.number && (
          <span className={styles.resourceNumber}>{resource.number}</span>
        )}
      </div>
      <p className={styles.resourceDesc}>{resource.description}</p>
      <span className={styles.resourceCta}>
        {isPhone ? 'Chiama →' : 'Visita il sito →'}
      </span>
    </a>
  )
}

export default function Learn() {
  return (
    <div className={`page-container ${styles.page}`}>

      {/* ── Hero ── */}
      <header className={`${styles.hero} page-enter`}>
        <span className="section-label">Impara</span>
        <h1 className={styles.title}>Impara a riconoscere</h1>
        <p className={styles.subtitle}>
          Le tecniche manipolatorie più comuni nelle relazioni — amicali, romantiche, familiari.
          Riconoscerle è il primo passo per proteggersi.
        </p>
      </header>

      {/* ── Education Cards ── */}
      <section className={`${styles.eduSection} page-enter page-enter--delay-1`}>
        <span className="section-label">01 — Tecniche manipolatorie</span>
        <div className={styles.eduGrid}>
          {educationCards.map((card, i) => (
            <EducationCard
              key={card.id}
              card={card}
            />
          ))}
        </div>
      </section>

      {/* ── Resources ── */}
      <section className={`${styles.resourcesSection} page-enter page-enter--delay-2`}>
        <span className="section-label">02 — Risorse e aiuto</span>
        <h2 className={styles.resourcesTitle}>Non sei sola/o</h2>
        <p className={styles.resourcesSub}>
          Questi servizi sono gratuiti, anonimi e riservati.
        </p>
        <div className={styles.resourcesGrid}>
          {resources.map(r => (
            <ResourceCard key={r.nome} resource={r} />
          ))}
        </div>
      </section>

    </div>
  )
}
