const { test, expect } = require('@playwright/test')
const { installSupabaseMock } = require('./mock-supabase.cjs')

async function preparePrescriptionStep(page) {
  await installSupabaseMock(page, { mode: 'signed-in' })
  await page.goto('/index.html')
  await expect(page.locator('#supplyOverviewView')).toBeVisible()

  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('[data-case-field="patientFirstName"]').fill('OCR')
  await page.locator('[data-case-field="patientLastName"]').fill('Test')
  await page.locator('#careKasse').selectOption({ label: 'Privat' })
  await page.locator('#carePg').selectOption('10')
  await expect.poll(async () => page.locator('#careHimi option').allTextContents())
    .toContain('Gehstock / Unterarmgehstütze')
  await page.locator('#careHimi').selectOption({ label: 'Gehstock / Unterarmgehstütze' })
  await page.locator('input[name="caseKindChoice"][value="Neuversorgung"]').check()
  await page.locator('#careSupplyType').selectOption({ label: 'Post-OP' })
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="1"]')).toBeVisible()
  await page.locator('#rxPresent').selectOption('Ja')
  await expect(page.locator('#rxYesPanel')).toBeVisible()
}

test('local Tesseract OCR recognizes a generated prescription image', async ({ page }) => {
  test.setTimeout(180000)
  await preparePrescriptionStep(page)

  const pngBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 420
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000'
    ctx.font = 'bold 72px Arial'
    ctx.fillText('VERORDNUNG PROTHESE', 60, 140)
    ctx.font = '56px Arial'
    ctx.fillText('TESTVERSORGUNG', 60, 280)
    return canvas.toDataURL('image/png').split(',')[1]
  })

  await page.locator('#rxFile').setInputFiles({
    name: 'rezept-regression.png',
    mimeType: 'image/png',
    buffer: Buffer.from(pngBase64, 'base64')
  })

  await expect(page.locator('#ocrStatus')).toContainText('OCR abgeschlossen', { timeout: 150000 })
  const raw = await page.locator('#rxOcrRaw').inputValue()
  expect(raw.trim().length).toBeGreaterThan(10)
  expect(raw.toUpperCase()).toContain('PROTHESE')
  expect(await page.locator('[style]').count()).toBe(0)
})
