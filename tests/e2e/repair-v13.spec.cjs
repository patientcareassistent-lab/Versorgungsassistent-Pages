const {test, expect} = require('@playwright/test');

// Synthetic-only integration test: no production health data or external APIs.
test('PG24 V13 sandbox: context, article requirement, HMV click and completion', async ({page}) => {
  const external=[];
  page.on('request',request=>{
    const url=request.url();
    if(/^https?:/.test(url) && !/^http:\/\/127\.0\.0\.1:4173\//.test(url))external.push(url);
  });
  const parent=[
    '<!doctype html><html lang="de"><head><meta charset="utf-8"></head><body>',
    '<iframe id="repairV13Frame" title="Test Reparaturtool" sandbox="allow-scripts allow-modals allow-downloads"',
    ' style="width:1200px;height:1200px;border:0" src="/tools/reparatur-uex/index.html"></iframe>',
    '<script>',
    'window.repairEvents=[];',
    'const frame=document.getElementById("repairV13Frame");',
    'window.addEventListener("message",e=>{',
    '  if(e.source!==frame.contentWindow||e.origin!=="null"||e.data?.type!=="VA_REPAIR_V13")return;',
    '  window.repairEvents.push(e.data);',
    '  if(e.data.action==="loaded"){',
    '    frame.contentWindow.postMessage({type:"VA_REPAIR_V13_PARENT",action:"context",token:"synthetic-test-token",',
    '      context:{patient:{vorname:"Test",nachname:"Person"},',
    '        versorgung:{hilfsmittelIdSic:"SIC-TEST-123",seite:"rechts",laenge:"UKB"},',
    '        kostentraeger:"AOK BW",mitarbeiter:"Testfachkraft",',
    '        reparaturdatum:"19.10.2026",rezepterfassung:{rezeptFolgt:false}},',
    '      state:{},completed:false,readOnly:false',
    '    },"*");',
    '  }',
    '});',
    '</script></body></html>'
  ].join('\n');
  await page.route('**/repair-v13-synthetic-parent',route=>route.fulfill({
    status:200,contentType:'text/html; charset=utf-8',body:parent
  }));
  await page.goto('/repair-v13-synthetic-parent');
  const mod=page.frameLocator('#repairV13Frame');
  await expect(mod.locator('#baseStatus')).toHaveText('verbunden');
  await expect.poll(()=>page.evaluate(()=>window.repairEvents.some(e=>e.action==='ready'))).toBe(true);
  await mod.locator('.stepbtn').nth(1).click();
  await expect(mod.locator('#sicCount')).toHaveText('2768');
  await mod.locator('.stepbtn').nth(3).click();
  await mod.getByRole('button',{name:'+ Passteil / Zubehör'}).click();
  await mod.locator('input[aria-label="Passteil 1"]').fill('Silikon-Liner');
  await mod.locator('.stepbtn').nth(5).click();
  await expect(mod.locator('#stepTitle')).toHaveText('Passteile');
  await expect(mod.locator('input[aria-label="Hersteller-Artikelnummer 1"]')).toHaveAttribute('aria-invalid','true');
  await mod.getByRole('button',{name:/Positionshilfe \(optional\)/}).click();
  await mod.getByRole('button',{name:/24\.79\.04\.0/}).first().click();
  await expect(mod.locator('input[aria-label="Optionale Hilfsmittelposition 1"]')).toHaveValue('24.79.04.0');
  await mod.locator('input[aria-label="Hersteller-Artikelnummer 1"]').fill('ART-TEST-001');
  await mod.locator('.stepbtn').nth(5).click();
  await mod.locator('#vaRepairFinish').click();
  await expect.poll(()=>page.evaluate(()=>
    window.repairEvents.some(e=>e.action==='change'&&e.completed===true
      &&e.state?.parts?.[0]?.article==='ART-TEST-001'
      &&e.state?.parts?.[0]?.hmv==='24.79.04.0')
  )).toBe(true);
  await expect(mod.locator('#vaRepairFinish')).toContainText('abgeschlossen');
  await mod.locator('.stepbtn').nth(3).click();
  await mod.locator('input[aria-label="Hersteller-Artikelnummer 1"]').fill('ART-TEST-002');
  await expect.poll(()=>page.evaluate(()=>
    window.repairEvents.some(e=>e.action==='change'&&e.completed===false
      &&e.state?.parts?.[0]?.article==='ART-TEST-002')
  )).toBe(true);
  expect(external).toEqual([]);
});
