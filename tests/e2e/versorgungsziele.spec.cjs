const { test, expect } = require('@playwright/test')
const { installSupabaseMock } = require('./mock-supabase.cjs')

test('PG23 source-defined goal accepts suggestions and edited free text', async ({ page }) => {
  await installSupabaseMock(page, {mode:'signed-in', rpcOverrides:{
    care_reference_bootstrap:{kassen:[{Kasse_Kanonisch:'Testkasse'}],produktgruppen:[{PG:'23',Generisches_Blatt:'Orthesen',Reifegrad:'TEST'}],sourceCount:1,formCount:1},
    himi_logic_for_pg:[{Himi_ID:'PG23_UE',PG:'23',Bezeichnung:'Orthese untere Extremität',Generisches_Formular_ID:'PG23_Orthesen',Profil_erforderlich:true,Mass_erforderlich:false,Erprobung_erforderlich:false,Verlauf_erforderlich:false,Aktiv:true}],
    forms_for_pg:[],himi_form_rules_for_himi:[],
    form_fields_for_pg:[{Feldzeile_ID:'GEN_23_goal',Formular_ID:'PG23_Orthesen',PG:'23',Formular_Typ:'GENERISCH',Feldbezeichnung:'Versorgungsziel',Datentyp:'Langtext',Pflichtstatus:'ja'}]
  }})
  await page.goto('/index.html')
  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('#careKasse').selectOption({label:'Testkasse'})
  await page.locator('#carePg').selectOption('23')
  await page.locator('#careHimi').selectOption('PG23_UE')
  const goal=page.locator('#fieldList label').filter({hasText:'Versorgungsziel'})
  const picker=goal.locator('select[aria-label="Versorgungszielvorschlag"]')
  await expect(picker.locator('option')).not.toHaveCount(1)
  await picker.selectOption('23-11')
  await expect(goal.locator('textarea')).toContainText('Erhalt oder Verbesserung')
  await goal.locator('textarea').fill('Individuelles Ziel: selbständig zur Küche gehen')
  await expect(goal.locator('textarea')).toHaveValue('Individuelles Ziel: selbständig zur Küche gehen')
  await expect(page.locator('#versorgungGoalSuggestions')).toBeHidden()
})

test('PG24 Techniker therapy goal keeps the editable original input', async ({page}) => {
  await installSupabaseMock(page,{mode:'signed-in',rpcOverrides:{
    care_reference_bootstrap:{kassen:[{Kasse_Kanonisch:'Privat'}],produktgruppen:[{PG:'24',Generisches_Blatt:'Beinprothesen',Reifegrad:'TEST'}],sourceCount:1,formCount:1},
    himi_logic_for_pg:[{Himi_ID:'PG24_UKB',PG:'24',Bezeichnung:'Unterschenkelprothese',Generisches_Formular_ID:'PG24',Profil_erforderlich:true,Mass_erforderlich:false,Aktiv:true}]
  }})
  await page.goto('/index.html')
  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('#careKasse').selectOption({label:'Privat'})
  await page.locator('#carePg').selectOption('24')
  await page.locator('#careHimi').selectOption('PG24_UKB')
  const original=page.locator('[data-tech-key="tech:therapyGoal"]')
  await expect(original).toBeVisible()
  const picker=original.locator('xpath=..').locator('select[aria-label="Versorgungszielvorschlag"]')
  await picker.selectOption('24-02')
  await expect(original).toHaveValue(/Gangbild/)
  await original.fill('Individuelles Therapieziel')
  await expect(original).toHaveValue('Individuelles Therapieziel')
})
