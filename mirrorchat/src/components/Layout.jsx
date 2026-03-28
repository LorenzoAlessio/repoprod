import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import styles from './Layout.module.css'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()

  // Close sidebar and scroll top on route change
  useEffect(() => {
    setSidebarOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className={styles.shell}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={styles.body}>
        {/* Mobile header */}
        <header className={styles.mobileHeader}>
          <button
            className={`${styles.hamburger} ${sidebarOpen ? styles.hamburgerOpen : ''}`}
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Chiudi menu' : 'Apri menu'}
            aria-expanded={sidebarOpen}
          >
            <span />
            <span />
            <span />
          </button>
          <span className={styles.headerTitle}>MirrorChat</span>
          <div style={{ width: 40 }} />
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
