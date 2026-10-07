const { test, expect } = require('@playwright/test')
const { installSupabaseMock } = require('./mock-supabase.cjs')

async function openSignedInApp(page) {
  await installSupabaseMock(page, { mode: 'signed-in' })
  await page.goto('/index.html')
  await expect(page.locator('#app')).toBeVisible()
  await expect(page.locator('#supplyOverviewView')).toBeVisible()
}

async function prepareNewSupply(page) {
  await page.locator('#newSupplyOverviewButton').click()
  await expect(page.locator('#careView')).toBeVisible()

  await page.locator('[data-case-field="patientFirstName"]').fill('Ada')
  await page.locator('[data-case-field="patientLastName"]').fill('Lovelace')
  await page.locator('#careKasse').selectOption({ label: 'Privat' })
  await page.locator('#carePg').selectOption('10')

  await expect.poll(async () => page.locator('#careHimi option').allTextContents())
    .toContain('Gehstock / Unterarmgehstütze')

  await page.locator('#careHimi').selectOption({ label: 'Gehstock / Unterarmgehstütze' })
  await page.locator('input[name="caseKindChoice"][value="Neuversorgung"]').check()
  await page.locator('#careSupplyType').selectOption({ label: 'Post-OP' })
}

test('wizard validation blocks incomplete orders', async ({ page }) => {
  await openSignedInApp(page)
  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('#wizardNext').click()

  await expect(page.locator('#wizardError')).toBeVisible()
  await expect(page.locator('#wizardError')).toContainText('Krankenkasse')
  await expect(page.locator('#wizardError')).toContainText('Produktgruppe')
  await expect(page.locator('.wizard-panel[data-panel="0"]')).toBeVisible()
})

test('autosave survives reload and restores a running supply', async ({ page }) => {
  await openSignedInApp(page)
  await prepareNewSupply(page)

  await expect.poll(async () => page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('va:e2e:mock-care-cases') || '[]').length
    } catch (_) {
      return 0
    }
  }), { timeout: 10000 }).toBe(1)

  await page.reload()
  await expect(page.locator('#supplyOverviewView')).toBeVisible()
  await expect(page.locator('#supplyOverviewBody')).toContainText('Ada')
  await expect(page.locator('#supplyOverviewBody')).toContainText('Lovelace')

  await page.locator('#supplyOverviewBody [data-supply-id]').first().click()
  await expect(page.locator('#careView')).toBeVisible()
  await expect(page.locator('[data-case-field="patientFirstName"]')).toHaveValue('Ada')
  await expect(page.locator('[data-case-field="patientLastName"]')).toHaveValue('Lovelace')
  await expect(page.locator('#careKasse')).toHaveValue('Privat')
  await expect(page.locator('#carePg')).toHaveValue('10')
  await expect(page.locator('#careHimi')).toHaveValue('Gehstock / Unterarmgehstütze')
  expect(await page.locator('[style]').count()).toBe(0)
})

test('oversized prescription files are rejected without leaving the browser flow', async ({ page }) => {
  await openSignedInApp(page)
  await prepareNewSupply(page)
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="1"]')).toBeVisible()

  await page.locator('#rxPresent').selectOption('Ja')
  await expect(page.locator('#rxYesPanel')).toBeVisible()

  const oversized = Buffer.alloc(15 * 1024 * 1024 + 1, 0)
  await page.locator('#rxFile').setInputFiles({
    name: 'zu-gross.png',
    mimeType: 'image/png',
    buffer: oversized
  })

  await expect(page.locator('#ocrStatus')).toContainText('größer als 15 MB')
  await expect(page.locator('#rxFileName')).toContainText('zu-gross.png')
})


