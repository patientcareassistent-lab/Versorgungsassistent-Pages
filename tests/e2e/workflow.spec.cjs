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
  await page.locator('[data-case-field="patientBirthDate"]').fill('1980-01-02')
  await page.locator('.wizard-panel[data-panel="0"] [data-case-field="insuredNo"]').fill('TEST')
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


test('version 0.9 keeps archiving but hides billing and calculation from the user interface', async ({ page }) => {
  await openSignedInApp(page)

  await expect(page.locator('#archiveSupplyButton')).toBeVisible()
  await expect(page.locator('#archiveSupplyButton')).toBeDisabled()
  await expect(page.locator('.wizard-step[data-step="10"]')).toBeHidden()
  await expect(page.locator('.wizard-panel[data-panel="10"]')).toBeHidden()
  await expect(page.locator('[data-case-field="quoteCalc"]')).toHaveCount(0)

  await page.locator('[data-view="pg26"]').click()
  await expect(page.locator('#pg26View')).toBeVisible()
  await expect(page.getByText('Kalkulationsbausteine')).toBeHidden()
  await expect(page.getByRole('columnheader', { name: 'Preis netto' })).toHaveCount(0)
})


test('paper-form datatypes render as usable digital controls', async ({ page }) => {
  await installSupabaseMock(page, {
    mode: 'signed-in',
    rpcOverrides: {
      care_reference_bootstrap: {
        kassen: [{ Kasse_Kanonisch: 'BARMER' }],
        produktgruppen: [{ PG: '22', Generisches_Blatt: 'BARMER Test', Reifegrad: 'TEST' }],
        sourceCount: 1,
        formCount: 1
      },
      himi_logic_for_pg: [{
        Himi_ID: 'PG22_TEST',
        PG: '22',
        Bezeichnung: 'Patientenlifter',
        Generisches_Formular_ID: 'BARMER_PG22_ANHB',
        Versorgungsarten: ['Erstversorgung'],
        Profil_erforderlich: true,
        Mass_erforderlich: false,
        Erprobung_erforderlich: false,
        Verlauf_erforderlich: false,
        Aktiv: true
      }],
      forms_for_pg: [{
        Formular_ID: 'BARMER_PG22_ANHB',
        Kasse: 'BARMER',
        PG: '22',
        Versorgungsart: 'Patientenlifter',
        Status: 'Test',
        Aktion_Versorgungsassistent: 'Digital erfassen'
      }],
      himi_form_rules_for_himi: [{
        Himi_ID: 'PG22_TEST',
        Kasse: 'BARMER',
        Formular_ID: 'BARMER_PG22_ANHB',
        Formularbezeichnung: 'BARMER Test',
        Status: 'Test',
        Sortierung: 1
      }],
      form_fields_for_pg: [
        { Feldzeile_ID: 'sig', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'Unterschrift Leistungserbringer', Datentyp: 'Unterschrift', Pflichtstatus: 'nicht einzeln ausgewiesen' },
        { Feldzeile_ID: 'multi', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'Hilfsmitteloptionen', Datentyp: 'Mehrfachauswahl', Pflichtstatus: 'ja', Bedingung_UI: 'Option A | Option B' },
        { Feldzeile_ID: 'confirm', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'Bestätigung', Datentyp: 'Bestätigung', Pflichtstatus: 'ja' },
        { Feldzeile_ID: 'yntext', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'Ja/Nein mit Bemerkung', Datentyp: 'Ja/Nein + Bemerkung', Pflichtstatus: 'ja' },
        { Feldzeile_ID: 'hint', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'Nur Hinweis', Datentyp: 'Hinweis', Pflichtstatus: 'bedingt', Bedingung_UI: 'Nur bei besonderer Konstellation' },
        { Feldzeile_ID: 'patient_name', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'Name / Vorname', Datentyp: 'Text', Pflichtstatus: 'ja' },
        { Feldzeile_ID: 'patient_dob', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'Geburtsdatum', Datentyp: 'Datum', Pflichtstatus: 'ja' },
        { Feldzeile_ID: 'patient_insured', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'Versichertennummer', Datentyp: 'Text', Pflichtstatus: 'ja' },
        { Feldzeile_ID: 'patient_kv', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'KV-Nummer', Datentyp: 'Text', Pflichtstatus: 'nein' },
        { Feldzeile_ID: 'free_selection', Formular_ID: 'BARMER_PG22_ANHB', PG: '22', Feldbezeichnung: 'Freie Auswahl ohne Vorgaben', Datentyp: 'Auswahl', Pflichtstatus: 'nein' }
      ]
    }
  })

  await page.goto('/index.html')
  await page.locator('#newSupplyButton').click()
  await page.locator('[data-case-field="patientFirstName"]').fill('Anna')
  await page.locator('[data-case-field="patientLastName"]').fill('Muster')
  await page.locator('[data-case-field="patientBirthDate"]').fill('1980-01-02')
  await page.locator('.wizard-panel[data-panel="0"] [data-case-field="insuredNo"]').fill('TEST')
  await page.locator('#careKasse').selectOption({ label: 'BARMER' })
  await page.locator('#carePg').selectOption('22')
  await expect(page.locator('#careHimi')).toContainText('Patientenlifter')
  await page.locator('#careHimi').selectOption('PG22_TEST')
  await expect(page.locator('#careForm')).toContainText('BARMER Test')

  await expect(page.locator('#fieldList canvas[aria-label="Unterschrift Leistungserbringer"]')).toHaveCount(1)
  await expect(page.locator('#fieldList [data-profile-group-key="multi"] input[type="checkbox"]')).toHaveCount(2)
  await expect(page.locator('#fieldList input[type="checkbox"][data-required="true"]')).toHaveCount(1)
  await expect(page.locator('#fieldList select[data-required="true"]')).toHaveCount(1)
  await expect(page.getByText('Nur bei besonderer Konstellation')).toBeVisible()
  await expect(page.locator('#fieldList label').filter({ hasText: 'Name / Vorname' }).locator('input')).toHaveValue('Muster, Anna')
  await expect(page.locator('#fieldList label').filter({ hasText: 'Geburtsdatum' }).locator('input')).toHaveValue('1980-01-02')
  await expect(page.locator('#fieldList label').filter({ hasText: 'Versichertennummer' }).locator('input')).toHaveValue('TEST')
  await expect(page.locator('#fieldList label').filter({ hasText: 'KV-Nummer' }).locator('input')).toHaveValue('TEST')
  await expect(page.locator('#fieldList label').filter({ hasText: 'Freie Auswahl ohne Vorgaben' }).locator('input')).toHaveCount(1)
})


