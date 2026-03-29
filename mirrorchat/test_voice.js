/**
 * Test script per /api/voice-realtime
 * Genera un file WAV (silenzio 1 secondo) → base64 → POST all'endpoint
 * e stampa il risultato in formato leggibile.
 */

const http = require('http');

// Genera PCM 16-bit little-endian a 44100Hz, canale mono, 1 secondo di silenzio
function generateSilentWav() {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate; // 1 secondo
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);          // chunk size
  buffer.writeUInt16LE(1, 20);           // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  // Silence (zeros) — already zeroed by Buffer.alloc

  return buffer;
}

async function runTest() {
  const wav = generateSilentWav();
  const base64Audio = wav.toString('base64');

  const body = JSON.stringify({
    audio: base64Audio,
    mimeType: 'audio/wav'
  });

  console.log('🎤 Test /api/voice-realtime con 1 secondo di silenzio (WAV 16kHz)...');
  console.log(`📦 Payload size: ${(body.length / 1024).toFixed(1)} KB`);

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/voice-realtime',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    },
    timeout: 30000
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n✅ HTTP Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log('📊 Risposta:');
          console.log(JSON.stringify(json, null, 2));

          // Valutazione risultato
          if (res.statusCode === 200) {
            if (json.transcript !== undefined) {
              console.log('\n✅ ENDPOINT OK - transcript presente');
            }
            if (typeof json.pericolo === 'number') {
              console.log(`✅ Pericolo: ${json.pericolo}/5`);
            }
          } else if (res.statusCode === 502) {
            console.log('\n❌ ERRORE 502 - STT fallito (entrambi i provider)');
          } else if (res.statusCode === 503) {
            console.log('\n⚠️  ELEVENLABS_API_KEY mancante');
          } else {
            console.log(`\nℹ️  Status ${res.statusCode}`);
          }
        } catch {
          console.log('Raw response:', data);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`❌ Errore di connessione: ${e.message}`);
      resolve();
    });

    req.on('timeout', () => {
      console.error('❌ Timeout dopo 30 secondi');
      req.destroy();
      resolve();
    });

    req.write(body);
    req.end();
  });
}

runTest();
