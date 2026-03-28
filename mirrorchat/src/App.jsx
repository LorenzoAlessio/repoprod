import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ChatAnalysis from './pages/ChatAnalysis'
import SafeVoice from './pages/SafeVoice'
import Learn from './pages/Learn'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat"     element={<ChatAnalysis />} />
          <Route path="voice"    element={<SafeVoice />} />
          <Route path="learn"    element={<Learn />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