test('source-backed conditional anamnesis fields become required only when their trigger applies', async ({ page }) => {
  await installSupabaseMock(page, {
    mode: 'signed-in',
    rpcOverrides: {
      care_reference_bootstrap: {
        kassen: [{ Kasse_Kanonisch: 'Testkasse' }],
        produktgruppen: [{ PG: '23', Generisches_Blatt: 'Orthesen', Reifegrad: 'TEST' }],
        sourceCount: 1,
        formCount: 1
      },
      himi_logic_for_pg: [{
        Himi_ID: 'PG23_UE',
        PG: '23',
        Bezeichnung: 'individuelle Orthese – untere Extremität',
        Generisches_Formular_ID: 'PG23_Orthesen',
        Versorgungsarten: ['Erstversorgung'],
        Profil_erforderlich: true,
        Mass_erforderlich: false,
        Erprobung_erforderlich: false,
        Verlauf_erforderlich: false,
        Aktiv: true
      }],
      forms_for_pg: [],
      himi_form_rules_for_himi: [],
      form_fields_for_pg: [
        { Feldzeile_ID: 'GEN_23_region_24', Formular_ID: 'PG23_Orthesen', PG: '23', Feldbezeichnung: 'Anwendungsregion', Datentyp: 'Auswahl', Pflichtstatus: 'ja', Bedingung_UI: 'untere Extremität | obere Extremität | Rumpf/Wirbelsäule' },
        { Feldzeile_ID: 'GEN_23_rom_lower_25', Formular_ID: 'PG23_Orthesen', PG: '23', Feldbezeichnung: 'Gelenkbeweglichkeit Neutral-Null unten', Datentyp: 'Messreihe', Pflichtstatus: 'bedingt', Bedingung_UI: 'nur untere Extremität' },
        { Feldzeile_ID: 'GEN_23_rom_upper_34', Formular_ID: 'PG23_Orthesen', PG: '23', Feldbezeichnung: 'Gelenkbeweglichkeit Neutral-Null oben', Datentyp: 'Messreihe', Pflichtstatus: 'bedingt', Bedingung_UI: 'nur obere Extremität' },
        { Feldzeile_ID: 'GEN_23_cobb_angle_33', Formular_ID: 'PG23_Orthesen', PG: '23', Feldbezeichnung: 'Cobb-Winkel', Datentyp: 'Text', Pflichtstatus: 'bedingt', Bedingung_UI: 'nur Rumpf/Wirbelsäule' }
      ]
    }
  })

  await page.goto('/index.html')
  await page.locator('#newSupplyButton').click()
  await page.locator('#careKasse').selectOption({ label: 'Testkasse' })
  await page.locator('#carePg').selectOption('23')
  await page.locator('#careHimi').selectOption('PG23_UE')

  const region = page.locator('#fieldList label').filter({ hasText: 'Anwendungsregion' }).locator('select')
  await expect(region).toBeVisible()
  await expect(page.getByText('Gelenkbeweglichkeit Neutral-Null unten')).toHaveCount(0)
  await expect(page.getByText('Gelenkbeweglichkeit Neutral-Null oben')).toHaveCount(0)
  await expect(page.getByText('Cobb-Winkel')).toHaveCount(0)

  await region.selectOption({ label: 'untere Extremität' })
  await expect(page.getByText('Gelenkbeweglichkeit Neutral-Null unten')).toBeVisible()
  const lowerRom=page.locator('#fieldList').getByText('Gelenkbeweglichkeit Neutral-Null unten').locator('xpath=..').locator('textarea[data-required="true"]')
  await expect(lowerRom).toHaveCount(1)
  await lowerRom.fill('10/0/10')
  await expect(page.getByText('Gelenkbeweglichkeit Neutral-Null oben')).toHaveCount(0)

  await page.locator('#fieldList label').filter({ hasText: 'Anwendungsregion' }).locator('select').selectOption({ label: 'Rumpf/Wirbelsäule' })
  await expect(page.getByText('Cobb-Winkel')).toBeVisible()
  await expect(page.getByText('Gelenkbeweglichkeit Neutral-Null unten')).toHaveCount(0)
  await expect.poll(async () => page.evaluate(() => {
    const rows=JSON.parse(localStorage.getItem('va:e2e:mock-care-cases')||'[]')
    return Object.prototype.hasOwnProperty.call(rows[0]?.payload||{},'GEN_23_rom_lower_25')
  }), { timeout: 10000 }).toBe(false)
})


