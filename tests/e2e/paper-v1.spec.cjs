const { test, expect } = require('@playwright/test')
const { installSupabaseMock } = require('./mock-supabase.cjs')

async function openCase(page) {
  await installSupabaseMock(page, { mode: 'signed-in' })
  await page.addInitScript(() => { window.print = () => { window.__printed = true } })
  await page.goto('/index.html')
  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('[data-case-field="patientFirstName"]').fill('Papier')
  await page.locator('[data-case-field="patientLastName"]').fill('Test')
}

test('paper checklist explains missing fields and manual save survives reload', async ({ page }) => {
  await openCase(page)
  await page.locator('#paperChecklistSummary').click()
  await expect(page.locator('#paperChecklistItems')).toContainText('Krankenkasse / Kostenträger')
  await page.locator('#saveSupplyButton').click()
  await expect(page.locator('#paperSaveStatus')).toHaveText('Aktueller Stand gespeichert.')
  await page.reload()
  await expect(page.locator('#supplyOverviewBody')).toContainText('Papier')
  await expect(page.locator('#supplyOverviewBody')).toContainText('Test')
})

test('print saves the current draft before opening the print dialog', async ({ page }) => {
  await openCase(page)
  await page.locator('#printButton').click()
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true)
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('va:e2e:mock-care-cases')))
  expect(rows[0].payload.patientLastName).toBe('Test')
})

test('failed save blocks print and allows retry', async ({ page }) => {
  await openCase(page)
  await page.locator('#saveSupplyButton').click()
  await expect(page.locator('#paperSaveStatus')).toHaveText('Aktueller Stand gespeichert.')
  await page.evaluate(() => localStorage.setItem('va:e2e:fail-next-care-upsert', '1'))
  await page.locator('[data-case-field="patientLastName"]').fill('Geändert')
  await page.locator('#printButton').click()
  await expect(page.locator('#paperSaveStatus')).toContainText('Speichern fehlgeschlagen')
  expect(await page.evaluate(() => Boolean(window.__printed))).toBe(false)
  await page.locator('#printButton').click()
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true)
})
