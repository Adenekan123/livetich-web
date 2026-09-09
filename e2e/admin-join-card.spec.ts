import { test, expect, type Browser, type APIRequestContext } from '@playwright/test';

// Bug #2 fix: an admin's live program card must route to the PROGRAM page
// (Shadow / Join-as-instructor choice), never straight into /sessions.
const API = 'http://localhost:3000';
const ADMIN = 'pryor.kosi@forliion.com';
const PASSWORD = 'Test1234!';
const TZ = 'Africa/Lagos';
const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function todayIdx(tz: string) {
  return WEEK.indexOf(new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' }));
}
async function token(req: APIRequestContext) {
  const r = await req.post(`${API}/auth/login`, { data: { email: ADMIN, password: PASSWORD } });
  return (await r.json()).accessToken as string;
}
async function loginBrowser(browser: Browser) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('#email', ADMIN);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
  return { ctx, page };
}

test('admin live-program card routes to /courses, not /sessions', async ({ browser, request }) => {
  test.setTimeout(120_000);
  const tk = await token(request);
  const H = { Authorization: `Bearer ${tk}` };
  const title = `ADMIN-LIVE ${Date.now()}`;
  // Create a program joinable now.
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now);
  const create = await request.post(`${API}/courses`, {
    headers: H,
    data: { title, startDate: dateStr, durationWeeks: 8, meetingDays: [todayIdx(TZ)], meetingTime: '00:01', timezone: TZ },
  });
  expect(create.ok()).toBeTruthy();
  const courseId = (await create.json()).id as string;
  let sessionId = '';
  try {
    // Go live as instructor.
    const go = await request.post(`${API}/sessions/course/${courseId}/join?as=teach`, { headers: H });
    expect(go.ok(), `go-live failed: ${go.status()} ${await go.text()}`).toBeTruthy();
    sessionId = (await go.json()).sessionId as string;

    const { ctx, page } = await loginBrowser(browser);
    await page.goto('/courses');
    // Find the card for our program and its live-join control.
    const card = page.locator('div', { hasText: title }).filter({ has: page.getByRole('link', { name: /join live/i }) }).last();
    const joinLink = page.getByRole('link', { name: /join live/i }).first();
    await expect(joinLink).toBeVisible({ timeout: 15_000 });
    const href = await joinLink.getAttribute('href');
    console.log(`admin live card join href = ${href}`);
    expect(href, 'admin join-live must go to the program page, not straight to /sessions').toContain(`/courses/${courseId}`);
    expect(href).not.toContain('/sessions/');
    await ctx.close();
    void card;
  } finally {
    await request.delete(`${API}/courses/${courseId}`, { headers: H }).catch(() => {});
    void sessionId;
  }
});
