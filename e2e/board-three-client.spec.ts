import { test, expect, type Page, type Browser, devices } from '@playwright/test';

// Regression cover for: "board works with instructor + a mobile student, but when
// another (desktop) user joins, everything stops — though 'Let students draw'
// still works." That signature is a Yjs sync FREEZE (the observer died) while the
// socket stays alive (writable toggle is a plain socket event, outside Yjs). Root
// cause: the post-merge follow calls (followSharedPage / applyPresenterView) ran
// OUTSIDE onYChange's try/catch, so a throw there (setCurrentPage / zoomToBounds
// racing a page mid-sync when a third client joins and streams records) escaped
// the observer and halted ALL further sync. Fix: guard those calls.
//
// Before the fix the escaping throw also surfaces as an uncaught pageerror, so we
// assert BOTH: sync keeps flowing after the desktop joins, AND no page errors.
const LIVE_SESSION = 'cmtfiqi9y0001vilcs0gefpq4';
const INSTRUCTOR_STATE = 'e2e/.auth/instructor.json';
const STUDENT_STATE = 'e2e/.auth/student.json';

const shapeCount = (p: Page) => p.locator('.tl-shape').count();

// The #8 freeze surfaces as an UNCAUGHT exception (a throw escaping the Yjs
// observer) — that's the signal we assert on. Console.error is deliberately NOT
// collected here: with two student sockets sharing one seed identity, LiveKit
// logs benign duplicate-identity/video noise on the video side that is unrelated
// to the board. The functional sync assertions are the primary proof.
function trackErrors(page: Page, label: string, sink: string[]) {
  page.on('pageerror', (e) => sink.push(`[${label}] pageerror: ${e.message}`));
}

async function openBoardInstructor(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.getByRole('button', { name: /^chalkboard$/i }).click();
  await expect(page.locator('.tl-container').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.tl-container canvas').first()).toBeVisible({ timeout: 20_000 });
}

// A student follows the presenter onto the board automatically; just wait for the
// classroom + the board canvas, and dismiss the mobile chat overlay if present.
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
  await page.mouse.move(cx - 80, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 30, cy - 30, { steps: 5 });
  await page.mouse.move(cx + 30, cy + 20, { steps: 5 });
  await page.mouse.move(cx + 80, cy - 8, { steps: 5 });
  await page.mouse.up();
}

