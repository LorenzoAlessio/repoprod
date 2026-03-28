import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Onboarding.module.css'

const RELATIONSHIPS = ['Genitore', 'Amico/a', 'Fidanzato/a', 'Fratello/Sorella', 'Parente', 'Altro']

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1=profilo, 2=contatti

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const [contacts, setContacts] = useState([])
  const [newContact, setNewContact] = useState({ name: '', surname: '', relationship: 'Genitore', phone: '' })

  const [error, setError] = useState('')

  // ── Step 1: salva profilo su Supabase + localStorage ────────
  async function saveProfile(e) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !phone.trim()) return setError('Nome e numero di telefono sono obbligatori.')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore registrazione')
      localStorage.setItem('mirrorUser', JSON.stringify(data.user))
      setStep(2)
    } catch (err) {
      setError('Errore salvataggio: ' + err.message)
    }
  }

  // ── Step 2: aggiungi contatto ──────────────────────────────
  function addContact(e) {
    e.preventDefault()
    setError('')
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      return setError('Nome e telefono del contatto sono obbligatori.')
    }
    setContacts(prev => [...prev, { ...newContact }])
    setNewContact({ name: '', surname: '', relationship: 'Genitore', phone: '' })
  }

  function removeContact(i) {
    setContacts(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Step 2: salva contatti su Supabase + localStorage ───────
  async function finish() {
    if (contacts.length === 0) return setError('Aggiungi almeno un contatto di emergenza.')
    setError('')
    const user = JSON.parse(localStorage.getItem('mirrorUser') || '{}')
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, contacts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore salvataggio contatti')
      localStorage.setItem('mirrorContacts', JSON.stringify(contacts))
      navigate('/voice')
    } catch (err) {
      setError('Errore salvataggio contatti: ' + err.message)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.logo}>
        <span className={styles.logoText}>Mirror</span>
        <span className={styles.logoAccent}>Chat</span>
      </div>

      <div className={styles.progress}>
        {[1, 2].map(s => (
          <div key={s} className={`${styles.progressDot} ${step >= s ? styles.progressDotActive : ''}`} />
        ))}
      </div>

      {/* ── Step 1: Profilo ── */}
      {step === 1 && (
        <form className={styles.card} onSubmit={saveProfile}>
          <h1 className={styles.cardTitle}>Benvenuta in MirrorChat</h1>
          <p className={styles.cardDesc}>
            Inserisci il tuo nome e numero di telefono per attivare la protezione in tempo reale.
          </p>
          <label className={styles.label}>Il tuo nome</label>
          <input
            className={styles.input}
            type="text"
            placeholder="Come ti chiami?"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="given-name"
            required
          />
          <label className={styles.label}>Numero di telefono</label>
          <input
            className={styles.input}
            type="tel"
            placeholder="+39 333 123 4567"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btn} type="submit">Continua</button>
        </form>
      )}

      {/* ── Step 2: Contatti ── */}
      {step === 2 && (
        <div className={styles.card}>
          <h1 className={styles.cardTitle}>Contatti di emergenza</h1>
          <p className={styles.cardDesc}>
            Se MirrorChat rileva un pericolo, chiamerà questi contatti in ordine di priorità.
          </p>

          {contacts.length > 0 && (
            <ul className={styles.contactList}>
              {contacts.map((c, i) => (
                <li key={i} className={styles.contactItem}>
                  <div className={styles.contactInfo}>
                    <span className={styles.contactPriority}>{i + 1}</span>
                    <div>
                      <strong>{c.name} {c.surname}</strong>
                      <span className={styles.contactMeta}>{c.relationship} · {c.phone}</span>
                    </div>
                  </div>
                  <button className={styles.btnRemove} onClick={() => removeContact(i)} aria-label="Rimuovi">✕</button>
                </li>
              ))}
            </ul>
          )}

          <form className={styles.addForm} onSubmit={addContact}>
            <p className={styles.addFormTitle}>Aggiungi contatto</p>
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
            <button className={styles.btnSecondary} type="submit">+ Aggiungi</button>
          </form>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.btn}
            onClick={finish}
            disabled={contacts.length === 0}
          >
            Inizia a usare MirrorChat
          </button>

          <button className={styles.btnGhost} onClick={() => { setStep(1); setError('') }}>
            ← Modifica profilo
          </button>
        </div>
      )}

      <p className={styles.footer}>
        I tuoi dati sono salvati solo sul tuo dispositivo.
      </p>
    </div>
  )
}
