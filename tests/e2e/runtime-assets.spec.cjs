const { test, expect } = require('@playwright/test')
const { installSupabaseMock } = require('./mock-supabase.cjs')

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

test('PG24 AOK source original renders distinct insured/provider signatures and computed scores', async ({page})=>{
  test.setTimeout(120000)
  await installSupabaseMock(page,{mode:'signed-in',rpcOverrides:{
    care_reference_bootstrap:{
      kassen:[{Kasse_Kanonisch:'AOK Baden-Württemberg'}],
      produktgruppen:[{PG:'24',Generisches_Blatt:'Beinprothesen',Reifegrad:'PRODUKTIV'}],
      sourceCount:1,formCount:1
    },
    himi_logic_for_pg:[{
      Himi_ID:'PG24_UKB',PG:'24',Bezeichnung:'Unterschenkelprothese',
      Generisches_Formular_ID:'PG24',Profil_erforderlich:true,Mass_erforderlich:true,Aktiv:true
    }],
    forms_for_pg:[],himi_form_rules_for_himi:[],form_fields_for_pg:[]
  }})
  await page.goto('/index.html')
  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('#careKasse').selectOption({label:'AOK Baden-Württemberg'})
  await page.locator('#carePg').selectOption('24')
  await page.locator('#careHimi').selectOption('PG24_UKB')
  await page.locator('[data-case-field="patientFirstName"]').fill('Original')
  await page.locator('[data-case-field="patientLastName"]').fill('Test')
  await page.locator('[data-case-field="patientBirthDate"]').fill('1980-01-02')
  await page.locator('input[name="caseKindChoice"][value="Neuversorgung"]').check()
  await page.locator('#careSupplyType').selectOption('Definitiv')
  await page.locator('#careSide').selectOption('rechts')
  await page.locator('#wizardNext').click()
  await page.locator('#rxPresent').selectOption('Nein')
  await page.locator('#rxNeededText').fill('Unterschenkelprothese entsprechend Befund')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="2"]')).toBeVisible()
  await expect(page.locator('#aokProfilePdfPages .aok-pdf-page')).toHaveCount(4)
  await expect(page.locator('#aokProfilePdfPages [data-signature-role="insured"]')).toHaveCount(1)
  await expect(page.locator('#aokProfilePdfPages [data-signature-role="provider"]')).toHaveCount(1)
  // Official form uses 'Textfeld N', application must persist stable TextN IDs.
  await expect(page.locator('#aokProfilePdfPages [data-profile-key="aokProfilePdf:Text24"]')).toHaveCount(1)
  await expect(page.locator('#aokProfilePdfPages [data-profile-key="aokProfilePdf:Text25"]')).toHaveCount(1)
  await expect(page.locator('#aokProfilePdfPages [data-profile-key="aokProfilePdf:Text70"]')).toHaveCount(1)
  await expect(page.locator('#aokProfilePdfPages [data-profile-key="aokProfilePdf:Text67"]')).toHaveCount(0)
})


