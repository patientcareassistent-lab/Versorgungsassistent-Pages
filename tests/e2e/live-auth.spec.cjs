const { test, expect } = require('@playwright/test')
const crypto = require('crypto')

function decodeBase32(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const normalized = String(input || '').toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '')
  let bits = ''
  for (const char of normalized) {
    const value = alphabet.indexOf(char)
    if (value < 0) throw new Error('Invalid base32 input')
    bits += value.toString(2).padStart(5, '0')
  }
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function totp(base32, now = Date.now()) {
  const key = decodeBase32(base32)
  const counter = Math.floor(now / 1000 / 30)
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buffer.writeUInt32BE(counter >>> 0, 4)
  const digest = crypto.createHmac('sha1', key).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) >>> 0
  return String(binary % 1000000).padStart(6, '0')
}

test('optional live test account completes real password and TOTP MFA', async ({ page }) => {
  const username = process.env.E2E_USERNAME
  const password = process.env.E2E_PASSWORD
  const totpSecret = process.env.E2E_TOTP_SECRET
  test.skip(!username || !password || !totpSecret, 'Live auth secrets are not configured in GitHub Actions.')

  await page.goto('/index.html')
  const shortName = username.includes('@') ? username.split('@')[0] : username
  await page.locator('#username').fill(shortName)
  await page.locator('#password').fill(password)
  await page.locator('#loginButton').click()

  await expect(page.locator('#mfaPane')).toBeVisible({ timeout: 30000 })
  await page.locator('#otp').fill(totp(totpSecret))
  await page.locator('#verifyButton').click()

  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('#supplyOverviewView')).toBeVisible()
  await page.locator('#logoutButton').click()
})
