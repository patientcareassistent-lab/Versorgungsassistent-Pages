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