test('team-visible foreign supplies open read-only instead of failing on save', async ({ page }) => {
  await openSignedInApp(page)

  await page.evaluate(() => {
    localStorage.setItem('va:e2e:mock-care-cases', JSON.stringify([{
      id: '22222222-2222-4222-8222-222222222222',
      owner_user_id: '22222222-2222-4222-8222-222222222222',
      created_at: '2026-10-07T10:00:00.000Z',
      updated_at: '2026-10-07T11:00:00.000Z',
      wizard_index: 0,
      insurer: 'Privat',
      product_group: '10',
      himi_id: 'Gehstock / Unterarmgehstütze',
      himi: 'Gehstock / Unterarmgehstütze',
      status: 'Laufend',
      schema_version: 1,
      payload: {
        patientFirstName: 'Team',
        patientLastName: 'Fall',
        caseKind: 'Neuversorgung',
        supplyType: 'Post-OP'
      }
    }]))
  })

  await page.reload()
  await expect(page.locator('#supplyOverviewBody')).toContainText('Team')
  await expect(page.locator('#supplyOverviewBody')).toContainText('Fall')

  await page.locator('#supplyOverviewBody [data-supply-id]').first().click()
  await expect(page.locator('#readOnlyBanner')).toBeVisible()
  await expect(page.locator('[data-case-field="patientFirstName"]')).toBeDisabled()
  await expect(page.locator('#careKasse')).toBeDisabled()
  await expect(page.locator('#clearButton')).toBeDisabled()
  await expect(page.locator('#archiveSupplyButton')).toBeDisabled()
  await expect(page.locator('#printButton')).toBeEnabled()
  await expect(page.locator('.wizard-step[data-step="1"]')).toBeEnabled()
  await page.locator('.wizard-step[data-step="1"]').click()
  await expect(page.locator('.wizard-panel[data-panel="1"]')).toBeVisible()
})


test('team overview paginates beyond 250 open supplies', async ({ page }) => {
  await installSupabaseMock(page, { mode: 'signed-in' })
  await page.addInitScript(() => {
    const rows = Array.from({ length: 275 }, (_, i) => ({
      id: '30000000-0000-4000-8000-' + String(i).padStart(12, '0'),
      owner_user_id: i % 2 === 0
        ? '11111111-1111-4111-8111-111111111111'
        : '22222222-2222-4222-8222-222222222222',
      created_at: '2026-10-07T10:00:00.000Z',
      updated_at: new Date(Date.UTC(2026, 9, 7, 10, 0, i % 60)).toISOString(),
      wizard_index: 0,
      insurer: 'Privat',
      product_group: '10',
      himi_id: 'Gehstock / Unterarmgehstütze',
      himi: 'Gehstock / Unterarmgehstütze',
      status: 'Laufend',
      schema_version: 1,
      payload: {
        patientFirstName: 'Fall',
        patientLastName: String(i).padStart(3, '0'),
        caseKind: 'Neuversorgung',
        supplyType: 'Post-OP'
      }
    }))
    localStorage.setItem('va:e2e:mock-care-cases', JSON.stringify(rows))
  })

  await page.goto('/index.html')
  await expect(page.locator('#supplyOverviewView')).toBeVisible()
  await expect(page.locator('#supplyOverviewBody [data-supply-id]')).toHaveCount(275)
})


test('oversized repair source images are rejected before browser decoding', async ({ page }) => {
  await openSignedInApp(page)
  await page.locator('#newSupplyOverviewButton').click()
  const oversized = Buffer.alloc(20 * 1024 * 1024 + 1, 0)
  await page.locator('#repairPhotoFiles').setInputFiles({
    name: 'zu-gross.jpg',
    mimeType: 'image/jpeg',
    buffer: oversized
  })
  await expect(page.locator('#wizardError')).toContainText('größer als 20 MB')
})


test('failed photo metadata save rolls back the uploaded private object', async ({ page }) => {
  await openSignedInApp(page)
  await prepareNewSupply(page)

  await expect.poll(async () => page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('va:e2e:mock-care-cases') || '[]').length
    } catch (_) {
      return 0
    }
  }), { timeout: 10000 }).toBe(1)

  await page.waitForTimeout(1500)
  await page.evaluate(() => localStorage.setItem('va:e2e:fail-next-care-upsert', '1'))

  const jpgBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 40
    canvas.height = 40
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 40, 40)
    ctx.fillStyle = '#000'
    ctx.fillRect(8, 8, 24, 24)
    return canvas.toDataURL('image/jpeg', .8).split(',')[1]
  })

  await page.locator('#repairPhotoFiles').setInputFiles({
    name: 'rollback-test.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(jpgBase64, 'base64')
  })

  await expect(page.locator('#wizardError')).toContainText('zurückgerollt')
  await expect.poll(async () => page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('va:e2e:mock-storage-paths') || '[]').length
    } catch (_) {
      return -1
    }
  })).toBe(0)

  const state = await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('va:e2e:mock-care-cases') || '[]')
    const removed = JSON.parse(localStorage.getItem('va:e2e:last-storage-remove') || '[]')
    return {
      repairPhotos: rows[0]?.payload?.repairPhotos || [],
      removed
    }
  })
  expect(state.repairPhotos).toEqual([])
  expect(state.removed.length).toBe(1)
})


