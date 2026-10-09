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

test('local speech recording is bounded and cleared on session teardown', async ({ page }) => {
  const source = await (await page.request.get('/app.js')).text()
  expect(source).toContain('const PROFILE_AI_MAX_RECORDING_MS=5*60*1000')
  expect(source).toContain('profileAiStream?.getTracks().forEach')
  expect(source).toContain('window.WhisperCppRuntime?.reset?.()')
})


test('AOK BW Annex 4 retains original PDF fields and bilateral source instruction', async ({page}) => {
  test.setTimeout(120000)
  await page.goto('/index.html')
  const source=await page.evaluate(async () => {
    const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',location.href).href
    const pdf=await pdfjs.getDocument('./assets/aok-pg24/anlage-4-profilerhebungsbogen.pdf').promise
    const page1=await pdf.getPage(1)
    const page4=await pdf.getPage(4)
    const [content,widgets]=await Promise.all([
      page1.getTextContent(),
      page4.getAnnotations({intent:'display'})
    ])
    const map=Object.fromEntries(widgets.filter(x=>x.subtype==='Widget').map(x=>[x.fieldName,x.rect]))
    const portal=Boolean(map['Textfeld 67'] && map['Textfeld 68'] && map['Textfeld 69'] && map['Textfeld 70'])
    return {
      pages:pdf.numPages,
      page1Text:(content.items||[]).map(x=>x.str||'').join(' ').replace(/\s+/g,' '),
      page4WidgetNames:Object.keys(map),
      variant:portal?'aok-portal':'provided-copy',
      insuredSignature:portal?map['Textfeld 67']:null,
      insuredDate:portal?map['Textfeld 68']:null,
      providerDate:portal?map['Textfeld 70']:map.Text67,
      providerSignature:portal?map['Textfeld 69']:map.Text69
    }
  })
  expect(source.pages).toBe(4)
  expect(source.page1Text).toMatch(/Bei doppelseitiger Amputation.*extra Formular.*zweite Seite/)
  expect(source.providerDate,'Actual names: '+source.page4WidgetNames.join(',')).toHaveLength(4)
  expect(source.providerSignature).toHaveLength(4)
  expect(source.providerDate[0]).toBeLessThan(source.providerSignature[0])
  expect(Math.abs(source.providerDate[1]-source.providerSignature[1])).toBeLessThan(2)
  if(source.variant==='aok-portal'){
    // The published AOK source has all four widgets on two separate rows.
    expect(source.insuredSignature).toHaveLength(4)
    expect(source.insuredDate).toHaveLength(4)
    expect(source.insuredDate[0]).toBeLessThan(source.insuredSignature[0])
    expect(Math.abs(source.insuredDate[1]-source.insuredSignature[1])).toBeLessThan(2)
    expect(source.insuredSignature[1]).toBeGreaterThan(source.providerSignature[1])
  }
})
