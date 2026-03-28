/**
 * Richiede la posizione GPS del dispositivo.
 * Ritorna { latitude, longitude, accuracy } oppure lancia un errore.
 */
export function getGPS(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation non supportata da questo browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { timeout, enableHighAccuracy: false, maximumAge: 60000 }
    )
  })
}
