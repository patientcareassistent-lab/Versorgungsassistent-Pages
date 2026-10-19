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
  const runtimeErrors = []
  page.on('pageerror', err => runtimeErrors.push(String(err.message || err)))
  page.on('console', msg => {if(msg.type()==='error')runtimeErrors.push(msg.text())})
  page.on('console', msg => {
    const text = msg.text()
    if (/content security policy|refused to (apply|execute|load)/i.test(text)) cspErrors.push(text)
  })

  await page.goto('/index.html')
  await page.waitForTimeout(1000)
  const snapshot=await page.evaluate(()=>({
    authClass:document.getElementById('auth')?.className,
    shellClass:document.getElementById('app')?.className,
    loaderClass:document.getElementById('loading')?.className,
    title:document.title,
    visibleText:(document.body?.innerText||'').slice(0,500),
    state:document.readyState
  }))
  console.log('AUTH-DIAGNOSTIC',JSON.stringify({snapshot,runtimeErrors}))
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

test('focused navigation shows work views and keeps project information available', async ({ page }) => {
  await openSignedInApp(page)

  const sidebar = page.locator('.sidebar')
  await expect(sidebar.locator('nav button')).toHaveCount(3)
  await expect(sidebar.locator('#newSupplyNavButton')).toBeVisible()
  await expect(sidebar.locator('[data-view="supplyOverview"]')).toBeVisible()
  await expect(sidebar.locator('[data-view="archive"]')).toBeVisible()
  await expect(sidebar).not.toContainText('Wissensbasis')
  await expect(sidebar).not.toContainText('Quellen')

  await sidebar.locator('[data-view="archive"]').click()
  await expect(page.locator('#archiveView')).toBeVisible()
  await expect(page.locator('#supplyOverviewView')).toBeHidden()
  await expect(page.locator('#archiveOverviewBody')).toBeVisible()
  await expect(page.locator('#pageTitle')).toHaveText('Archiv')

  await sidebar.locator('[data-view="supplyOverview"]').click()
  await expect(page.locator('#supplyOverviewView')).toBeVisible()
  await expect(page.locator('#archiveView')).toBeHidden()

  await page.locator('#utilityNav summary').click()
  await expect(page.locator('#utilityNav [data-view="overview"]')).toBeVisible()
  await page.locator('#utilityNav [data-view="overview"]').click()
  await expect(page.locator('#overviewView')).toBeVisible()
  await expect(page.locator('#utilityNav')).not.toHaveAttribute('open', '')

  await sidebar.locator('#newSupplyNavButton').click()
  await expect(page.locator('#careView')).toBeVisible()
  await expect(sidebar.locator('#newSupplyNavButton')).toHaveClass(/active/)
  expect(await page.locator('[style]').count()).toBe(0)
})

test('sidebar remains operable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 780 })
  await openSignedInApp(page)
  await expect(page.locator('.sidebar [data-view="archive"]')).toBeVisible()
  await page.locator('.sidebar [data-view="archive"]').click()
  await expect(page.locator('#archiveView')).toBeVisible()
  await page.locator('.sidebar [data-view="supplyOverview"]').click()
  await expect(page.locator('#supplyOverviewView')).toBeVisible()
})

test('malformed usernames fail with a generic message', async ({ page }) => {
  await page.goto('/index.html')
  await page.locator('#username').fill('bad name')
  await page.locator('#password').fill('test')
  await page.locator('#loginButton').click()
  await expect(page.locator('#loginError')).toContainText('Anmeldung fehlgeschlagen')
  await expect(page.locator('#mfaPane')).toBeHidden()
})

test('core reference data failure keeps the application closed', async ({ page }) => {
  await installSupabaseMock(page, { mode: 'signed-in', failBootstrap: true })
  await page.goto('/index.html')
  await expect(page.locator('#app')).toBeHidden()
  await expect(page.locator('#auth')).toBeVisible()
  await expect(page.locator('#loginError')).toContainText('fachliche Datenbasis')
})

