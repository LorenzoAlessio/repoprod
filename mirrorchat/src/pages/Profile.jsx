import { useState, useEffect, useCallback } from 'react'
import { getStoredProfileData, getStoredProfile, clearProfile, consolidateProfile } from '../utils/profiler'
import styles from './Profile.module.css'

export default function Profile() {
  const [profile, setProfile] = useState('')
  const [facts, setFacts] = useState([])
  const [analysisCount, setAnalysisCount] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const loadData = useCallback(() => {
    const data = getStoredProfileData()
    setProfile(data.profile)
    setFacts(data.facts)
    setAnalysisCount(data.analysisCount)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleEdit = () => {
    setEditing(true)
    setEditText(profile)
  }

  const handleSave = () => {
    localStorage.setItem('mirrorchat_profile_md', editText)
    setProfile(editText)
    setEditing(false)
  }

  const handleDelete = () => {
    clearProfile()
    setProfile('')
    setFacts([])
    setAnalysisCount(0)
    setShowConfirm(false)
  }

  // Parse scheda sintetica from MD
  const sections = []
  if (profile) {
    const sectionRegex = /### (.+)\n([\s\S]*?)(?=\n### |$)/g
    let match
    while ((match = sectionRegex.exec(profile)) !== null) {
      sections.push({ title: match[1].trim(), content: match[2].trim() })
    }
  }

  const scheda = sections.find(s => s.title.toLowerCase().includes('scheda'))
  const narrativeSections = sections.filter(s => !s.title.toLowerCase().includes('scheda'))

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <span className={styles.label}>PROFILO</span>
        <h1 className={styles.title}>Il tuo profilo</h1>
      </header>

      <section className={styles.infoCard}>
        <div className={styles.infoIcon}>🛡️</div>
        <div>
          <h3 className={styles.infoTitle}>Perché esiste questo profilo?</h3>
          <p className={styles.infoText}>
            MirrorChat costruisce un profilo anonimo per conoscerti meglio e proteggerti in modo più efficace.
          </p>
          <ul className={styles.infoList}>
            <li>Nessun nome o dato identificabile</li>
            <li>Salvato solo sul tuo dispositivo</li>
            <li>Puoi cancellarlo in qualsiasi momento</li>
            <li>Migliora la qualità delle analisi</li>
          </ul>
        </div>
      </section>

      {!profile && facts.length === 0 ? (
        <section className={styles.emptyState}>
          <p className={styles.emptyText}>
            Il profilo si costruisce automaticamente analizzando i tuoi messaggi.
          </p>
          <a href="/chat" className={styles.emptyLink}>Analizza un messaggio →</a>
        </section>
      ) : editing ? (
        <section className={styles.editSection}>
          <textarea
            className={styles.editArea}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={20}
          />
          <div className={styles.editButtons}>
            <button className={styles.btnSecondary} onClick={() => setEditing(false)}>Annulla</button>
            <button className={styles.btnPrimary} onClick={handleSave}>Salva</button>
          </div>
        </section>
      ) : (
        <>
          {scheda && (
            <section className={styles.schedaCard}>
              <h2 className={styles.schedaTitle}>Scheda sintetica</h2>
              <div className={styles.schedaContent}>
                {scheda.content.split('\n').filter(l => l.trim()).map((line, i) => (
                  <p key={i} className={styles.schedaLine}>{line.replace(/^[-•]\s*/, '')}</p>
                ))}
              </div>
              <p className={styles.schedaMeta}>
                Basato su {analysisCount} analisi
              </p>
            </section>
          )}

          {narrativeSections.map((section, i) => (
            <NarrativeSection key={i} title={section.title} content={section.content} />
          ))}

          {facts.length > 0 && !profile && (
            <section className={styles.factsCard}>
              <h3 className={styles.factsTitle}>Fatti raccolti ({facts.length})</h3>
              <p className={styles.factsNote}>Il profilo verrà generato dopo {CONSOLIDATE_THRESHOLD(analysisCount)} analisi.</p>
              <div className={styles.factsList}>
                {facts.map((f, i) => (
                  <span key={i} className={styles.factPill}>{f.fact}: {f.value}</span>
                ))}
              </div>
            </section>
          )}

          <div className={styles.actions}>
            {profile && (
              <button className={styles.btnSecondary} onClick={handleEdit}>
                Modifica profilo
              </button>
            )}
            <button className={styles.btnDanger} onClick={() => setShowConfirm(true)}>
              🗑️ Cancella tutti i dati
            </button>
          </div>
        </>
      )}

      {showConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Cancellare il profilo?</h3>
            <p className={styles.modalText}>
              Questa azione cancellerà il tuo profilo e tutti i fatti raccolti. Non è reversibile.
            </p>
            <div className={styles.modalButtons}>
              <button className={styles.btnSecondary} onClick={() => setShowConfirm(false)}>Annulla</button>
              <button className={styles.btnDanger} onClick={handleDelete}>Cancella tutto</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function CONSOLIDATE_THRESHOLD(current) {
  const next = Math.ceil((current + 1) / 3) * 3
  return next - current
}

function NarrativeSection({ title, content }) {
  const [open, setOpen] = useState(false)
  return (
    <section className={styles.narrativeCard}>
      <button className={styles.narrativeHeader} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className={styles.narrativeContent}><p>{content}</p></div>}
    </section>
  )
}