test('failed photo-reference removal keeps the private object and case reference intact', async ({ page }) => {
  await installSupabaseMock(page, { mode: 'signed-in' })
  await page.addInitScript(() => {
    const path = '11111111-1111-4111-8111-111111111111/44444444-4444-4444-8444-444444444444/repair/photo-1.jpg'
    localStorage.setItem('va:e2e:mock-storage-paths', JSON.stringify([path]))
    localStorage.setItem('va:e2e:mock-care-cases', JSON.stringify([{
      id: '44444444-4444-4444-8444-444444444444',
      owner_user_id: '11111111-1111-4111-8111-111111111111',
      last_modified_by: '11111111-1111-4111-8111-111111111111',
      created_at: '2026-10-07T10:00:00.000Z',
      updated_at: '2026-10-07T11:00:00.000Z',
      wizard_index: 2,
      insurer: 'Privat',
      product_group: '10',
      himi_id: 'Gehstock / Unterarmgehstütze',
      himi: 'Gehstock / Unterarmgehstütze',
      status: 'Laufend',
      schema_version: 1,
      payload: {
        patientFirstName: 'Foto',
        patientLastName: 'Rollback',
        caseKind: 'Reparatur',
        supplyType: 'Reparatur',
        repairPhotos: [{
          id: 'photo-1',
          name: 'bestand.jpg',
          type: 'image/jpeg',
          size: 1234,
          width: 40,
          height: 40,
          path
        }]
      }
    }]))
  })

  await page.goto('/index.html')
  await page.locator('#supplyOverviewBody [data-supply-id]').first().click()
  await expect(page.locator('[data-repair-photo-remove]')).toHaveCount(1)

  await page.evaluate(() => localStorage.setItem('va:e2e:fail-next-care-upsert', '1'))
  await page.locator('[data-repair-photo-remove]').click()

  await expect(page.locator('#wizardError')).toContainText('bisherige Stand bleibt erhalten')
  const state = await page.evaluate(() => ({
    rows: JSON.parse(localStorage.getItem('va:e2e:mock-care-cases') || '[]'),
    storage: JSON.parse(localStorage.getItem('va:e2e:mock-storage-paths') || '[]'),
    removed: localStorage.getItem('va:e2e:last-storage-remove')
  }))
  expect(state.rows[0].payload.repairPhotos).toHaveLength(1)
  expect(state.storage).toHaveLength(1)
  expect(state.removed).toBeNull()
})


test('archive action stays disabled until every applicable step is complete', async ({ page }) => {
  await openSignedInApp(page)
  await prepareNewSupply(page)
  await expect(page.locator('#archiveSupplyButton')).toBeDisabled()
})

test('completed owner repair case becomes eligible for protected archiving', async ({ page }) => {
  await installSupabaseMock(page, { mode: 'signed-in' })
  await page.addInitScript(() => {
    localStorage.setItem('va:e2e:mock-care-cases', JSON.stringify([{
      id: '55555555-5555-4555-8555-555555555555',
      owner_user_id: '11111111-1111-4111-8111-111111111111',
      last_modified_by: '11111111-1111-4111-8111-111111111111',
      created_at: '2026-10-07T10:00:00.000Z',
      updated_at: '2026-10-07T11:00:00.000Z',
      wizard_index: 10,
      insurer: 'Privat',
      product_group: '10',
      himi_id: 'Gehstock / Unterarmgehstütze',
      himi: 'Gehstock / Unterarmgehstütze',
      status: 'Abschluss offen',
      schema_version: 1,
      payload: {
        patientFirstName: 'Archiv',
        patientLastName: 'Bereit',
        caseKind: 'Reparatur',
        supplyType: 'Reparatur',
        rxPresent: 'Nein',
        repairSicHimiId: 'SIC-1',
        repairDate: '2026-10-07',
        repairTechnician: 'E2E',
        repairPreperformed: 'Ja',
        repairComplaint: 'Test',
        repairWork: 'Test',
        repairFunctionTest: 'Ja',
        repairUsable: 'Ja',
        repairCompleted: 'Ja',
        quotePositions: 'Testposition',
        approvalState: 'Nicht genehmigungspflichtig',
        deliveryDate: '2026-10-07',
        deliveryUsable: true,
        deliveryInstruction: true,
        deliveryReceipt: true,
        billingState: 'Abgerechnet'
      }
    }]))
  })

  await page.goto('/index.html')
  await page.locator('#supplyOverviewBody [data-supply-id]').first().click()
  await expect(page.locator('#archiveSupplyButton')).toBeEnabled()
  await expect(page.locator('#archiveSupplyButton')).toHaveAttribute('title', /geschützt archivieren/i)
})
