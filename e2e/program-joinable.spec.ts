import { test, expect, type Browser, type APIRequestContext } from '@playwright/test';

// Regression cover for #9 (the join-clickability half): creating a program to run
// "now" left "Join as instructor" disabled from the very first render. Root cause
// was server-side, not caching — the create form left Start date BLANK, so
// resolveJoinWindow produced ZERO occurrences and joinableNow was false. Fix:
// the create form now defaults Start date to today, so a program with today as a
// meeting day is joinable immediately.
const API = 'http://localhost:3000';
const ADMIN_EMAIL = 'pryor.kosi@forliion.com'; // ORG_ADMIN test account
const PASSWORD = 'Test1234!';
const TZ = 'Africa/Lagos'; // the create form's default timezone

// Day abbreviations exactly as MeetingSchedule renders them.
const SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// "Today" in the course timezone — resolveJoinWindow reasons in that zone.
function todayIdxInTz(tz: string): number {
  return WEEK.indexOf(new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' }));
}

async function apiToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).accessToken as string;
}

async function loginBrowser(browser: Browser) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
  return { ctx, page };
}

test('a program created to run today is joinable from the first render', async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const { ctx, page } = await loginBrowser(browser);
  let courseId = '';
  try {
    await page.goto('/courses');

    // Open the New program modal.
    await page.getByRole('button', { name: /\+ New program/i }).click();
    const dialog = page.getByRole('dialog', { name: /new program/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Title + today as a meeting day + a time already past today.
    await dialog.getByLabel(/program title/i).fill(`RUN-NOW ${Date.now()}`);
    await dialog.getByRole('button', { name: SHORT[todayIdxInTz(TZ)], exact: true }).click();
    await dialog.locator('input[type="time"]').first().fill('00:01');

    // The fix: Start date defaults to today (not blank) — without this the
    // program would have zero occurrences and Join would be disabled.
    const startDate = dialog.locator('#startDate');
    await expect(startDate).not.toHaveValue('');

    await dialog.getByRole('button', { name: /create program/i }).click();

    // Redirected to the new program; capture its id for cleanup.
    await page.waitForURL(/\/courses\/[^/]+$/, { timeout: 20_000 });
    courseId = page.url().split('/courses/')[1];

    // The tell: "Join as instructor" is ENABLED from this first render.
    const joinBtn = page.getByRole('button', { name: /join as instructor/i });
    await expect(joinBtn).toBeVisible({ timeout: 15_000 });
    await expect(joinBtn).toBeEnabled();
  } finally {
    if (courseId) {
      const token = await apiToken(request);
      await request
        .delete(`${API}/courses/${courseId}`, { headers: { Authorization: `Bearer ${token}` } })
        .catch(() => {});
    }
    await ctx.close();
  }
});
