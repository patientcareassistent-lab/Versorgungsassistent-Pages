/* Browser adapter for local single-thread whisper.cpp WebAssembly. */
(() => {
  let worker = null
  let sequence = 0
  let statusHandler = null
  const pending = new Map()

  function emitStatus(text) {
    if (!text) return
    try { statusHandler?.(String(text)) } catch (_) {}
  }

  function ensureWorker() {
    if (worker) return worker

    worker = new Worker('./whispercpp/worker.js', {
      name: 'versorgungsassistent-whisper'
    })

    worker.addEventListener('message', event => {
      const msg = event.data || {}

      if (msg.type === 'status') {
        emitStatus(msg.text)
        return
      }

      if (msg.type !== 'ready' && msg.type !== 'result' && msg.type !== 'error') {
        return
      }

      const item = pending.get(msg.id)
      if (!item) return

      pending.delete(msg.id)

      if (msg.type === 'error') {
        item.reject(new Error(msg.message || 'Lokale Transkription fehlgeschlagen.'))
        return
      }

      item.resolve(msg.type === 'result' ? String(msg.text || '').trim() : true)
    })

    worker.addEventListener('error', event => {
      const error = new Error(event?.message || 'Lokale whisper.cpp-Laufzeit ist abgestürzt.')
      for (const item of pending.values()) item.reject(error)
      pending.clear()
      try { worker?.terminate() } catch (_) {}
      worker = null
    })

    return worker
  }

  function request(type, payload = {}, transfer = []) {
    return new Promise((resolve, reject) => {
      const id = 'whisper-' + (++sequence)
      pending.set(id, { resolve, reject })
      ensureWorker().postMessage({ type, id, ...payload }, transfer)
    })
  }

  window.WhisperCppRuntime = {
    setStatusHandler(handler) {
      statusHandler = typeof handler === 'function' ? handler : null
    },

    async warmup() {
      return request('warmup')
    },

    async transcribe(audio, language = 'de') {
      const pcm = audio instanceof Float32Array ? audio : new Float32Array(audio)
      return request(
        'transcribe',
        { audio: pcm, language },
        [pcm.buffer]
      )
    },

    reset() {
      for (const item of pending.values()) {
        item.reject(new Error('Lokale Spracherkennung wurde zurückgesetzt.'))
      }
      pending.clear()
      try { worker?.terminate() } catch (_) {}
      worker = null
    },
  }
})()
