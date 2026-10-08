const { test, expect } = require('@playwright/test')
const { installSupabaseMock } = require('./mock-supabase.cjs')

test('production UI only offers PG23 and PG24 without deleting reference data', async ({ page }) => {
  await installSupabaseMock(page, {
    mode: 'signed-in',
    rpcOverrides: {
      care_reference_bootstrap: {
        kassen: [{ Kasse_Kanonisch: 'Testkasse' }],
        produktgruppen: [
          { PG: '18', Generisches_Blatt: 'Rollstuhl', Reifegrad: 'TEST' },
          { PG: '23', Generisches_Blatt: 'Orthesen', Reifegrad: 'TEST' },
          { PG: '24', Generisches_Blatt: 'Prothesen', Reifegrad: 'TEST' },
          { PG: '26', Generisches_Blatt: 'Sitzschalen', Reifegrad: 'TEST' },
          { PG: '31', Generisches_Blatt: 'DFS', Reifegrad: 'TEST' },
          { PG: '38', Generisches_Blatt: 'Armprothesen', Reifegrad: 'TEST' }
        ],
        sourceCount: 1, formCount: 1
      }
    }
  })
  await page.goto('/index.html')
  await expect(page.locator('#app')).toBeVisible()
  await expect(page.locator('[data-view="pg26"]')).toHaveCount(0)

  await page.locator('#newSupplyOverviewButton').click()
  await expect(page.locator('#carePg option')).toHaveCount(3)
  await expect(page.locator('#carePg option[value="23"]')).toHaveCount(1)
  await expect(page.locator('#carePg option[value="24"]')).toHaveCount(1)
  for (const pg of ['18','26','31','38']) {
    await expect(page.locator('#carePg option[value="' + pg + '"]')).toHaveCount(0)
  }
})
