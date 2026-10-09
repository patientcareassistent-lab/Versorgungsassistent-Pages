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
  await page.locator('[data-case-field="patientFirstName"]').fill('Goal')
  await page.locator('[data-case-field="patientLastName"]').fill('Test')
  await page.locator('[data-case-field="patientBirthDate"]').fill('1980-01-02')
  await page.locator('input[name="caseKindChoice"][value="Neuversorgung"]').check()
  await page.locator('#careSupplyType').selectOption('Post-OP')
  await page.locator('#careSide').selectOption('rechts')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="1"]')).toBeVisible()
  await page.locator('#rxPresent').selectOption('Nein')
  await page.locator('#rxNeededText').fill('Orthopädietechnische Versorgung entsprechend Befund')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="2"]')).toBeVisible()
  const goal=page.locator('#fieldList label').filter({hasText:'Versorgungsziel'})
  const picker=goal.locator('select[aria-label="Versorgungszielvorschlag"]')
  await expect(picker.locator('option')).not.toHaveCount(1)
  await picker.selectOption('23-11')
  await expect(goal.locator('textarea')).toHaveValue(/Erhalt oder Verbesserung/)
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
  await page.locator('[data-case-field="patientFirstName"]').fill('Goal')
  await page.locator('[data-case-field="patientLastName"]').fill('Test')
  await page.locator('[data-case-field="patientBirthDate"]').fill('1980-01-02')
  await page.locator('input[name="caseKindChoice"][value="Neuversorgung"]').check()
  await page.locator('#careSupplyType').selectOption('Post-OP')
  await page.locator('#careSide').selectOption('rechts')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="1"]')).toBeVisible()
  await page.locator('#rxPresent').selectOption('Nein')
  await page.locator('#rxNeededText').fill('Orthopädietechnische Versorgung entsprechend Befund')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="2"]')).toBeVisible()
  // Demographic prefill does not count as a completed PG24 assessment.
  await page.locator('#wizardNext').click()
  await expect(page.locator('#wizardError')).toContainText('Therapieziel / individuelles Versorgungsziel')
  const original=page.locator('[data-tech-key="tech:therapyGoal"]')
  await expect(original).toBeVisible()
  const picker=original.locator('xpath=..').locator('select[aria-label="Versorgungszielvorschlag"]')
  await picker.selectOption('24-02')
  await expect(original).toHaveValue(/Gangbild/)
  await original.fill('Individuelles Therapieziel')
  await expect(original).toHaveValue('Individuelles Therapieziel')
})


test('PG24 AOK BW displays the contract Annex 5b before internal UKB FMB', async ({page}) => {
  await installSupabaseMock(page,{mode:'signed-in',rpcOverrides:{
    care_reference_bootstrap:{
      kassen:[{Kasse_Kanonisch:'AOK Baden-Württemberg'},{Kasse_Kanonisch:'Privat'}],
      produktgruppen:[{PG:'24',Generisches_Blatt:'Beinprothesen',Reifegrad:'PRODUKTIV'}],sourceCount:1,formCount:1
    },
    himi_logic_for_pg:[{
      Himi_ID:'PG24_UKB',PG:'24',Bezeichnung:'Unterschenkelprothese',
      Generisches_Formular_ID:'PG24',Profil_erforderlich:true,Mass_erforderlich:true,
      Massprofil_ID:'',Erprobung_erforderlich:false,Verlauf_erforderlich:false,Aktiv:true
    }],
    forms_for_pg:[],himi_form_rules_for_himi:[],form_fields_for_pg:[]
  }})
  await page.goto('/index.html')
  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('#carePg').selectOption('24')
  await page.locator('#careHimi').selectOption('PG24_UKB')
  await page.locator('input[name="caseKindChoice"][value="Neuversorgung"]').check()
  await page.locator('#careSupplyType').selectOption('Definitiv')
  await page.locator('#careKasse').selectOption({label:'AOK Baden-Württemberg'})
  await expect(page.locator('#measureLogicNote')).toContainText('Anlage 5b')
  await expect(page.locator('#measureFieldList .aok-measure-frame-wrap')).toHaveCount(1)
  await expect(page.locator('#sourceMeasureBody')).toHaveCount(0)
  await page.locator('#careKasse').selectOption({label:'Privat'})
  await expect(page.locator('#measureLogicNote')).toContainText('Maßblatt Unterschenkelprothetik')
  await expect(page.locator('#sourceMeasureBody')).toHaveCount(1)
})


