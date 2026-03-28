import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

const NAV_ITEMS = [
  { to: '/chat',      icon: '💬', label: 'Analisi Chat' },
  { to: '/voice',     icon: '🎤', label: 'SafeVoice' },
  { to: '/learn',     icon: '📚', label: 'Impara' },
  { to: '/settings',  icon: '⚙️', label: 'Impostazioni' },
]

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Overlay (mobile) */}
      {open && (
        <div
          className={styles.overlay}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoText}>Mirror</span>
          <span className={styles.logoAccent}>Chat</span>
        </div>

        {/* Nav */}
        <nav className={styles.nav} aria-label="Navigazione principale">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              onClick={onClose}
            >
              <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <span className={styles.footerText}>MirrorChat v2</span>
        </div>
      </aside>
    </>
  )
}
