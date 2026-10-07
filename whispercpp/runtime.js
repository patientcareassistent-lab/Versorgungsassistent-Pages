/* Self-hosted whisper.cpp browser adapter. No audio leaves the browser. */
(() => {
  let runtimeResolve
  let runtimeReject
  const runtimeReady = new Promise((resolve, reject) => {
    runtimeResolve = resolve
    runtimeReject = reject
  })
  let modelPromise = null

  const moduleConfig = {
    print: () => {},
    printErr: (message) => console.warn('[whisper.cpp]', message),
    onRuntimeInitialized() {
      runtimeResolve(window.Module)
    },
    onAbort(reason) {
      runtimeReject(new Error('whisper.cpp WebAssembly wurde abgebrochen: ' + String(reason || 'unbekannt')))
    },
  }
  window.Module = moduleConfig

  async function ensureModel() {
    if (modelPromise) return modelPromise
    modelPromise = (async () => {
      if (!window.crossOriginIsolated) {
        throw new Error('Cross-Origin-Isolation ist für whisper.cpp noch nicht aktiv.')
      }
      const module = await runtimeReady
      const response = await fetch('./whispercpp/ggml-tiny-q5_1.bin', { cache: 'force-cache' })
      if (!response.ok) {
        throw new Error('Lokales Whisper-Modell konnte nicht geladen werden (' + response.status + ').')
      }
      const modelBytes = new Uint8Array(await response.arrayBuffer())
      const modelPath = '/whisper-model.bin'
      try { module.FS_unlink(modelPath) } catch (_) {}
      module.FS_createDataFile('/', 'whisper-model.bin', modelBytes, true, false, false)
      if (!module.init(modelPath)) {
        throw new Error('Lokales Whisper-Modell konnte nicht initialisiert werden.')
      }
      return module
    })().catch(error => {
      modelPromise = null
      throw error
    })
    return modelPromise
  }

  async function waitUntilIdle(module, timeoutMs = 180000) {
    const started = Date.now()
    while (module.is_running()) {
      if (Date.now() - started > timeoutMs) {
        throw new Error('Lokale whisper.cpp-Transkription hat das Zeitlimit überschritten.')
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  window.WhisperCppRuntime = {
    async warmup() {
      await ensureModel()
      return true
    },
    async transcribe(audio, language = 'de') {
      const module = await ensureModel()
      await waitUntilIdle(module)
      const rc = module.start_transcribe(audio, language, false)
      if (rc !== 0) {
        throw new Error('whisper.cpp konnte die Transkription nicht starten (Code ' + rc + ').')
      }
      await waitUntilIdle(module)
      return String(module.get_result() || '').trim()
    },
  }
})()