test('multi-PG contract forms remain discoverable for a selected product group', async ({ page }) => {
  await installSupabaseMock(page, {
    mode: 'signed-in',
    rpcOverrides: {
      care_reference_bootstrap: {
        kassen: [{ Kasse_Kanonisch: 'DAK-Gesundheit' }],
        produktgruppen: [{ PG: '18', Generisches_Blatt: 'PG18_Rollstuhl', Reifegrad: 'TEST' }],
        sourceCount: 1,
        formCount: 1
      },
      himi_logic_for_pg: [{
        Himi_ID: 'PG18_E',
        PG: '18',
        Bezeichnung: 'E-Rollstuhl',
        Generisches_Formular_ID: 'PG18_Rollstuhl',
        Versorgungsarten: ['Erstversorgung'],
        Profil_erforderlich: true,
        Mass_erforderlich: false,
        Erprobung_erforderlich: true,
        Verlauf_erforderlich: false,
        Aktiv: true
      }],
      forms_for_pg: [{
        Formular_ID: 'FORM_MULTI',
        Kasse: 'DAK-Gesundheit',
        PG: '11/18/23/24/26/31',
        Versorgungsart: 'mehrere Reha-/OT-Bereiche',
        Status: 'VERTRAG_PRUEFEN',
        Aktion_Versorgungsassistent: 'Vertrag prüfen'
      }],
      himi_form_rules_for_himi: [],
      form_fields_for_pg: [{
        Feldzeile_ID: 'GEN_18_goal',
        Formular_ID: 'PG18_Rollstuhl',
        PG: '18',
        Formular_Typ: 'GENERISCH',
        Feldbezeichnung: 'Versorgungsziel',
        Datentyp: 'Langtext',
        Pflichtstatus: 'ja'
      }]
    }
  })

  await page.goto('/index.html')
  await page.locator('#newSupplyButton').click()
  await page.locator('#careKasse').selectOption({ label: 'DAK-Gesundheit' })
  await page.locator('#carePg').selectOption('18')
  await page.locator('#careHimi').selectOption('PG18_E')

  await expect(page.locator('#careForm')).toContainText('mehrere Reha-/OT-Bereiche')
  await page.locator('#careForm').selectOption('FORM_MULTI')
  await expect(page.locator('#ruleBox')).toContainText('Voraufnahme')
  await expect(page.locator('#fieldInfo')).toContainText('allgemeine Voraufnahme')
  await expect.poll(async () => page.evaluate(() => {
    const rows=JSON.parse(localStorage.getItem('va:e2e:mock-care-cases')||'[]')
    return rows[0]?.payload?.formId||''
  }), { timeout: 10000 }).toBe('FORM_MULTI')
})


