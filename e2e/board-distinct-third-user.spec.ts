import { test, expect, type Page, type Browser, devices } from '@playwright/test';

// The faithful reproduction of #8: a THIRD, genuinely DISTINCT desktop user
// (kealan) joins a session where an instructor + a mobile student are already
// working. Distinct identities mean all three LiveKit video participants connect
// (no duplicate-identity shortcut), which is the real-world condition the report
// describes ("another user using a desktop joined"). We assert the board keeps
// syncing to everyone and no uncaught error fires; console errors are printed for
// diagnostics if it does freeze.
const LIVE_SESSION = 'cmtfiqi9y0001vilcs0gefpq4';
const INSTRUCTOR_STATE = 'e2e/.auth/instructor.json';
const STUDENT_STATE = 'e2e/.auth/student.json';
const KEALAN_EMAIL = 'kealan.sahim@forliion.com';
const PASSWORD = 'Test1234!';

const shapeCount = (p: Page) => p.locator('.tl-shape').count();

function trackErrors(page: Page, label: string, pageErrors: string[], consoleErrors: string[]) {
  page.on('pageerror', (e) => pageErrors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[${label}] ${m.text()}`);
  });
}

async function loginDesktop(browser: Browser, email: string) {
  // Explicitly empty storage state — otherwise the config's `use.storageState`
  // (the instructor) is inherited and /login just redirects away.
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
  return { ctx, page };
}

async function openBoardInstructor(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.getByRole('button', { name: /^chalkboard$/i }).click();
  await expect(page.locator('.tl-container').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.tl-container canvas').first()).toBeVisible({ timeout: 20_000 });
}

async function openBoardStudent(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await expect(page.getByRole('button', { name: /^leave$/i })).toBeVisible({ timeout: 20_000 });
  const closeChat = page.getByRole('button', { name: /close panel/i });
  if (await closeChat.isVisible().catch(() => false)) await closeChat.click();
  await expect(page.locator('.tl-container').first()).toBeVisible({ timeout: 20_000 });
}

async function clearBoard(page: Page) {
  await page.getByTestId('tools.select').click();
  await page.keyboard.press('Escape');
  await page.locator('.tl-container').first().click({ position: { x: 120, y: 260 } });
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
}

async function drawStroke(page: Page, dx = 0) {
  const box = await page.locator('.tl-container').first().boundingBox();
  if (!box) throw new Error('no board bounds');
  const cx = box.x + box.width / 2 + dx;
  const cy = box.y + box.height / 2;
  await page.getByTestId('tools.draw').click();
  await page.mouse.move(cx - 70, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 20, cy - 25, { steps: 4 });
  await page.mouse.move(cx + 30, cy + 15, { steps: 4 });
  await page.mouse.move(cx + 70, cy - 6, { steps: 4 });
  await page.mouse.up();
}

test.describe('live board — distinct third desktop user (#8 faithful repro)', () => {
  test('a distinct desktop user joining mid-session keeps the board live for all three', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    // Instructor (jeyson, desktop) + student (eames, mobile) — the baseline.
    const teacherCtx = await browser.newContext({ storageState: INSTRUCTOR_STATE });
    const teacher = await teacherCtx.newPage();
    trackErrors(teacher, 'teacher', pageErrors, consoleErrors);
    await openBoardInstructor(teacher);
    await clearBoard(teacher);

    const mobileCtx = await browser.newContext({ ...devices['Pixel 7'], storageState: STUDENT_STATE });
    const mobile = await mobileCtx.newPage();
    trackErrors(mobile, 'mobile', pageErrors, consoleErrors);
    await openBoardStudent(mobile);

    await drawStroke(teacher, -120);
    await expect.poll(() => shapeCount(mobile), { timeout: 20_000 }).toBeGreaterThan(0);
    const beforeJoin = await shapeCount(teacher);

    // Distinct DESKTOP user (kealan) joins third.
    const kealan = await loginDesktop(browser, KEALAN_EMAIL);
    trackErrors(kealan.page, 'kealan', pageErrors, consoleErrors);
    await openBoardStudent(kealan.page);
    await expect
      .poll(() => shapeCount(kealan.page), { timeout: 25_000 })
      .toBeGreaterThanOrEqual(beforeJoin);

    // The tell: after the distinct desktop user is in, a new instructor stroke
    // must still reach BOTH students.
    await drawStroke(teacher, 120);
    const expected = beforeJoin + 1;
    await expect.poll(() => shapeCount(mobile), { timeout: 20_000 }).toBeGreaterThanOrEqual(expected);
    await expect.poll(() => shapeCount(kealan.page), { timeout: 20_000 }).toBeGreaterThanOrEqual(expected);

    // And a student (kealan) draws once the board is opened → syncs to all.
    await teacher.getByRole('button', { name: /let students draw/i }).click();
    await expect(kealan.page.getByTestId('tools.draw')).toBeVisible({ timeout: 15_000 });
    const beforeStudentDraw = await shapeCount(teacher);
    await drawStroke(kealan.page, 40);
    await expect.poll(() => shapeCount(teacher), { timeout: 20_000 }).toBeGreaterThan(beforeStudentDraw);
    await expect.poll(() => shapeCount(mobile), { timeout: 20_000 }).toBeGreaterThan(beforeStudentDraw);

    if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.join('\n'));
    expect(pageErrors, `uncaught errors:\n${pageErrors.join('\n')}`).toEqual([]);

    await kealan.ctx.close();
    await mobileCtx.close();
    await teacherCtx.close();
  });

  test('a distinct desktop user joining WHILE the instructor is drawing does not freeze sync', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    const teacherCtx = await browser.newContext({ storageState: INSTRUCTOR_STATE });
    const teacher = await teacherCtx.newPage();
    trackErrors(teacher, 'teacher', pageErrors, consoleErrors);
    await openBoardInstructor(teacher);
    await clearBoard(teacher);

    const mobileCtx = await browser.newContext({ ...devices['Pixel 7'], storageState: STUDENT_STATE });
    const mobile = await mobileCtx.newPage();
    trackErrors(mobile, 'mobile', pageErrors, consoleErrors);
    await openBoardStudent(mobile);

    // Pre-seed some content so the joiner has records to stream in.
    await drawStroke(teacher, -120);
    await expect.poll(() => shapeCount(mobile), { timeout: 20_000 }).toBeGreaterThan(0);

    // Kick off kealan's join WITHOUT awaiting, then keep drawing on the
    // instructor so the desktop loads state while updates are in flight — the
    // concurrent race the report hints at.
    const kealan = await loginDesktop(browser, KEALAN_EMAIL);
    trackErrors(kealan.page, 'kealan', pageErrors, consoleErrors);
    const joining = openBoardStudent(kealan.page);
    for (let i = 0; i < 4; i++) {
      await drawStroke(teacher, -120 + i * 60);
      await teacher.waitForTimeout(250);
    }
    await joining;

    // After the dust settles, all three must agree on the shape count and a
    // fresh stroke must still propagate — i.e. nobody froze.
    await drawStroke(teacher, 130);
    const target = await shapeCount(teacher);
    await expect.poll(() => shapeCount(mobile), { timeout: 25_000 }).toBeGreaterThanOrEqual(target);
    await expect.poll(() => shapeCount(kealan.page), { timeout: 25_000 }).toBeGreaterThanOrEqual(target);

    if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.join('\n'));
    expect(pageErrors, `uncaught errors:\n${pageErrors.join('\n')}`).toEqual([]);

    await kealan.ctx.close();
    await mobileCtx.close();
    await teacherCtx.close();
  });
});
