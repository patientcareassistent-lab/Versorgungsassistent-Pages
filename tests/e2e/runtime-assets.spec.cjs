const { test, expect } = require('@playwright/test')

test('PDF.js renders a pinned AOK source form entirely same-origin', async ({ page }) => {
  test.setTimeout(120000)
  const remote = []
  page.on('request', request => {
    const url = request.url()
    if (/esm\.sh|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com/i.test(url)) remote.push(url)
  })

  await page.goto('/index.html')
  const result = await page.evaluate(async () => {
    const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', location.href).href
    const pdf = await pdfjs.getDocument('./assets/aok-pg24/anlage-5b-ukb.pdf').promise
    const first = await pdf.getPage(1)
    const viewport = first.getViewport({ scale: 0.25 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await first.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    return { pages: pdf.numPages, width: canvas.width, height: canvas.height }
  })

  expect(result.pages).toBeGreaterThan(0)
  expect(result.width).toBeGreaterThan(50)
  expect(result.height).toBeGreaterThan(50)
  expect(remote).toEqual([])
})

test('single-thread whisper.cpp WASM transcribes entirely same-origin in a dedicated worker', async ({ page }) => {
  test.setTimeout(180000)
  const remoteRuntimeRequests = []

  page.on('request', request => {
    if (/huggingface\.co|\.hf\.co|esm\.sh|cdn\.jsdelivr\.net|unpkg\.com/i.test(request.url())) {
      remoteRuntimeRequests.push(request.url())
    }
  })

  await page.goto('/index.html')

  const assetState = await page.evaluate(async () => {
    const [runtime, model, worker] = await Promise.all([
      fetch('./whispercpp/whisper.js'),
      fetch('./whispercpp/ggml-tiny-q5_1.bin'),
      fetch('./whispercpp/worker.js'),
    ])

    return {
      runtimeOk: runtime.ok,
      modelOk: model.ok,
      modelBytes: Number(model.headers.get('content-length') || 0),
      workerOk: worker.ok,
      isolated: window.crossOriginIsolated,
      adapter: Boolean(window.WhisperCppRuntime),
    }
  })

  expect(assetState.runtimeOk).toBe(true)
  expect(assetState.modelOk).toBe(true)
  expect(assetState.workerOk).toBe(true)
  expect(assetState.adapter).toBe(true)
  expect(assetState.modelBytes).toBeGreaterThan(25000000)

  const result = await page.evaluate(async () => {
    await window.WhisperCppRuntime.warmup()
    const text = await window.WhisperCppRuntime.transcribe(new Float32Array(16000), 'de')
    return {
      text,
      isolated: window.crossOriginIsolated,
    }
  })

  expect(typeof result.text).toBe('string')
  expect(remoteRuntimeRequests).toEqual([])
})