async function newStudent(browser: Browser, opts: { mobile: boolean }) {
  const ctx = await browser.newContext({
    ...(opts.mobile ? devices['Pixel 7'] : {}),
    storageState: STUDENT_STATE,
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

test.describe('live board — three-client sync (desktop joins mid-session)', () => {
  test('a late desktop joiner receives existing content and does not freeze sync', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const errors: string[] = [];

    // 1) Instructor (desktop) + student (mobile) — the working baseline.
    const teacherCtx = await browser.newContext({ storageState: INSTRUCTOR_STATE });
    const teacher = await teacherCtx.newPage();
    trackErrors(teacher, 'teacher', errors);
    await openBoardInstructor(teacher);
    await clearBoard(teacher);

    const mobile = await newStudent(browser, { mobile: true });
    trackErrors(mobile.page, 'mobile', errors);
    await openBoardStudent(mobile.page);

    // Instructor draws — mobile mirrors it (2-client sync works).
    await drawStroke(teacher, -120);
    await expect.poll(() => shapeCount(teacher), { timeout: 8_000 }).toBeGreaterThan(0);
    await expect.poll(() => shapeCount(mobile.page), { timeout: 20_000 }).toBeGreaterThan(0);
    const beforeJoin = await shapeCount(teacher);

    // 2) The DESKTOP student joins third — the exact trigger in the report.
    const desktop = await newStudent(browser, { mobile: false });
    trackErrors(desktop.page, 'desktop', errors);
    await openBoardStudent(desktop.page);

    // The late joiner must receive the already-drawn content (state sync).
    await expect
      .poll(() => shapeCount(desktop.page), { timeout: 25_000 })
      .toBeGreaterThanOrEqual(beforeJoin);

    // 3) The tell: with the desktop now in the room, a NEW instructor stroke must
    // still propagate to BOTH students. If any observer froze, this fails.
    await drawStroke(teacher, 120);
    const expected = beforeJoin + 1;
    await expect.poll(() => shapeCount(teacher), { timeout: 8_000 }).toBeGreaterThanOrEqual(expected);
    await expect
      .poll(() => shapeCount(mobile.page), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(expected);
    await expect
      .poll(() => shapeCount(desktop.page), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(expected);

    // 4) And a delete must also still sync everywhere.
    await clearBoard(teacher);
    await expect.poll(() => shapeCount(teacher), { timeout: 10_000 }).toBe(0);
    await expect.poll(() => shapeCount(mobile.page), { timeout: 20_000 }).toBe(0);
    await expect.poll(() => shapeCount(desktop.page), { timeout: 20_000 }).toBe(0);

    expect(errors, `client errors:\n${errors.join('\n')}`).toEqual([]);

    await desktop.ctx.close();
    await mobile.ctx.close();
    await teacherCtx.close();
  });

  test('students can draw after the desktop joins, and it syncs to all three', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const errors: string[] = [];

    const teacherCtx = await browser.newContext({ storageState: INSTRUCTOR_STATE });
    const teacher = await teacherCtx.newPage();
    trackErrors(teacher, 'teacher', errors);
    await openBoardInstructor(teacher);
    await clearBoard(teacher);

    const mobile = await newStudent(browser, { mobile: true });
    trackErrors(mobile.page, 'mobile', errors);
    await openBoardStudent(mobile.page);

    const desktop = await newStudent(browser, { mobile: false });
    trackErrors(desktop.page, 'desktop', errors);
    await openBoardStudent(desktop.page);

    // "Let students draw" — the report says this kept working; confirm it opens
    // the board for students on all clients.
    await teacher.getByRole('button', { name: /let students draw/i }).click();
    await expect(teacher.getByRole('button', { name: /students drawing/i })).toBeVisible({
      timeout: 10_000,
    });

    // The DESKTOP student draws — it must sync to the instructor and the mobile
    // student (student-originated edits still flow with three clients present).
    await expect(desktop.page.getByTestId('tools.draw')).toBeVisible({ timeout: 15_000 });
    await drawStroke(desktop.page, 40);
    await expect.poll(() => shapeCount(desktop.page), { timeout: 8_000 }).toBeGreaterThan(0);
    await expect.poll(() => shapeCount(teacher), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect.poll(() => shapeCount(mobile.page), { timeout: 20_000 }).toBeGreaterThan(0);

    // And the instructor can still draw on top — sync is bidirectional/live.
    const afterStudent = await shapeCount(teacher);
    await drawStroke(teacher, -120);
    await expect
      .poll(() => shapeCount(desktop.page), { timeout: 20_000 })
      .toBeGreaterThan(afterStudent);

    expect(errors, `client errors:\n${errors.join('\n')}`).toEqual([]);

    await desktop.ctx.close();
    await mobile.ctx.close();
    await teacherCtx.close();
  });

  test('a desktop joiner arriving to existing PDF content stays in sync (page-follow race)', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];

    const teacherCtx = await browser.newContext({ storageState: INSTRUCTOR_STATE });
    const teacher = await teacherCtx.newPage();
    trackErrors(teacher, 'teacher', errors);
    await openBoardInstructor(teacher);
    await clearBoard(teacher);

    const mobile = await newStudent(browser, { mobile: true });
    trackErrors(mobile.page, 'mobile', errors);
    await openBoardStudent(mobile.page);

    // Presenter imports a PDF — its pages become synced asset/image records, and
    // the presenter announces the page + bounds. This is what drives the
    // followSharedPage / applyPresenterView path on followers.
    const uploads: string[] = [];
    teacher.on('response', (r) => {
      if (r.url().includes('/board-asset') && r.request().method() === 'POST' && r.ok())
        uploads.push(r.url());
    });
    await teacher.locator('input[type="file"]').setInputFiles('e2e/fixtures/sample-doc.pdf');
    await expect.poll(() => uploads.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(() => shapeCount(mobile.page), { timeout: 25_000 }).toBeGreaterThanOrEqual(2);

    // Now the DESKTOP joins into a room that already has PDF content — the late
    // joiner streams those records through its store, and every follower re-runs
    // the page-follow when records land. The freeze reproduced exactly here.
    const desktop = await newStudent(browser, { mobile: false });
    trackErrors(desktop.page, 'desktop', errors);
    await openBoardStudent(desktop.page);
    await expect.poll(() => shapeCount(desktop.page), { timeout: 30_000 }).toBeGreaterThanOrEqual(2);

    // Sync must still be live for everyone: an instructor stroke on top of the
    // PDF propagates to both students.
    const base = await shapeCount(mobile.page);
    await drawStroke(teacher, -140);
    await expect
      .poll(() => shapeCount(mobile.page), { timeout: 25_000 })
      .toBeGreaterThan(base);
    await expect
      .poll(() => shapeCount(desktop.page), { timeout: 25_000 })
      .toBeGreaterThan(base);

    expect(errors, `client errors:\n${errors.join('\n')}`).toEqual([]);

    await desktop.ctx.close();
    await mobile.ctx.close();
    await teacherCtx.close();
  });
});
