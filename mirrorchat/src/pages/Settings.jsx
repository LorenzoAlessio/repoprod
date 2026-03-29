import { useState, useEffect, useCallback } from 'react'
import { getStoredProfileData, clearProfile, consolidateProfile } from '../utils/profiler'
import styles from './Settings.module.css'

export function getStoredGender() {
  const facts = JSON.parse(localStorage.getItem('mirrorchat_profile_facts') || '[]')
  const f = facts.find(f => f.fact === 'genere')
  return f ? f.value : (localStorage.getItem('mirrorchat_genere') || 'non_specificato')
}

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

const RELATIONSHIPS = ['Genitore', 'Amico/a', 'Fidanzato/a', 'Fratello/Sorella', 'Parente', 'Altro']
const BLANK_PERSON = { name: '', surname: '', phone: '', relationship: 'Altro' }

export default function Settings() {
  const user = JSON.parse(localStorage.getItem('mirrorUser') || '{}')
  
  // ── Toggle State ──
  const [expanded, setExpanded] = useState({ profile: true, privacy: false, risk: false })
  const toggle = (sec) => setExpanded(prev => ({ ...prev, [sec]: !prev[sec] }))

  // ── Profile State ──
  const [facts, setFacts] = useState([])
  const [profile, setProfile] = useState('')
  const [analysisCount, setAnalysisCount] = useState(0)
  const [editingNarrative, setEditingNarrative] = useState(null)
  const [editText, setEditText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Lists State ──
  const [emergencyContacts, setEmergencyContacts] = useState(() => JSON.parse(localStorage.getItem('mirrorContacts') || '[]'))
  const [familyMembers, setFamilyMembers] = useState(() => JSON.parse(localStorage.getItem('mirrorFamily') || '[]'))
  const [atRiskUsers, setAtRiskUsers] = useState(() => JSON.parse(localStorage.getItem('mirrorAtRisk') || '[]'))
  
  const [showAddForm, setShowAddForm] = useState(null) // 'emergency' | 'family' | 'risk' | null
  const [newPerson, setNewPerson] = useState({ ...BLANK_PERSON })
  const [formError, setFormError] = useState('')

  const loadProfileData = useCallback(() => {
    const data = getStoredProfileData()
    setFacts(data.facts)
    setProfile(data.profile)
    setAnalysisCount(data.analysisCount)
  }, [])

  useEffect(() => { loadProfileData() }, [loadProfileData])

  // ── Profile Actions ──
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

  const handleRegenerate = async () => {
    setSaving(true)
    try {
      await consolidateProfile()
      loadProfileData()
    } catch { /* ignore */ }
    setSaving(false)
  }

  const handleDeleteProfile = () => {
    clearProfile()
    setFacts([])
    setProfile('')
    setAnalysisCount(0)
    setShowConfirm(false)
  }

  // Narrative parsing
  const narrativeSections = []
  if (profile) {
    const re = /### (.+)\n([\s\S]*?)(?=\n### |$)/g
    let m
    while ((m = re.exec(profile)) !== null) {
      if (!m[1].toLowerCase().includes('scheda')) {
        narrativeSections.push({ title: m[1].trim(), content: m[2].trim() })
      }
    }
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

  // ── List Actions ──
  const saveList = (type, updated) => {
    const keys = { emergency: 'mirrorContacts', family: 'mirrorFamily', risk: 'mirrorAtRisk' }
    const setters = { emergency: setEmergencyContacts, family: setFamilyMembers, risk: setAtRiskUsers }
    setters[type](updated)
    localStorage.setItem(keys[type], JSON.stringify(updated))
  }

  const handleAddPerson = (e) => {
    e.preventDefault()
    if (showAddForm === 'risk') {
      // At-risk users: all fields optional as per request
    } else {
      if (!newPerson.name.trim() || !newPerson.phone.trim()) {
        return setFormError('Nome e telefono sono obbligatori.')
      }
    }

    const currentList = { emergency: emergencyContacts, family: familyMembers, risk: atRiskUsers }[showAddForm]
    saveList(showAddForm, [...currentList, { ...newPerson }])
    setNewPerson({ ...BLANK_PERSON })
    setShowAddForm(null)
    setFormError('')
  }

  const removePerson = (type, i) => {
    const currentList = { emergency: emergencyContacts, family: familyMembers, risk: atRiskUsers }[type]
    saveList(type, currentList.filter((_, idx) => idx !== i))
  }

  const handleLogout = () => {
    localStorage.removeItem('mirrorUser')
    window.location.href = '/onboarding'
  }

  return (
    <div className={`page-container ${styles.page}`}>
      <header className={`${styles.hero} page-enter`}>
        <span className="section-label">Impostazioni</span>
        <h1 className={styles.title}>Impostazioni</h1>
        <p className={styles.subtitle}>
          Gestisci il tuo profilo, la tua rete di protezione e i dati di privacy.
        </p>
      </header>

      {/* ── SEZIONE 01: PROFILO ── */}
      <section className={`${styles.toggleSection} ${expanded.profile ? styles.toggleSectionOpen : ''} page-enter`}>
        <button className={styles.toggleHeader} onClick={() => toggle('profile')}>
          <div className={styles.toggleTitle}>
            <span className={styles.toggleIcon}>👤</span>
            <span>Il mio profilo</span>
          </div>
          <span className={`${styles.toggleChevron} ${expanded.profile ? styles.toggleChevronOpen : ''}`}>▼</span>
        </button>

        {expanded.profile && (
          <div className={styles.toggleContent}>
            <div className={styles.factsGrid}>
              {Object.entries(FACT_LABELS).map(([key, config]) => {
                const f = facts.find(f => f.fact === key)
                const value = f ? f.value : ''
                return (
                  <div key={key} className={styles.factField}>
                    <label className={styles.factLabel}>{config.label}</label>
                    <div className={styles.factRow}>
                      <select
                        className={`${styles.factSelect} ${value ? styles.factFilled : ''}`}
                        value={value}
                        onChange={(e) => updateFact(key, e.target.value)}
                      >
                        <option value="">— non specificato —</option>
                        {config.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {value && (
                        <button className={styles.factRemove} onClick={() => removeFact(key)}>×</button>
                      )}
                    </div>
                    {value && f && (
                      <span className={styles.factSource}>
                        {f.source === 'manual' ? '✏️ inserito manualmente' : `🤖 rilevato da ${f.source}`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {narrativeSections.length > 0 && (
              <div className={styles.narrativeZone}>
                <span className={styles.subSectionTitle}>Analisi del profilo</span>
                {narrativeSections.map((sec, i) => (
                  <div key={i} className={styles.narrativeCard}>
                    <div className={styles.narrativeHeader}>
                      <span>{sec.title}</span>
                      <button className={styles.editBtn} onClick={() => {
                        if (editingNarrative === i) { setEditingNarrative(null) }
                        else { setEditingNarrative(i); setEditText(sec.content) }
                      }}>
                        {editingNarrative === i ? 'Annulla' : '✏️'}
                      </button>
                    </div>
                    {editingNarrative === i ? (
                      <div style={{ padding: '0 16px 16px' }}>
                        <textarea
                          className={styles.narrativeTextarea}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={4}
                        />
                        <button className={styles.btnAdd} onClick={() => saveNarrative(i)}>Salva</button>
                      </div>
                    ) : (
                      <div className={styles.narrativeContent}>{sec.content}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className={styles.profileActions}>
              <p className={styles.actionsMeta}>
                {analysisCount > 0 ? `Basato su ${analysisCount} analisi · ` : ''}
                {facts.length} fatti raccolti
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={styles.btnSecondary} onClick={handleRegenerate} disabled={saving || facts.length === 0}>
                  {saving ? 'Generazione...' : '🔄 Rigenera Profilo'}
                </button>
                <button className={styles.btnDanger} onClick={() => setShowConfirm(true)}>
                  🗑️ Cancella Dati
                </button>
              </div>
            </div>

            {user.name && (
              <button className={styles.btnLogout} onClick={handleLogout}>
                Esci (Loggato come {user.name})
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── SEZIONE 02: DATI DI PRIVACY ── */}
      <section className={`${styles.toggleSection} ${expanded.privacy ? styles.toggleSectionOpen : ''} page-enter page-enter--delay-1`}>
        <button className={styles.toggleHeader} onClick={() => toggle('privacy')}>
          <div className={styles.toggleTitle}>
            <span className={styles.toggleIcon}>🛡️</span>
            <span>Dati di privacy</span>
          </div>
          <span className={`${styles.toggleChevron} ${expanded.privacy ? styles.toggleChevronOpen : ''}`}>▼</span>
        </button>

        {expanded.privacy && (
          <div className={styles.toggleContent}>
            {/* Familiari */}
            <div className={styles.subSection}>
              <span className={styles.subSectionTitle}>I tuoi familiari</span>
              <ul className={styles.contactList}>
                {familyMembers.map((c, i) => (
                  <li key={i} className={styles.contactItem}>
                    <div className={styles.contactInfo}>
                      <span className={styles.contactName}>{c.name} {c.surname}</span>
                      <span className={styles.contactMeta}>{c.relationship} {c.phone && `· ${c.phone}`}</span>
                    </div>
                    <button className={styles.btnRemove} onClick={() => removePerson('family', i)}>✕</button>
                  </li>
                ))}
              </ul>
              {showAddForm === 'family' ? (
                <PersonForm
                  onSave={handleAddPerson}
                  onCancel={() => setShowAddForm(null)}
                  newPerson={newPerson}
                  setNewPerson={setNewPerson}
                  error={formError}
                  title="Nuovo familiare"
                />
              ) : (
                <button className={styles.btnAddNew} onClick={() => { setShowAddForm('family'); setNewPerson({...BLANK_PERSON}) }}>
                  + Aggiungi familiare
                </button>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--mist)', margin: '8px 0' }} />

            {/* Contatti Emergenza */}
            <div className={styles.subSection}>
              <span className={styles.subSectionTitle}>Contatti di emergenza</span>
              <p className={styles.sectionDesc} style={{ marginBottom: '12px' }}>
                Chiamati in ordine di priorità da SafeVoice.
              </p>
              <ul className={styles.contactList}>
                {emergencyContacts.map((c, i) => (
                  <li key={i} className={styles.contactItem}>
                    <div className={styles.contactInfo}>
                      <span className={styles.contactName}>{c.name} {c.surname}</span>
                      <span className={styles.contactMeta}>{c.relationship} · {c.phone}</span>
                    </div>
                    <button className={styles.btnRemove} onClick={() => removePerson('emergency', i)}>✕</button>
                  </li>
                ))}
              </ul>
              {showAddForm === 'emergency' ? (
                <PersonForm
                  onSave={handleAddPerson}
                  onCancel={() => setShowAddForm(null)}
                  newPerson={newPerson}
                  setNewPerson={setNewPerson}
                  error={formError}
                  title="Contatto emergenza"
                  requirePhone
                />
              ) : (
                <button className={styles.btnAddNew} onClick={() => { setShowAddForm('emergency'); setNewPerson({...BLANK_PERSON}) }}>
                  + Aggiungi contatto emergenza
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── SEZIONE 03: UTENTI A RISCHIO ── */}
      <section className={`${styles.toggleSection} ${expanded.risk ? styles.toggleSectionOpen : ''} page-enter page-enter--delay-2`}>
        <button className={styles.toggleHeader} onClick={() => toggle('risk')}>
          <div className={styles.toggleTitle}>
            <span className={styles.toggleIcon}>⚠️</span>
            <span>Utenti a rischio</span>
          </div>
          <span className={`${styles.toggleChevron} ${expanded.risk ? styles.toggleChevronOpen : ''}`}>▼</span>
        </button>

        {expanded.risk && (
          <div className={styles.toggleContent}>
            <p className={styles.sectionDesc}>
              Lista delle persone da cui desideri salvaguardarti. Questi dati aiutano l'AI a rilevare potenziali pericoli.
            </p>
            <ul className={styles.contactList}>
              {atRiskUsers.map((c, i) => (
                <li key={i} className={`${styles.contactItem} styles.riskCard`}>
                  <div className={styles.contactInfo}>
                    <span className={styles.contactName}>{c.name} {c.surname}</span>
                    <span className={styles.contactMeta}>{c.phone || 'Numero non specificato'}</span>
                  </div>
                  <button className={styles.btnRemove} onClick={() => removePerson('risk', i)}>✕</button>
                </li>
              ))}
            </ul>
            {showAddForm === 'risk' ? (
              <PersonForm
                onSave={handleAddPerson}
                onCancel={() => setShowAddForm(null)}
                newPerson={newPerson}
                setNewPerson={setNewPerson}
                error={formError}
                title="Soggetto a rischio"
              />
            ) : (
              <button className={styles.btnAddNew} onClick={() => { setShowAddForm('risk'); setNewPerson({...BLANK_PERSON}) }}>
                + Segnala utente a rischio
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── ABOUT ── */}
      <section className="page-enter page-enter--delay-3" style={{ marginTop: '24px' }}>
        <div className={styles.aboutCard}>
          <div className={styles.aboutLogo}>
            <span>Mirror</span><span className={styles.aboutLogoAccent}>Chat</span>
          </div>
          <p className={styles.aboutDesc}>
            MirrorChat analizza le dinamiche relazionali per la tua protezione. Tutti i dati restano criptati sul dispositivo.
          </p>
          <div className={styles.aboutMeta}>
            <span>v2.1.0</span> · <span>Privacy First</span> · <span>AI-Driven Safety</span>
          </div>
        </div>
      </section>

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalCard}>
            <h3 className={styles.modalTitle}>Cancellare tutto?</h3>
            <p className={styles.modalText}>Questa azione eliminerà permanentemente i fatti raccolti e l'analisi del profilo.</p>
            <div className={styles.modalButtons}>
              <button className={styles.btnCancel} onClick={() => setShowConfirm(false)}>Annulla</button>
              <button className={styles.btnDanger} onClick={handleDeleteProfile}>Cancella</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PersonForm({ onSave, onCancel, newPerson, setNewPerson, error, title, requirePhone }) {
  return (
    <form className={styles.addForm} onSubmit={onSave}>
      <span className={styles.subSectionTitle}>{title}</span>
      <div className={styles.formRow}>
        <input
          className={styles.input}
          placeholder="Nome"
          value={newPerson.name}
          onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))}
        />
        <input
          className={styles.input}
          placeholder="Cognome"
          value={newPerson.surname}
          onChange={e => setNewPerson(p => ({ ...p, surname: e.target.value }))}
        />
      </div>
      <div className={styles.formRow}>
        <input
          className={styles.input}
          placeholder={requirePhone ? "Telefono *" : "Telefono"}
          value={newPerson.phone}
          onChange={e => setNewPerson(p => ({ ...p, phone: e.target.value }))}
        />
        {title !== 'Soggetto a rischio' && (
          <select
            className={styles.input}
            value={newPerson.relationship}
            onChange={e => setNewPerson(p => ({ ...p, relationship: e.target.value }))}
          >
            {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>
      {error && <p className={styles.fieldError}>{error}</p>}
      <div className={styles.formBtns}>
        <button className={styles.btnAdd} type="submit">Salva</button>
        <button className={styles.btnCancel} type="button" onClick={onCancel}>Annulla</button>
      </div>
    </form>
  )
}
