/* Local-only whisper.cpp WebAssembly worker for the Versorgungsassistent. */
let runtimePromise = null
let runtime = null
let modelReady = false

function send(type, payload = {}) {
  self.postMessage({ type, ...payload })
}

async function ensureRuntime() {
  if (runtimePromise) return runtimePromise
  runtimePromise = (async () => {
    if (!self.crossOriginIsolated) {
      throw new Error('Cross-Origin-Isolation ist für die lokale Spracherkennung noch nicht aktiv.')
    }

    send('status', { text: 'Lokale whisper.cpp-Laufzeit wird geladen …' })
    importScripts('./whisper.js')
    if (typeof self.whisper_factory !== 'function') {
      throw new Error('whisper.cpp WebAssembly konnte nicht initialisiert werden.')
    }

    runtime = await self.whisper_factory({
      print: () => {},
      printErr: (message) => console.warn('[whisper.cpp]', message),
      locateFile: (path) => new URL(path, self.location.href).href,
    })

    send('status', { text: 'Lokales deutsches Sprachmodell wird geladen …' })
    const response = await fetch('./ggml-tiny-q5_1.bin', { cache: 'force-cache' })
    if (!response.ok) {
      throw new Error('Lokales Whisper-Modell konnte nicht geladen werden (' + response.status + ').')
    }
    const modelBytes = new Uint8Array(await response.arrayBuffer())
    const modelPath = '/whisper-model.bin'

    try { runtime.FS_unlink(modelPath) } catch (_) {}
    runtime.FS_createDataFile('/', 'whisper-model.bin', modelBytes, true, false, false)
    modelReady = runtime.init(modelPath)
    if (!modelReady) {
      throw new Error('Lokales Whisper-Modell konnte nicht initialisiert werden.')
    }

    send('ready')
    return runtime
  })().catch((error) => {
    runtimePromise = null
    runtime = null
    modelReady = false
    throw error
  })
  return runtimePromise
}

self.addEventListener('message', async (event) => {
  const data = event.data || {}
  if (data.type === 'warmup') {
    try {
      await ensureRuntime()
    } catch (error) {
      send('error', { id: data.id || null, message: error?.message || String(error) })
    }
    return
  }

  if (data.type !== 'transcribe') return
  const id = data.id
  try {
    const module = await ensureRuntime()
    if (!modelReady) throw new Error('Whisper-Modell ist nicht bereit.')
    const audio = data.audio instanceof Float32Array ? data.audio : new Float32Array(data.audio)
    send('status', { id, text: 'KI-Transkription läuft vollständig lokal im Browser …' })
    const text = String(module.transcribe(audio, data.language || 'de', false) || '').trim()
    send('result', { id, text })
  } catch (error) {
    send('error', { id, message: error?.message || String(error) })
  }
})
