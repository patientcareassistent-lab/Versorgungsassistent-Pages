const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

// Exercise the actual app functions without changing the production bundle.
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8')
const start = app.indexOf('    function setPaperSaveStatus(')
const end = app.indexOf('    function activeSupplyRecord(', start)
assert.ok(start >= 0 && end > start)
const source = app.slice(start, end)

function setup({ readOnly = false, save = async () => true, steps = [] } = {}) {
  const events = []
  const elements = Object.fromEntries(['paperSaveStatus', 'saveSupplyButton', 'printButton', 'paperChecklistSummary', 'paperChecklistItems'].map(id => [id, { textContent: '', disabled: false }]))
  elements.paperChecklistItems.children = []
  elements.paperChecklistItems.replaceChildren = () => { elements.paperChecklistItems.children = [] }
  elements.paperChecklistItems.appendChild = item => elements.paperChecklistItems.children.push(item)
  const context = vm.createContext({
    $: id => elements[id], activeSupplyId: 'case-1',
    activeSupplyIsReadOnly: () => readOnly,
    supplyHasEditableContext: () => !readOnly,
    persistActiveSupplyNow: async () => { events.push('save'); return save() },
    window: { print: () => events.push('print') },
    showError: () => events.push('error'),
    document: { createElement: () => ({ textContent: '' }) },
    wizardSteps: steps,
    stepApplicable: i => steps[i].applicable,
    validateStep: i => steps[i].result
  })
  vm.runInContext(source, context)
  return { context, elements, events }
}

test('print waits for confirmed persistence', async () => {
  let finish
  const s = setup({ save: () => new Promise(resolve => { finish = resolve }) })
  const pending = s.context.savePaperCase(true)
  assert.deepEqual(s.events, ['save'])
  assert.equal(s.elements.printButton.disabled, true)
  finish(true)
  await pending
  assert.deepEqual(s.events, ['save', 'print'])
  assert.equal(s.elements.printButton.disabled, false)
})

test('failed persistence prevents printing and allows retry', async () => {
  let success = false
  const s = setup({ save: async () => success })
  await s.context.savePaperCase(true)
  assert.deepEqual(s.events, ['save'])
  assert.match(s.elements.paperSaveStatus.textContent, /fehlgeschlagen/)
  assert.equal(s.elements.saveSupplyButton.disabled, false)
  success = true
  await s.context.savePaperCase(true)
  assert.deepEqual(s.events, ['save', 'save', 'print'])
})

test('exception prevents printing and restores controls', async () => {
  const s = setup({ save: async () => { throw new Error('offline') } })
  await s.context.savePaperCase(true)
  assert.deepEqual(s.events, ['save', 'error'])
  assert.equal(s.elements.saveSupplyButton.disabled, false)
})

test('foreign case prints without an attempted write', async () => {
  const s = setup({ readOnly: true })
  await s.context.savePaperCase(false)
  await s.context.savePaperCase(true)
  assert.deepEqual(s.events, ['print'])
})

test('repeated clicks do not create parallel saves or prints', async () => {
  let finish
  const s = setup({ save: () => new Promise(resolve => { finish = resolve }) })
  const first = s.context.savePaperCase(true)
  await s.context.savePaperCase(true)
  assert.deepEqual(s.events, ['save'])
  finish(true)
  await first
  assert.deepEqual(s.events, ['save', 'print'])
})

test('switching cases while saving does not print the newly opened case', async () => {
  let finish
  const s = setup({ save: () => new Promise(resolve => { finish = resolve }) })
  const pending = s.context.savePaperCase(true)
  s.context.activeSupplyId = 'case-2'
  finish(true)
  await pending
  assert.deepEqual(s.events, ['save'])
})

test('checklist includes only applicable missing fields as plain text', () => {
  const s = setup({ steps: [
    { name: 'Rezept', applicable: true, result: { ok: false, missing: ['<img src=x>', 'Verordnungstext'] } },
    { name: 'Maße', applicable: false, result: { ok: false, missing: ['Maßwert'] } },
    { name: 'Abgabe', applicable: true, result: { ok: true, missing: [] } }
  ] })
  s.context.renderPaperChecklist()
  assert.equal(s.elements.paperChecklistItems.children.length, 1)
  assert.equal(s.elements.paperChecklistItems.children[0].textContent, 'Rezept: <img src=x>, Verordnungstext')
  assert.match(s.elements.paperChecklistSummary.textContent, /1 Arbeitsschritte offen/)
})
