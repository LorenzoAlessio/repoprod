/**
 * MediaRecorder wrapper — cattura audio in chunk periodici.
 * Ogni chunk viene restituito come base64 via onChunk callback.
 * onLevel riceve un Uint8Array di dati frequenza (Web Audio API).
 */
export function createAudioRecorder({ onChunk, onError, onLevel, chunkInterval = 3000 }) {
  let stream = null
  let recorder = null
  let intervalId = null
  let audioCtx = null
  let analyser = null
  let levelRaf = null

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // ── Web Audio: analisi frequenze per visualizzatore mic ──
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const source = audioCtx.createMediaStreamSource(stream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.75
    source.connect(analyser)

    if (onLevel) {
      const freqData = new Uint8Array(analyser.frequencyBinCount)
      function tick() {
        analyser.getByteFrequencyData(freqData)
        onLevel(freqData)
        levelRaf = requestAnimationFrame(tick)
      }
      tick()
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

    recorder = new MediaRecorder(stream, { mimeType })

    recorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        try {
          const arrayBuffer = await event.data.arrayBuffer()
          const bytes = new Uint8Array(arrayBuffer)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          const base64 = btoa(binary)
          onChunk({ audio: base64, mimeType: event.data.type || mimeType })
        } catch (err) {
          onError && onError(err)
        }
      }
    }

    recorder.onerror = (event) => onError && onError(event.error)
    recorder.start()

    intervalId = setInterval(() => {
      if (recorder && recorder.state === 'recording') recorder.requestData()
    }, chunkInterval)
  }

  function stop() {
    if (levelRaf) { cancelAnimationFrame(levelRaf); levelRaf = null }
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null }
    if (intervalId) { clearInterval(intervalId); intervalId = null }
    if (recorder && recorder.state !== 'inactive') {
      recorder.requestData()
      recorder.stop()
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      stream = null
    }
    recorder = null
  }

  return { start, stop }
}
