const SEVERITY_LABELS = {
  1: { label: 'Comunicazione sana',  color: '#5B9A8B' },
  2: { label: 'Segnale lieve',       color: '#7DB8A8' },
  3: { label: 'Attenzione',          color: '#E8A838' },
  4: { label: 'Manipolazione',       color: '#E8634A' },
  5: { label: 'Pericolo',            color: '#C14433' },
}

export default function SeverityIndicator({ level, size = 48, showLabel = true }) {
  const meta = SEVERITY_LABELS[level] || SEVERITY_LABELS[1]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div
        className={`severity-circle severity-circle--${level}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={`Livello ${level}: ${meta.label}`}
      />
      {showLabel && (
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--fog)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '2px'
          }}>
            Livello {level}
          </div>
          <div style={{
            fontSize: '15px',
            fontWeight: 600,
            color: meta.color
          }}>
            {meta.label}
          </div>
        </div>
      )}
    </div>
  )
}