test('care case load failure keeps the application closed', async ({ page }) => {
  await installSupabaseMock(page, { mode: 'signed-in', failCases: true })
  await page.goto('/index.html')
  await expect(page.locator('#app')).toBeHidden()
  await expect(page.locator('#auth')).toBeVisible()
  await expect(page.locator('#loginError')).toContainText('Versorgungsübersicht')
})

test('inactive or non-member password sessions cannot open the app', async ({ page }) => {
  await installSupabaseMock(page, { mode: 'login', denyPreMfa: true })
  await page.goto('/index.html')

  await page.locator('#username').fill('e2e-user')
  await page.locator('#password').fill('test')
  await page.locator('#loginButton').click()

  await expect(page.locator('#loginPane')).toBeVisible()
  await expect(page.locator('#mfaPane')).toBeHidden()
  await expect(page.locator('#loginError')).toContainText('Zugriffsberechtigung')
  await expect(page.locator('#app')).toBeHidden()
})

test('password login opens the app without MFA for approved members during temporary suspension', async ({ page }) => {
  await installSupabaseMock(page, { mode: 'login' })
  await page.goto('/index.html')
  await page.locator('#username').fill('e2e-user')
  await page.locator('#password').fill('test')
  await page.locator('#loginButton').click()

  await expect(page.locator('#mfaPane')).toBeHidden()
  await expect(page.locator('#app')).toBeVisible()
  await expect(page.locator('#supplyOverviewView')).toBeVisible()
  await expect(page.locator('#currentUser')).toContainText('e2e-user')
  await expect(page.locator('#password')).toHaveValue('')
  await expect(page.locator('#otp')).toHaveValue('')
})


test('sign-out paths clear patient data from runtime memory and DOM', async ({ page }) => {
  const source = await (await page.request.get('/app.js')).text()
  expect(source).toContain('function clearSensitiveRuntimeState()')
  expect(source).toContain("document.querySelectorAll('#careView input,#careView textarea')")
  expect(source).toContain("if($('supplyOverviewBody')) $('supplyOverviewBody').replaceChildren()")
})

test('authenticated browser sessions have a 30 minute inactivity timeout', async ({ page }) => {
  const source = await (await page.request.get('/app.js')).text()
  expect(source).toContain('const IDLE_TIMEOUT_MS=30*60*1000')
  expect(source).toContain('Sitzung wegen Inaktivität beendet')
  expect(source).toContain('supabase.auth.signOut()')
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

test('framed application navigation is blocked before authentication UI can run', async ({ page }) => {
  await page.goto('/index.html')
  await page.evaluate(() => {
    const frame = document.createElement('iframe')
    frame.id = 'clickjacking-probe'
    frame.src = '/index.html'
    document.body.appendChild(frame)
  })

  await expect.poll(async () => page.evaluate(() => {
    const frame = document.querySelector('#clickjacking-probe')
    try { return frame?.contentWindow?.location?.href || '' } catch (_) { return 'cross-origin' }
  }), { timeout: 10000 }).toBe('about:blank')

  const html = await (await page.request.get('/index.html')).text()
  expect(html.indexOf('./frame-guard.js')).toBeGreaterThan(0)
  expect(html.indexOf('./frame-guard.js')).toBeLessThan(html.indexOf('./whispercpp/runtime.js'))
})

test('document shell remains structurally complete after hardening', async ({ page }) => {
  await page.goto('/index.html')
  await expect(page.locator('#contractQuestionList')).toHaveCount(1)
  await expect(page.locator('#sourcesView')).toHaveCount(1)
  await expect(page.locator('script[src="./vendor/supabase.js"]')).toHaveCount(1)
  await expect(page.locator('script[type="module"][src="./app.js?v=RELEASESHA"]')).toHaveCount(1)
  await expect(page.locator('script:not([src])')).toHaveCount(0)
  expect(await page.locator('[style]').count()).toBe(0)
})
