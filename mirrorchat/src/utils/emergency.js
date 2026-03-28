import { getGPS } from './location.js'

export function shouldTriggerAlert(readings) {
  if (!readings || readings.length === 0) return false
  const now = Date.now()
  const recent = readings.filter(r => now - r.timestamp < 30000)
  if (recent.length === 0) return false
  const max = Math.max(...recent.map(r => r.pericolo))
  const highCount = recent.filter(r => r.pericolo >= 4).length
  return max === 5 || highCount >= 2
}

export async function triggerEmergency(user, dangerContext) {
  const contacts = JSON.parse(localStorage.getItem('mirrorContacts') || '[]')

  let coords = null
  try {
    coords = await getGPS(8000)
  } catch (_) {}

  const results = await Promise.allSettled([
    fetch('/api/emergency/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: user.name,
        contacts,
        lat: coords?.latitude ?? null,
        lon: coords?.longitude ?? null,
        dangerContext,
      }),
    }),
    fetch('/api/emergency/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: user.name, contacts, dangerContext }),
    }),
  ])

  return {
    sms: results[0].status === 'fulfilled',
    call: results[1].status === 'fulfilled',
    coords,
  }
}
