import { useState, useEffect, useCallback } from 'react'
import { getStoredProfileData, clearProfile, consolidateProfile } from '../utils/profiler'
import s from './Profile.module.css'

const FACT_LABELS = {
  genere: { label: 'Genere', options: ['donna', 'uomo', 'non-binario', 'non_determinato'] },
  eta_stimata: { label: 'Età stimata', options: ['14-16', '16-18', '18-20', '20+'] },
  ha_partner: { label: 'Ha un partner', options: ['si', 'no', 'non_determinato'] },
  genere_partner: { label: 'Genere partner', options: ['uomo', 'donna', 'non-binario', 'non_determinato'] },
  tipo_relazione: { label: 'Tipo relazione', options: ['fidanzato/a', 'marito/moglie', 'ex', 'conoscente', 'altro'] },
  ha_figli: { label: 'Ha figli', options: ['si', 'no', 'non_determinato'] },
  vive_con: { label: 'Vive con', options: ['genitori', 'partner', 'da solo/a', 'altro'] },
  studia: { label: 'Studia', options: ['si', 'no', 'non_determinato'] },
  lavora: { label: 'Lavora', options: ['si', 'no', 'non_determinato'] },
  stato_emotivo: { label: 'Stato emotivo', options: ['paura', 'confusione', 'rabbia', 'tristezza', 'dipendenza', 'altro'] },
  isolamento: { label: 'Isolamento sociale', options: ['si', 'no', 'parziale'] },
}

const FACTS_KEY = 'mirrorchat_profile_facts'
const PROFILE_KEY = 'mirrorchat_profile_md'
const COUNT_KEY = 'mirrorchat_analysis_count'

