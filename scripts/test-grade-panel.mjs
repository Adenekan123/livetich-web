import { chromium } from 'playwright-core';

async function test() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const loginRes = await fetch('http://127.0.0.1:3005/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'instructor@livetich.dev', password: 'password123' })
  });
  const { accessToken } = await loginRes.json();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: 'lt_token', value: accessToken, domain: 'localhost', path: '/' }]);
  const page = await context.newPage();
  await page.goto('http://localhost:3000/sessions/cmu03fv6d000cvib8sjfixc9u', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const joinBtn = page.locator('button', { hasText: /Open the room|Join class/i }).first();
  if (await joinBtn.isVisible({ timeout: 3000 }).catch(() => false)) await joinBtn.click();
  await page.waitForTimeout(2500);

  const gradePanelBtn = page.locator('button[title="Grade assignments"]').first();
  await gradePanelBtn.click();
  await page.waitForTimeout(2000);

  const accordion = page.locator('button').filter({ hasText: 'QuickSort Partition' }).first();
  console.log('Accordion found?', await accordion.isVisible());
  await accordion.click();
  await page.waitForTimeout(2000);

  const gradeInput = page.locator('input[placeholder*="Grade"]').first();
  console.log('Grade input visible?', await gradeInput.isVisible());
  const btn = gradeInput.locator('xpath=following-sibling::button').first();
  console.log('Button text before click:', await btn.innerText());

  await gradeInput.fill('98');
  await page.waitForTimeout(500);
  await btn.click();
  await page.waitForTimeout(2500);
  console.log('Button text after click:', await btn.innerText());

  await page.screenshot({ path: 'scripts/test_grading.png' });
  await browser.close();
}

test().catch(console.error);