test('AOK BW PG23 visibly distinguishes generic preassessment from contract original', async ({page}) => {
  await installSupabaseMock(page,{mode:'signed-in',rpcOverrides:{
    care_reference_bootstrap:{
      kassen:[{Kasse_Kanonisch:'AOK Baden-Württemberg'}],
      produktgruppen:[{PG:'23',Generisches_Blatt:'Orthesen',Reifegrad:'PRODUKTIV'}],
      sourceCount:1,formCount:1
    },
    himi_logic_for_pg:[{
      Himi_ID:'PG23_UE',PG:'23',Bezeichnung:'individuelle Orthese – untere Extremität',
      Generisches_Formular_ID:'PG23_Orthesen',Profil_erforderlich:true,
      Mass_erforderlich:false,Erprobung_erforderlich:false,Verlauf_erforderlich:false,Aktiv:true
    }],
    forms_for_pg:[{
      Formular_ID:'FORM_022',Kasse:'AOK Baden-Württemberg',PG:'23',Status:'VERTRAGSFORMULAR',
      Versorgungsart:'individuelle Orthesen',Aktion_Versorgungsassistent:'AOK BW Vertragsbogen prüfen'
    }],
    himi_form_rules_for_himi:[{
      Himi_ID:'PG23_UE',Kasse:'AOK Baden-Württemberg',
      Formular_ID:'FORM_022',Formularbezeichnung:'AOK BW PG23',Status:'VERTRAGSFORMULAR',
      Sortierung:1
    }],
    form_fields_for_pg:[{
      Feldzeile_ID:'GEN_23_goal',Formular_ID:'PG23_Orthesen',PG:'23',
      Formular_Typ:'GENERISCH',Feldbezeichnung:'Versorgungsziel',
      Datentyp:'Langtext',Pflichtstatus:'ja'
    }]
  }})
  await page.goto('/index.html')
  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('#careKasse').selectOption({label:'AOK Baden-Württemberg'})
  await page.locator('#carePg').selectOption('23')
  await page.locator('#careHimi').selectOption('PG23_UE')
  await expect(page.locator('#careForm')).toHaveValue('FORM_022')
  await expect(page.locator('#ruleBox')).toContainText('Vertragsfassung vor der Abgabe prüfen')
  await expect(page.locator('#ruleBox')).toContainText('Verordnungsdatum')
  await expect(page.locator('#ruleBox')).toContainText('Digitale Voraufnahme')
})

test('AOK BW PG24 warns when bilateral amputation requires a second original profile', async ({page}) => {
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
  await page.locator('#carePg').selectOption('24')
  await page.locator('#careHimi').selectOption('PG24_UKB')
  await page.locator('#careSide').selectOption('beidseitig')
  await page.locator('#careKasse').selectOption({label:'AOK Baden-Württemberg'})
  await expect(page.locator('#profileHint')).toContainText('zweite Seite')
  await expect(page.locator('#profileHint')).toContainText('separater Original-Profilerhebungsbogen')
  await expect(page.locator('#profileHint')).toContainText('nicht automatisch')
  await page.locator('[data-case-field="patientFirstName"]').fill('Doppel')
  await page.locator('[data-case-field="patientLastName"]').fill('Test')
  await page.locator('[data-case-field="patientBirthDate"]').fill('1985-04-05')
  await page.locator('input[name="caseKindChoice"][value="Neuversorgung"]').check()
  await page.locator('#careSupplyType').selectOption('Definitiv')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="1"]')).toBeVisible()
  await page.locator('#rxPresent').selectOption('Nein')
  await page.locator('#rxNeededText').fill('Beidseitige prothetische Versorgung')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="2"]')).toBeVisible()
  await page.locator('#wizardNext').click()
  await expect(page.locator('#wizardError')).toContainText('Original-Profilerhebungsbogen für die zweite Seite fehlt')
})
