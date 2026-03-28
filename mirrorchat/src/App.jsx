import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ChatAnalysis from './pages/ChatAnalysis'
import SafeVoice from './pages/SafeVoice'
import Learn from './pages/Learn'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Onboarding from './pages/Onboarding'

function RequireUser({ children }) {
  const user = localStorage.getItem('mirrorUser')
  if (!user) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/"
          element={
            <RequireUser>
              <Layout />
            </RequireUser>
          }
        >
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat"     element={<ChatAnalysis />} />
          <Route path="voice"    element={<SafeVoice />} />
          <Route path="learn"    element={<Learn />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