test('single mandatory payer form is auto-selected even without structured Himi rules', async ({ page }) => {
  await installSupabaseMock(page, {
    mode: 'signed-in',
    rpcOverrides: {
      care_reference_bootstrap: {
        kassen: [{ Kasse_Kanonisch: 'AOK Hessen' }],
        produktgruppen: [{ PG: '04', Generisches_Blatt: 'PG04_Bad_Dusche', Reifegrad: 'TEST' }],
        sourceCount: 1,
        formCount: 1
      },
      himi_logic_for_pg: [],
      forms_for_pg: [{
        Formular_ID: 'FORM_005',
        Kasse: 'AOK Hessen',
        PG: '04',
        Versorgungsart: 'Bade- und Duschhilfen',
        Status: 'EXPLIZIT_PFLICHT',
        Aktion_Versorgungsassistent: 'AOK-Hessen-Bogen erzwingen.'
      }],
      himi_form_rules_for_himi: [],
      form_fields_for_pg: [{
        Feldzeile_ID: 'GEN_04_goal',
        Formular_ID: 'PG04_Bad_Dusche',
        Formular_Typ: 'GENERISCH',
        PG: '04',
        Feldbezeichnung: 'Versorgungsziel',
        Datentyp: 'Langtext',
        Pflichtstatus: 'ja'
      }]
    }
  })

  await page.goto('/index.html')
  await page.locator('#newSupplyButton').click()
  await page.locator('#careKasse').selectOption({ label: 'AOK Hessen' })
  await page.locator('#carePg').selectOption('04')
  await expect(page.locator('#careHimi')).toContainText('Badehilfe')
  await page.locator('#careHimi').selectOption({ label: 'Badehilfe' })

  await expect(page.locator('#careForm')).toHaveValue('FORM_005')
  await expect(page.locator('#ruleBox')).toContainText('EXPLIZIT_PFLICHT')
  await expect(page.locator('#ruleBox')).toContainText('Voraufnahme')
  await expect(page.locator('#fieldList')).toContainText('Versorgungsziel')
})
