// Fail closed if the complete V13 repair module is not shipped in this PR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('PG24 Reparaturtool V13: release asset, data bridge and private sandbox', () => {
  const path = 'tools/reparatur-uex/index.html';
  assert.ok(existsSync(path), 'Reparaturtool V13 fehlt: tools/reparatur-uex/index.html hochladen');
  const html = readFileSync(path, 'utf8');
  assert.ok(html.length > 30000, 'Vollständiges V13-Modul einschließlich PDF-Vorlage erforderlich');
  assert.match(html, /VA_REPAIR_V13_PARENT/, 'Adapter zum Empfang des berechtigten Versorgungskontextes fehlt');
  assert.match(html, /VA_REPAIR_V13/, 'Adapter für den Rückkanal zur Vorgangsspeicherung fehlt');
  assert.match(html, /Hersteller-Artikelnummer/, 'Pflichtfeld im Reparaturtool fehlt');
  assert.match(html, /connect-src 'none'/, 'Die Sandbox darf keine ausgehenden API-Aufrufe erlauben');
  assert.match(html, /Reparaturdokumentation fertigstellen/, 'Abschlusskontrolle fehlt');
  const parent = readFileSync('index.html', 'utf8');
  assert.match(parent, /repairV13Frame/);
  assert.match(parent, /sandbox="allow-scripts allow-modals allow-downloads"/);
  assert.doesNotMatch(parent, /sandbox="[^"]*allow-same-origin/, 'Isolationsschutz muss erhalten bleiben');
  const app = readFileSync('app.js', 'utf8');
  assert.match(app, /isRepairCase\(\).*carePg/);
  assert.match(app, /values\.repairUexV13/);
  const workflow = readFileSync('.github/workflows/pages.yml', 'utf8');
  assert.match(workflow, /cp tools\/reparatur-uex\/index.html dist\/tools\/reparatur-uex\/index.html/);
});
