const { test, expect } = require('@playwright/test')

function extractSupabaseConfig(source) {
  const urlMatch = source.match(/createClient\(\s*['"]([^'"]+\.supabase\.co)['"]/)
  const keyMatch = source.match(/(sb_publishable_[A-Za-z0-9_-]+)/)
  if (!urlMatch || !keyMatch) throw new Error('Supabase publishable configuration not found in app.js')
  return { url: urlMatch[1], key: keyMatch[1] }
}

test('anonymous browser access cannot read patient care cases', async ({ request }) => {
  const appResponse = await request.get('/app.js')
  expect(appResponse.ok()).toBeTruthy()
  const appSource = await appResponse.text()
  const { url, key } = extractSupabaseConfig(appSource)

  const response = await request.get(url + '/rest/v1/care_cases?select=id&limit=1', {
    headers: { apikey: key, Accept: 'application/json' }
  })

  if (response.status() === 200) {
    const data = await response.json()
    expect(Array.isArray(data)).toBeTruthy()
    expect(data).toEqual([])
  } else {
    expect([401, 403]).toContain(response.status())
  }
})

test('anonymous current_access never reports an approved session', async ({ request }) => {
  const appSource = await (await request.get('/app.js')).text()
  const { url, key } = extractSupabaseConfig(appSource)

  const response = await request.post(url + '/rest/v1/rpc/current_access', {
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    data: {}
  })

  if (response.status() === 200) {
    const payload = await response.json()
    const rows = Array.isArray(payload) ? payload : [payload]
    expect(rows.some(row => row && row.allowed === true)).toBe(false)
  } else {
    expect([401, 403]).toContain(response.status())
  }
})
