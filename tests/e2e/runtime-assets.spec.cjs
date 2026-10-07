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

test('Whisper runtime and q8 model load and execute without Hugging Face runtime access', async ({ page }) => {
  test.setTimeout(180000)
  const remoteModelRequests = []
  page.on('request', request => {
    if (/huggingface\.co|\.hf\.co/i.test(request.url())) remoteModelRequests.push(request.url())
  })

  await page.goto('/index.html')
  const result = await page.evaluate(async () => {
    const mod = await import('./vendor/transformers/transformers.min.js')
    mod.env.useBrowserCache = false
    mod.env.allowRemoteModels = false
    mod.env.allowLocalModels = true
    mod.env.localModelPath = new URL('./models/', location.href).href
    if (mod.env.backends?.onnx?.wasm) {
      mod.env.backends.onnx.wasm.wasmPaths = new URL('./vendor/transformers/', location.href).href
    }
    const asr = await mod.pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
      device: 'wasm',
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }
    })
    const output = await asr(new Float32Array(16000))
    if (typeof asr.dispose === 'function') await asr.dispose()
    return {
      textType: typeof output?.text,
      remoteModelsAllowed: mod.env.allowRemoteModels,
      localModelPath: mod.env.localModelPath
    }
  })

  expect(result.textType).toBe('string')
  expect(result.remoteModelsAllowed).toBe(false)
  expect(result.localModelPath).toContain('/models/')
  expect(remoteModelRequests).toEqual([])
})
