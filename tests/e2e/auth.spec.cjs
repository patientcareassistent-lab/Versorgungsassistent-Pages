const { test, expect } = require('@playwright/test')
const { installSupabaseMock } = require('./mock-supabase.cjs')

async function openSignedInApp(page) {
  await installSupabaseMock(page, { mode: 'signed-in' })
  await page.goto('/index.html')
  await expect(page.locator('#app')).toBeVisible()
  await expect(page.locator('#supplyOverviewView')).toBeVisible()
}

test('login surface and strict CSP render without inline styles', async ({ page }) => {
  const cspErrors = []
  page.on('console', msg => {
    const text = msg.text()
    if (/content security policy|refused to (apply|execute|load)/i.test(text)) cspErrors.push(text)
  })

  await page.goto('/index.html')
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible()
  await expect(page.locator('#app')).toBeHidden()

  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'")
  expect(csp).toContain("style-src 'self'")
  expect(csp).toContain("style-src-attr 'none'")
  expect(csp).not.toContain("style-src 'self' 'unsafe-inline'")
  expect(await page.locator('[style]').count()).toBe(0)
  expect(cspErrors).toEqual([])
})

test('malformed usernames fail with a generic message', async ({ page }) => {
  await page.goto('/index.html')
  await page.locator('#username').fill('bad name')
  await page.locator('#password').fill('test')
  await page.locator('#loginButton').click()
  await expect(page.locator('#loginError')).toContainText('Anmeldung fehlgeschlagen')
  await expect(page.locator('#mfaPane')).toBeHidden()
})

test('password login remains gated by MFA before the app opens', async ({ page }) => {
  await installSupabaseMock(page, { mode: 'login' })
  await page.goto('/index.html')

  await page.locator('#username').fill('Mitarbeiter3')
  await page.locator('#password').fill('test')
  await page.locator('#loginButton').click()

  await expect(page.locator('#mfaPane')).toBeVisible()
  await expect(page.locator('#app')).toBeHidden()
  await expect(page.locator('#mfaText')).toContainText('Authenticator')

  await page.locator('#otp').fill('123')
  await page.locator('#verifyButton').click()
  await expect(page.locator('#mfaError')).toContainText('Authenticator-Code')
  await expect(page.locator('#app')).toBeHidden()

  await page.locator('#otp').fill('123456')
  await page.locator('#verifyButton').click()
  await expect(page.locator('#app')).toBeVisible()
  await expect(page.locator('#supplyOverviewView')).toBeVisible()
  await expect(page.locator('#currentUser')).toContainText('Mitarbeiter3')
  await expect(page.locator('#password')).toHaveValue('')
  await expect(page.locator('#otp')).toHaveValue('')
  await expect(page.locator('#secretDetails')).toBeHidden()
  await expect(page.locator('#qr')).not.toHaveAttribute('src', /.+/)
})


test('legacy persistent Supabase auth token is removed during startup', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sb-pypljdyqjpdkismbwuag-auth-token', 'legacy-token')
  })
  await page.goto('/index.html')
  expect(await page.evaluate(() => localStorage.getItem('sb-pypljdyqjpdkismbwuag-auth-token'))).toBeNull()
})

test('Supabase auth tokens are not persisted in localStorage or parsed from the URL', async ({ page }) => {
  const source = await (await page.request.get('/app.js')).text()
  expect(source).toContain('storage: window.sessionStorage')
  expect(source).toContain('detectSessionInUrl: false')
  expect(source).not.toContain('detectSessionInUrl: true')
})

test('document shell remains structurally complete after hardening', async ({ page }) => {
  await page.goto('/index.html')
  await expect(page.locator('#contractQuestionList')).toHaveCount(1)
  await expect(page.locator('#sourcesView')).toHaveCount(1)
  await expect(page.locator('script[src="./vendor/supabase.js"]')).toHaveCount(1)
  await expect(page.locator('script[type="module"][src="./app.js"]')).toHaveCount(1)
  await expect(page.locator('script:not([src])')).toHaveCount(0)
  expect(await page.locator('[style]').count()).toBe(0)
})