export default function Profile() {
  const [facts, setFacts] = useState([])
  const [profile, setProfile] = useState('')
  const [analysisCount, setAnalysisCount] = useState(0)
  const [editingNarrative, setEditingNarrative] = useState(null)
  const [editText, setEditText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(() => {
    const data = getStoredProfileData()
    setFacts(data.facts)
    setProfile(data.profile)
    setAnalysisCount(data.analysisCount)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Fact editing ──
  const updateFact = (factKey, newValue) => {
    const updated = [...facts]
    const idx = updated.findIndex(f => f.fact === factKey)
    const date = new Date().toISOString().split('T')[0]
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], value: newValue, date, source: 'manual' }
    } else {
      updated.push({ fact: factKey, value: newValue, confidence: 1.0, source: 'manual', date })
    }
    setFacts(updated)
    localStorage.setItem(FACTS_KEY, JSON.stringify(updated))
  }

  const removeFact = (factKey) => {
    const updated = facts.filter(f => f.fact !== factKey)
    setFacts(updated)
    localStorage.setItem(FACTS_KEY, JSON.stringify(updated))
  }

  const getFactValue = (factKey) => {
    const f = facts.find(f => f.fact === factKey)
    return f ? f.value : ''
  }

  // ── Narrative editing ──
  const sections = []
  if (profile) {
    const re = /### (.+)\n([\s\S]*?)(?=\n### |$)/g
    let m
    while ((m = re.exec(profile)) !== null) {
      sections.push({ title: m[1].trim(), content: m[2].trim() })
    }
  }
  const narrativeSections = sections.filter(sec => !sec.title.toLowerCase().includes('scheda'))

  const startEditNarrative = (idx) => {
    setEditingNarrative(idx)
    setEditText(narrativeSections[idx].content)
  }

  const saveNarrative = (idx) => {
    const title = narrativeSections[idx].title
    let newProfile = profile
    const oldSection = `### ${title}\n${narrativeSections[idx].content}`
    const newSection = `### ${title}\n${editText}`
    newProfile = newProfile.replace(oldSection, newSection)
    setProfile(newProfile)
    localStorage.setItem(PROFILE_KEY, newProfile)
    setEditingNarrative(null)
  }

  // ── Regenerate profile from facts ──
  const handleRegenerate = async () => {
    setSaving(true)
    try {
      await consolidateProfile()
      loadData()
    } catch { /* ignore */ }
    setSaving(false)
  }

  // ── Delete all ──
  const handleDelete = () => {
    clearProfile()
    setFacts([])
    setProfile('')
    setAnalysisCount(0)
    setShowConfirm(false)
  }

  const isEmpty = facts.length === 0 && !profile

  return (
    <main className={s.container}>
      <header className={s.header}>
        <span className={s.label}>PROFILO</span>
        <h1 className={s.title}>Il tuo profilo</h1>
      </header>

      {/* Privacy info */}
      <section className={s.infoCard}>
        <div className={s.infoIcon}>🛡️</div>
        <div>
          <h3 className={s.infoTitle}>Questo profilo serve per la tua protezione</h3>
          <p className={s.infoText}>
            MirrorChat costruisce un profilo anonimo per conoscerti meglio e fornirti assistenza più efficace.
            Tutto resta privato e sul tuo dispositivo.
          </p>
          <ul className={s.infoList}>
            <li>Nessun nome o dato identificabile viene salvato</li>
            <li>I dati restano solo sul tuo telefono</li>
            <li>Puoi modificare o cancellare tutto in qualsiasi momento</li>
            <li>Migliora la qualità dell'analisi e della protezione</li>
          </ul>
        </div>
      </section>

      {/* Empty state */}
      {isEmpty && (
        <section className={s.emptyState}>
          <p className={s.emptyText}>
            Il profilo si costruisce automaticamente analizzando i tuoi messaggi. Puoi anche compilarlo manualmente.
          </p>
          <a href="/chat" className={s.emptyLink}>Analizza un messaggio →</a>
        </section>
      )}

      {/* Facts as editable fields */}
      <section className={s.factsSection}>
        <h2 className={s.sectionTitle}>I tuoi dati</h2>
        <p className={s.sectionDesc}>
          Questi dati vengono estratti automaticamente dalle tue conversazioni. Puoi correggerli o aggiungerli.
        </p>
        <div className={s.factsGrid}>
          {Object.entries(FACT_LABELS).map(([key, config]) => {
            const value = getFactValue(key)
            return (
              <div key={key} className={s.factField}>
                <label className={s.factLabel}>{config.label}</label>
                <div className={s.factRow}>
                  <select
                    className={`${s.factSelect} ${value ? s.factFilled : ''}`}
                    value={value}
                    onChange={(e) => updateFact(key, e.target.value)}
                  >
                    <option value="">— non specificato —</option>
                    {config.options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {value && (
                    <button className={s.factRemove} onClick={() => removeFact(key)} title="Rimuovi">×</button>
                  )}
                </div>
                {value && facts.find(f => f.fact === key) && (
                  <span className={s.factSource}>
                    {facts.find(f => f.fact === key).source === 'manual' ? '✏️ inserito manualmente' : `🤖 rilevato da ${facts.find(f => f.fact === key).source}`}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Extra facts not in predefined list */}
      {facts.filter(f => !FACT_LABELS[f.fact]).length > 0 && (
        <section className={s.extraFacts}>
          <h3 className={s.sectionTitle}>Altri fatti rilevati</h3>
          <div className={s.factsList}>
            {facts.filter(f => !FACT_LABELS[f.fact]).map((f, i) => (
              <div key={i} className={s.extraPill}>
                <span>{f.fact}: {f.value}</span>
                <button className={s.pillRemove} onClick={() => removeFact(f.fact)}>×</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Narrative sections (from consolidated profile) */}
      {narrativeSections.length > 0 && (
        <section className={s.narrativeSection}>
          <h2 className={s.sectionTitle}>Analisi del profilo</h2>
          <p className={s.sectionDesc}>
            Generato dall'AI basandosi sui dati raccolti. Puoi modificare ogni sezione.
          </p>
          {narrativeSections.map((sec, i) => (
            <div key={i} className={s.narrativeCard}>
              <div className={s.narrativeHeader}>
                <span>{sec.title}</span>
                <button
                  className={s.editBtn}
                  onClick={() => editingNarrative === i ? setEditingNarrative(null) : startEditNarrative(i)}
                >
                  {editingNarrative === i ? 'Annulla' : '✏️ Modifica'}
                </button>
              </div>
              {editingNarrative === i ? (
                <div className={s.narrativeEdit}>
                  <textarea
                    className={s.narrativeTextarea}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={6}
                  />
                  <button className={s.btnPrimary} onClick={() => saveNarrative(i)}>Salva</button>
                </div>
              ) : (
                <div className={s.narrativeContent}>
                  <p>{sec.content}</p>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Actions */}
      <div className={s.actions}>
        <p className={s.actionsMeta}>
          {analysisCount > 0 && `Basato su ${analysisCount} analisi`}
          {analysisCount > 0 && facts.length > 0 && ' · '}
          {facts.length > 0 && `${facts.length} fatti raccolti`}
        </p>
        <button
          className={s.btnSecondary}
          onClick={handleRegenerate}
          disabled={saving || facts.length === 0}
        >
          {saving ? 'Generazione in corso...' : '🔄 Rigenera profilo dall\'AI'}
        </button>
        <button className={s.btnDanger} onClick={() => setShowConfirm(true)}>
          🗑️ Cancella tutti i dati
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div className={s.modal}>
          <div className={s.modalCard}>
            <h3 className={s.modalTitle}>Cancellare il profilo?</h3>
            <p className={s.modalText}>
              Questa azione cancellerà il tuo profilo e tutti i fatti raccolti. Non è reversibile.
            </p>
            <div className={s.modalButtons}>
              <button className={s.btnSecondary} onClick={() => setShowConfirm(false)}>Annulla</button>
              <button className={s.btnDanger} onClick={handleDelete}>Cancella tutto</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
