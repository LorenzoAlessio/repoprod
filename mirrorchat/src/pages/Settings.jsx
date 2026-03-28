import { useState, useEffect } from 'react'
import styles from './Settings.module.css'

export function getStoredGender() {
  return localStorage.getItem('mirrorchat_genere') || 'non_specificato';
}

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
  "L'analisi AI avviene tramite API OpenAI solo sul testo già anonimizzato.",
]

const RELATIONSHIPS = ['Genitore', 'Amico/a', 'Fidanzato/a', 'Fratello/Sorella', 'Parente', 'Altro']

const BLANK_CONTACT = { name: '', surname: '', relationship: 'Genitore', phone: '' }

export default function Settings() {
  const user = JSON.parse(localStorage.getItem('mirrorUser') || '{}')
  const [contacts, setContacts] = useState(() => JSON.parse(localStorage.getItem('mirrorContacts') || '[]'))
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContact, setNewContact] = useState({ ...BLANK_CONTACT })
  const [contactError, setContactError] = useState('')
  const [shortcut, setShortcut] = useState(localStorage.getItem('mirrorShortcut') || 'button')
  const [genere, setGenere] = useState(localStorage.getItem('mirrorchat_genere') || 'non_specificato')

  async function saveContacts(updated) {
    setContacts(updated)
    localStorage.setItem('mirrorContacts', JSON.stringify(updated))
    if (user.id) {
      try {
        await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, contacts: updated }),
        })
      } catch (_) {}
    }
  }

  function removeContact(i) {
    saveContacts(contacts.filter((_, idx) => idx !== i))
  }

  function moveContact(i, dir) {
    const j = i + dir
    if (j < 0 || j >= contacts.length) return
    const updated = [...contacts]
    ;[updated[i], updated[j]] = [updated[j], updated[i]]
    saveContacts(updated)
  }

  function addContact(e) {
    e.preventDefault()
    setContactError('')
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      return setContactError('Nome e telefono sono obbligatori.')
    }
    saveContacts([...contacts, { ...newContact }])
    setNewContact({ ...BLANK_CONTACT })
    setShowAddForm(false)
  }

  function handleShortcutChange(val) {
    setShortcut(val)
    localStorage.setItem('mirrorShortcut', val)
  }

  function handleLogout() {
    localStorage.removeItem('mirrorUser')
    window.location.href = '/onboarding'
  }

  return (
    <div className={`page-container ${styles.page}`}>

      <header className={`${styles.hero} page-enter`}>
        <span className="section-label">Impostazioni</span>
        <h1 className={styles.title}>Impostazioni</h1>
        <p className={styles.subtitle}>
          Configura MirrorChat e scopri come vengono protetti i tuoi dati.
        </p>
      </header>

      {/* ── Profilo ── */}
      {user.name && (
        <section className={`${styles.section} page-enter`}>
          <span className="section-label">01 — Profilo</span>
          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>{user.name.charAt(0).toUpperCase()}</div>
            <div>
              <p className={styles.profileName}>{user.name}</p>
              <p className={styles.profilePhone}>{user.phone}</p>
            </div>
            <button className={styles.btnLogout} onClick={handleLogout}>
              Cambia account
            </button>
          </div>
        </section>
      )}

      {/* ── Genere ── */}
      <section className={`${styles.section} page-enter`}>
        <span className="section-label">Il tuo genere</span>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Il tuo genere</h2>
          <p className={styles.cardDesc}>
            Aiuta l'AI a contestualizzare le dinamiche relazionali. Non viene mai associato ai tuoi dati personali.
          </p>
          <div className={styles.genderOptions}>
            {[
              { value: 'donna', label: 'Donna' },
              { value: 'uomo', label: 'Uomo' },
              { value: 'non-binario', label: 'Non-binario' },
              { value: 'non_specificato', label: 'Preferisco non specificare' },
            ].map(opt => (
              <label key={opt.value} className={`${styles.genderOption} ${genere === opt.value ? styles.genderActive : ''}`}>
                <input
                  type="radio"
                  name="genere"
                  value={opt.value}
                  checked={genere === opt.value}
                  onChange={() => {
                    setGenere(opt.value);
                    localStorage.setItem('mirrorchat_genere', opt.value);
                  }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contatti di emergenza ── */}
      <section className={`${styles.section} page-enter page-enter--delay-1`}>
        <span className="section-label">02 — Contatti di emergenza</span>
        <p className={styles.sectionDesc}>
          Questi contatti vengono chiamati in ordine di priorità quando SafeVoice rileva un pericolo.
          L'SMS con la posizione GPS viene inviato a tutti.
        </p>

        <>
            {contacts.length > 0 && (
              <ul className={styles.contactList}>
                {contacts.map((c, i) => (
                  <li key={i} className={styles.contactItem}>
                    <span className={styles.contactPriority}>{i + 1}</span>
                    <div className={styles.contactInfo}>
                      <span className={styles.contactName}>{c.name} {c.surname}</span>
                      <span className={styles.contactMeta}>{c.relationship} · {c.phone}</span>
                    </div>
                    <div className={styles.contactActions}>
                      <button className={styles.btnOrder} onClick={() => moveContact(i, -1)} disabled={i === 0} aria-label="Sposta su">↑</button>
                      <button className={styles.btnOrder} onClick={() => moveContact(i, 1)} disabled={i === contacts.length - 1} aria-label="Sposta giù">↓</button>
                      <button className={styles.btnRemove} onClick={() => removeContact(i)} aria-label="Rimuovi">✕</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {contacts.length === 0 && !showAddForm && (
              <div className={styles.emptyContacts}>
                <p>Nessun contatto di emergenza impostato.</p>
              </div>
            )}

            {/* Add form */}
            {showAddForm ? (
              <form className={styles.addForm} onSubmit={addContact}>
                <p className={styles.addFormTitle}>Nuovo contatto</p>
                <div className={styles.formRow}>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Nome *"
                    value={newContact.name}
                    onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Cognome"
                    value={newContact.surname}
                    onChange={e => setNewContact(p => ({ ...p, surname: e.target.value }))}
                  />
                </div>
                <div className={styles.formRow}>
                  <select
                    className={styles.input}
                    value={newContact.relationship}
                    onChange={e => setNewContact(p => ({ ...p, relationship: e.target.value }))}
                  >
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input
                    className={styles.input}
                    type="tel"
                    placeholder="+39 333… *"
                    value={newContact.phone}
                    onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                {contactError && <p className={styles.fieldError}>{contactError}</p>}
                <div className={styles.formBtns}>
                  <button className={styles.btnAdd} type="submit">
                    Salva contatto
                  </button>
                  <button className={styles.btnCancel} type="button" onClick={() => { setShowAddForm(false); setContactError('') }}>
                    Annulla
                  </button>
                </div>
              </form>
            ) : (
              <button className={styles.btnAddNew} onClick={() => setShowAddForm(true)}>
                + Aggiungi contatto
              </button>
            )}
          </>
        )}
      </section>

      {/* ── Scorciatoia attivazione ── */}
      <section className={`${styles.section} page-enter page-enter--delay-2`}>
        <span className="section-label">03 — Scorciatoia attivazione</span>
        <p className={styles.sectionDesc}>
          Scegli come avviare SafeVoice in modo discreto.
        </p>
        <div className={styles.shortcutGrid}>
          {[
            { value: 'button', icon: '🔘', label: 'Bottone UI', desc: 'Premi il pulsante nella schermata SafeVoice.' },
            { value: 'double-tap', icon: '✌️', label: 'Doppio tap', desc: 'Tocca due volte lo schermo per avviare o fermare.' },
          ].map(opt => (
            <label
              key={opt.value}
              className={`${styles.shortcutCard} ${shortcut === opt.value ? styles.shortcutCardActive : ''}`}
            >
              <input
                type="radio"
                name="shortcut"
                value={opt.value}
                checked={shortcut === opt.value}
                onChange={() => handleShortcutChange(opt.value)}
                className={styles.shortcutRadio}
              />
              <span className={styles.shortcutIcon}>{opt.icon}</span>
              <div>
                <p className={styles.shortcutLabel}>{opt.label}</p>
                <p className={styles.shortcutDesc}>{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Anonimizzazione ── */}
      <section className={`${styles.section} page-enter page-enter--delay-3`}>
        <span className="section-label">04 — Metodo di anonimizzazione</span>
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
      <section className={`${styles.section} page-enter page-enter--delay-3`}>
        <span className="section-label">05 — Privacy e dati</span>
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
        <span className="section-label">06 — Informazioni</span>
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
            <span className={styles.metaItem}>ElevenLabs Scribe</span>
            <span className={styles.metaSep}>·</span>
            <span className={styles.metaItem}>Twilio</span>
          </div>
        </div>
      </section>

    </div>
  )
}
