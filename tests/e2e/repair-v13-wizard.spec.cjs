const { test, expect } = require('@playwright/test')
const { installSupabaseMock } = require('./mock-supabase.cjs')

// Real care wizard + sandbox V13 + mocked Supabase: only synthetic data.
test('PG24 repair V13 replaces legacy form, persists and isolates two care cases', async ({ page }) => {
  test.setTimeout(120000)
  await installSupabaseMock(page, { mode: 'signed-in' })
  await page.addInitScript(() => {
    if (localStorage.getItem('va:e2e:repair-v13-seeded')) return
    localStorage.setItem('va:e2e:repair-v13-seeded', '1')
    const records = ['ErsterFall','ZweiterFall'].map((name, i) => ({
      id: i === 0 ? '66666666-6666-4666-8666-666666666661' : '66666666-6666-4666-8666-666666666662',
      owner_user_id: '11111111-1111-4111-8111-111111111111',
      last_modified_by: '11111111-1111-4111-8111-111111111111',
      created_at: '2026-10-19T08:00:00.000Z',
      updated_at: '2026-10-19T08:00:00.000Z',
      wizard_index: 2,
      insurer: 'Privat',
      product_group: '24',
      himi_id: 'Unterschenkelprothese',
      himi: 'Unterschenkelprothese',
      status: 'Laufend',
      schema_version: 1,
      payload: {
        patientFirstName: 'Synthetisch', patientLastName: name,
        patientBirthDate: '1970-01-01',
        caseKind: 'Reparatur', supplyType: 'Reparatur', side: 'rechts',
        ampLevel: 'Unterschenkel', uexWizardSchema: '2026-10-17',
        rxPresent: 'Nein', assignedTechnician: 'Technik Test',
        repairSicHimiId: 'SIC-TEST-'+(i+1),
        repairDate: '2026-10-19'
      }
    }))
    localStorage.setItem('va:e2e:mock-care-cases',JSON.stringify(records))
  })

  const first = '[data-supply-id="66666666-6666-4666-8666-666666666661"]'
  const second = '[data-supply-id="66666666-6666-4666-8666-666666666662"]'
  await page.goto('/index.html')
  await expect(page.locator('#supplyOverviewBody '+first)).toBeVisible()
  await page.locator('#supplyOverviewBody '+first).click()
  await expect(page.locator('#careView')).toBeVisible()
  await expect(page.locator('#repairV13Mount')).toBeVisible()
  await expect(page.locator('#repairStepContent .repair-protocol')).toBeHidden()
  await expect(page.locator('#repairV13SecurePhotos')).toBeVisible()
  const frame = page.frameLocator('#repairV13Frame')
  await expect(frame.locator('#baseStatus')).toHaveText('verbunden')
  await expect(frame.locator('.stepbtn')).toHaveCount(6)
  await expect(page.locator('#repairV13SecurePhotos #repairPhotoFiles')).toHaveCount(1)
  await expect(page.locator('#repairV13SecurePhotos #repairLabelFiles')).toHaveCount(1)

  await frame.locator('.stepbtn').nth(3).click()
  await frame.getByRole('button', { name: '+ Passteil / Zubehör' }).click()
  await frame.locator('input[aria-label="Passteil 1"]').fill('Liner, Test')
  await frame.locator('input[aria-label="Hersteller-Artikelnummer 1"]').fill('TEST-ART-987')
  await frame.locator('.stepbtn').nth(5).click()
  await frame.locator('#vaRepairFinish').click()
  await expect.poll(() => page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('va:e2e:mock-care-cases') || '[]')
    return rows.find(r => r.id.endsWith('661'))?.payload?.repairUexV13?.state?.parts?.[0]?.article
  }),{timeout:15000}).toBe('TEST-ART-987')
  await expect.poll(() => page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('va:e2e:mock-care-cases') || '[]')
    return rows.find(r => r.id.endsWith('661'))?.payload?.repairUexV13?.completed
  })).toBe(true)
  await expect(frame.locator('#vaRepairFinish')).toContainText('abgeschlossen')

  // Both photos must be stored privately as metadata, not embedded into the care-case JSON.
  const jpeg = await page.evaluate(() => {
    const canvas=document.createElement('canvas')
    canvas.width=40;canvas.height=40
    const ctx=canvas.getContext('2d')
    ctx.fillStyle='#fff';ctx.fillRect(0,0,40,40)
    ctx.fillStyle='#000';ctx.fillRect(10,10,20,20)
    return canvas.toDataURL('image/jpeg',0.8).split(',')[1]
  })
  const photoBuffer=Buffer.from(jpeg,'base64')
  await page.locator('#repairPhotoFiles').setInputFiles({
    name:'prothese-test.jpg',mimeType:'image/jpeg',buffer:photoBuffer
  })
  await expect.poll(() => page.evaluate(() => {
    const r=JSON.parse(localStorage.getItem('va:e2e:mock-care-cases') || '[]')
    return r.find(x=>x.id.endsWith('661'))?.payload?.repairPhotos?.length || 0
  })).toBe(1)
  await page.locator('#repairLabelFiles').setInputFiles({
    name:'bauteiletikett-test.jpg',mimeType:'image/jpeg',buffer:photoBuffer
  })
  await expect.poll(() => page.evaluate(() => {
    const r=JSON.parse(localStorage.getItem('va:e2e:mock-care-cases') || '[]')
    return r.find(x=>x.id.endsWith('661'))?.payload?.repairLabelPhotos?.length || 0
  })).toBe(1)
  await expect.poll(() => page.evaluate(() => {
    const r=JSON.parse(localStorage.getItem('va:e2e:mock-care-cases') || '[]')
    const a=r.find(x=>x.id.endsWith('661'))?.payload
    if(!a || !a.repairPhotos?.[0]?.path || !a.repairLabelPhotos?.[0]?.path)return false
    return !JSON.stringify(a.repairUexV13||{}).includes('data:image')
  })).toBe(true)

  await page.reload()
  await page.locator('#supplyOverviewBody '+first).click()
  const reopened = page.frameLocator('#repairV13Frame')
  await expect(reopened.locator('#baseStatus')).toHaveText('verbunden')
  await reopened.locator('.stepbtn').nth(3).click()
  await expect(reopened.locator('input[aria-label="Hersteller-Artikelnummer 1"]')).toHaveValue('TEST-ART-987')
  await reopened.locator('.stepbtn').nth(5).click()
  await expect(reopened.locator('#vaRepairFinish')).toContainText('abgeschlossen')

  // Check original two pages and article labels in the printed overlay.
  await reopened.getByRole('button',{name:/Originalbogen als PDF speichern/}).click()
  await expect(reopened.locator('#printArea .printpage')).toHaveCount(3)
  await expect(reopened.locator('#printArea')).toContainText('TEST-ART-987')
  await expect(reopened.locator('#printArea img[alt="Bauteilkleber"]')).toHaveCount(1)
  await expect(reopened.locator('#printArea .annex img')).toHaveCount(1)

  await page.reload()
  await page.locator('#supplyOverviewBody '+second).click()
  const other = page.frameLocator('#repairV13Frame')
  await expect(other.locator('#baseStatus')).toHaveText('verbunden')
  await other.locator('.stepbtn').nth(3).click()
  await expect(other.locator('input[aria-label^="Hersteller-Artikelnummer"]')).toHaveCount(0)
  await expect(page.locator('#repairStepContent .repair-protocol')).toBeHidden()
})
