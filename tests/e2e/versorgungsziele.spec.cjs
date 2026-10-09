const { test, expect } = require('@playwright/test')
const { installSupabaseMock } = require('./mock-supabase.cjs')

test('PG23 goal suggestions are offered only in post-measure planning', async ({ page }) => {
  await installSupabaseMock(page,{mode:'signed-in',rpcOverrides:{
    care_reference_bootstrap:{kassen:[{Kasse_Kanonisch:'Testkasse'}],produktgruppen:[{PG:'23',Generisches_Blatt:'Orthesen',Reifegrad:'TEST'}],sourceCount:1,formCount:1},
    himi_logic_for_pg:[{Himi_ID:'PG23_UE',PG:'23',Bezeichnung:'Orthese untere Extremität',Generisches_Formular_ID:'PG23_Orthesen',Profil_erforderlich:true,Mass_erforderlich:false,Aktiv:true}],
    forms_for_pg:[],himi_form_rules_for_himi:[],
    form_fields_for_pg:[
      {Feldzeile_ID:'GEN_23_goal',Formular_ID:'PG23_Orthesen',PG:'23',Formular_Typ:'GENERISCH',Feldbezeichnung:'Versorgungsziel',Datentyp:'Langtext',Pflichtstatus:'ja'},
      {Feldzeile_ID:'GEN_23_name',Formular_ID:'PG23_Orthesen',PG:'23',Formular_Typ:'GENERISCH',Feldbezeichnung:'Name',Datentyp:'Text',Pflichtstatus:'ja'}
    ]
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
  await page.locator('#rxPresent').selectOption('Nein')
  await page.locator('#rxNeededText').fill('Orthopädietechnische Versorgung entsprechend Befund')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="2"]')).toBeVisible()
  await expect(page.locator('#fieldList')).not.toContainText('Versorgungsziel')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="4"]')).toBeVisible()
  const picker=page.locator('#versorgungGoalSuggestions select[aria-label="Versorgungszielvorschlag"]')
  await expect(picker.locator('option')).not.toHaveCount(1)
  await picker.selectOption('23-11')
  const goal=page.locator('[data-case-field="planGoal"]')
  await expect(goal).toHaveValue(/Erhalt oder Verbesserung/)
  await goal.fill('Individuelles Ziel nach der Messung')
  await expect(goal).toHaveValue('Individuelles Ziel nach der Messung')
})

test('PG24 technician therapy goal is edited only after the measure step', async ({page}) => {
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
  await page.locator('#rxPresent').selectOption('Nein')
  await page.locator('#rxNeededText').fill('Orthopädietechnische Versorgung entsprechend Befund')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="2"]')).toBeVisible()
  await expect(page.locator('[data-tech-key="tech:therapyGoal"]')).toHaveCount(0)
  await expect(page.locator('#fieldList')).toContainText('nach der Maßaufnahme')
  await page.locator('#wizardNext').click()
  await expect(page.locator('.wizard-panel[data-panel="4"]')).toBeVisible()
  await expect(page.locator('#versorgungGoalSuggestions')).toBeVisible()
  const picker=page.locator('#versorgungGoalSuggestions select[aria-label="Versorgungszielvorschlag"]')
  await picker.selectOption('24-02')
  await expect(page.locator('[data-case-field="planGoal"]')).toHaveValue(/Gangbild/)
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
  await expect(page.locator('#profileHint')).toContainText('zwei separate, vierseitige Originalbögen')
  await expect(page.locator('[data-aok-profile-side="rechts"]')).toHaveCount(1)
  await expect(page.locator('[data-aok-profile-side="links"]')).toHaveCount(1)
  // During PR validation the official PDF is not bundled. No incomplete
  // side may bypass the loading/completeness guard.
  await page.locator('#wizardNext').click()
  await expect(page.locator('#wizardError')).toContainText('AOK-Anlage 4 (rechts)')
  await expect(page.locator('.wizard-panel[data-panel="2"]')).toBeVisible()
})


test('PG24 technician measure IDs only accept explicitly confirmed transcript values', async ({page})=>{
  await installSupabaseMock(page,{mode:'signed-in',rpcOverrides:{
    care_reference_bootstrap:{
      kassen:[{Kasse_Kanonisch:'Privat'}],
      produktgruppen:[{PG:'24',Generisches_Blatt:'Beinprothesen',Reifegrad:'PRODUKTIV'}],
      sourceCount:1,formCount:1
    },
    himi_logic_for_pg:[{
      Himi_ID:'PG24_UKB',PG:'24',Bezeichnung:'Unterschenkelprothese',
      Generisches_Formular_ID:'PG24',Mass_erforderlich:true,Profil_erforderlich:true,Aktiv:true
    }],
    forms_for_pg:[],himi_form_rules_for_himi:[],form_fields_for_pg:[]
  }})
  await page.goto('/index.html')
  await page.locator('#newSupplyOverviewButton').click()
  await page.locator('#careKasse').selectOption({label:'Privat'})
  await page.locator('#carePg').selectOption('24')
  await page.locator('#careHimi').selectOption('PG24_UKB')
  const input=page.locator('#measureFieldList [data-measure-value="true"][data-measure-field-id]').first()
  await expect(input).toHaveCount(1)
  const id=await input.getAttribute('data-measure-field-id')
  expect(id).toMatch(/^FMB02003-/)
  const result=await page.evaluate(id=>{
    const input=document.querySelector('[data-measure-field-id="'+id+'"]')
    const txt=document.querySelector('#measureTranscript')
    txt.value=id+': 31'
    document.querySelector('#measureTranscriptAnalyze').click()
    const before=input.value
    const proposals=document.querySelectorAll('#measureTranscriptSuggestions [data-measure-proposal]').length
    document.querySelector('#measureTranscriptApply').click()
    const after=input.value
    txt.value='NICHT-VORHANDEN-P9-F99: 44'
    document.querySelector('#measureTranscriptAnalyze').click()
    const rejected=document.querySelector('#measureTranscriptSuggestions').textContent
    return {before,proposals,after,rejected}
  },id)
  expect(result.before).not.toBe('31')
  expect(result.proposals).toBe(1)
  expect(result.after).toBe('31')
  expect(result.rejected).toContain('nicht gefunden')
})
