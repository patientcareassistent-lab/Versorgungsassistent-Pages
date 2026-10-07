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
  await expect(page.locator('#printButton')).toBeEnabled()
  await expect(page.locator('.wizard-step[data-step="1"]')).toBeEnabled()
})