test('PG24 bilateral original forms keep independent right and left fields after save and reload', async ({page})=>{
  test.setTimeout(180000)
  await installSupabaseMock(page,{mode:'signed-in',rpcOverrides:{
    care_reference_bootstrap:{
      kassen:[{Kasse_Kanonisch:'AOK Baden-Württemberg'}],
      produktgruppen:[{PG:'24',Generisches_Blatt:'Beinprothesen',Reifegrad:'PRODUKTIV'}],
      sourceCount:1,formCount:1
    },
    himi_logic_for_pg:[{
      Himi_ID:'PG24_UKB',PG:'24',Bezeichnung:'Unterschenkelprothese',
      Generisches_Formular_ID:'PG24',Profil_erforderlich:true,Mass_erforderlich:true,Aktiv:true
    }],
    forms_for_pg:[],himi_form_rules_for_himi:[],form_fields_for_pg:[]
  }})
  await page.goto('/index.html')
  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('#careKasse').selectOption({label:'AOK Baden-Württemberg'})
  await page.locator('#carePg').selectOption('24')
  await page.locator('#careHimi').selectOption('PG24_UKB')
  await page.locator('[data-case-field="patientFirstName"]').fill('Bilateral')
  await page.locator('[data-case-field="patientLastName"]').fill('Originaltest')
  await page.locator('[data-case-field="patientBirthDate"]').fill('1980-01-02')
  await page.locator('input[name="caseKindChoice"][value="Neuversorgung"]').check()
  await page.locator('#careSupplyType').selectOption('Definitiv')
  await page.locator('#careSide').selectOption('beidseitig')
  await page.locator('#wizardNext').click()
  await page.locator('#rxPresent').selectOption('Nein')
  await page.locator('#rxNeededText').fill('Beidseitige Prothesenversorgung')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="2"]')).toBeVisible()
  const right=page.locator('[data-aok-pdf-side="rechts"]')
  const left=page.locator('[data-aok-pdf-side="links"]')
  await expect(right).toHaveAttribute('data-pdf-ready','true',{timeout:45000})
  await expect(left).toHaveAttribute('data-pdf-ready','true',{timeout:45000})
  await expect(page.locator('.aok-profile-original-document')).toHaveCount(2)
  await expect(page.locator('.aok-profile-original-document .aok-pdf-page')).toHaveCount(8)
  await expect(right.locator('[data-signature-role="insured"]')).toHaveCount(1)
  await expect(right.locator('[data-signature-role="provider"]')).toHaveCount(1)
  await expect(left.locator('[data-signature-role="insured"]')).toHaveCount(1)
  await expect(left.locator('[data-signature-role="provider"]')).toHaveCount(1)
  const rh=right.locator('[data-profile-key="aokProfilePdf:rechts:Text3"]')
  const lh=left.locator('[data-profile-key="aokProfilePdf:links:Text3"]')
  await rh.fill('1,74')
  await lh.fill('1,68')
  await expect(rh).toHaveValue('1,74')
  await expect(lh).toHaveValue('1,68')
  await right.locator('.aok-plusm-option[data-plusm-row="1"][data-plusm-score="5"]').check({force:true})
  await left.locator('.aok-plusm-option[data-plusm-row="1"][data-plusm-score="2"]').check({force:true})
  await expect.poll(async()=>page.evaluate(()=>{
    const rows=JSON.parse(localStorage.getItem('va:e2e:mock-care-cases')||'[]')
    const p=rows[0]?.payload||{}
    return [p['aokProfilePdf:rechts:Text3'],p['aokProfilePdf:links:Text3'],p['aokPlusM:rechts:1'],p['aokPlusM:links:1']].join('|')
  }),{timeout:20000}).toBe('1,74|1,68|5|2')
  await page.locator('#wizardNext').click()
  await expect(page.locator('#wizardError')).toContainText('PLUS-M mit 12 Antworten abschließen')
  await page.reload()
  await page.locator('#supplyOverviewBody [data-supply-id]').first().click()
  await expect(right).toHaveAttribute('data-pdf-ready','true',{timeout:45000})
  await expect(left).toHaveAttribute('data-pdf-ready','true',{timeout:45000})
  await expect(right.locator('[data-profile-key="aokProfilePdf:rechts:Text3"]')).toHaveValue('1,74')
  await expect(left.locator('[data-profile-key="aokProfilePdf:links:Text3"]')).toHaveValue('1,68')
  // A previous render must not append duplicate options into the restored
  // document while the latest generation is finishing the second side.
  await expect(right.locator('.aok-plusm-option[data-plusm-row="1"][data-plusm-score="5"]')).toHaveCount(1)
  await expect(left.locator('.aok-plusm-option[data-plusm-row="1"][data-plusm-score="2"]')).toHaveCount(1)
  await expect(right.locator('.aok-plusm-option[data-plusm-row="1"][data-plusm-score="5"]')).toBeChecked()
  await expect(left.locator('.aok-plusm-option[data-plusm-row="1"][data-plusm-score="2"]')).toBeChecked()
  await page.emulateMedia({media:'print'})
  await expect(page.locator('.aok-profile-original-document .aok-pdf-page')).toHaveCount(8)
})
