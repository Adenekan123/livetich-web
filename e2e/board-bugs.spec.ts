import { test, expect, type Page, devices } from '@playwright/test';

const LIVE_SESSION = 'cmtfiqi9y0001vilcs0gefpq4';
const INSTRUCTOR_STATE = 'e2e/.auth/instructor.json';
const STUDENT_STATE = 'e2e/.auth/student.json';

// The page is already authed via storageState (see global-setup) — no login.
async function openBoard(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.getByRole('button', { name: /^chalkboard$/i }).click();
  await expect(page.locator('.tl-container').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.tl-container canvas').first()).toBeVisible({ timeout: 20_000 });
}

const shapeCount = (page: Page) => page.locator('.tl-shape').count();

async function drawStroke(page: Page) {
  const box = await page.locator('.tl-container').first().boundingBox();
  if (!box) throw new Error('no board bounds');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.getByTestId('tools.draw').click();
  await page.mouse.move(cx - 100, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 40, cy - 40, { steps: 5 });
  await page.mouse.move(cx + 40, cy + 30, { steps: 5 });
  await page.mouse.move(cx + 100, cy - 10, { steps: 5 });
  await page.mouse.up();
}

async function clearBoard(page: Page) {
  await page.getByTestId('tools.select').click();
  await page.keyboard.press('Escape');
  await page.locator('.tl-container').first().click({ position: { x: 120, y: 260 } });
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
}

function trackErrors(page: Page, sink: string[]) {
  page.on('console', (m) => {
    if (m.type() === 'error') sink.push(m.text());
  });
  page.on('pageerror', (e) => sink.push(`pageerror: ${e.message}`));
}

// BUG (mobile chat): the live chat used to open over the board on first load;
// on phones it must start CLOSED, with the user opening it from the bottom bar.
test('mobile classroom loads with the chat panel closed', async ({ browser }) => {
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    storageState: STUDENT_STATE,
  });
  const page = await ctx.newPage();
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await expect(page.getByRole('button', { name: /^leave$/i })).toBeVisible({
    timeout: 20_000,
  });

  // Chat starts closed: its composer isn't rendered (no overlay over the stage).
  await expect(page.getByPlaceholder(/say something|chat is locked/i)).toHaveCount(0);

  // The user opens it from the bottom bar; now the composer shows.
  await page.getByRole('button', { name: /toggle chat/i }).click();
  await expect(page.getByPlaceholder(/say something|chat is locked/i)).toBeVisible({
    timeout: 10_000,
  });

  await ctx.close();
});

// BUG 1 (multi-client): the instructor imports a PDF then deletes it; those
// asset/shape records sync to a student. If a bad record or ordering corrupts
// the tldraw store mid-merge, the board freezes and "drawing stops working".
// After the cycle, BOTH boards must still accept and sync new drawing.
test('board stays live for instructor + student across a PDF import/delete cycle', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const tErr: string[] = [];
  const sErr: string[] = [];
  const teacherCtx = await browser.newContext({ storageState: INSTRUCTOR_STATE });
  const teacher = await teacherCtx.newPage();
  trackErrors(teacher, tErr);
  await openBoard(teacher);
  await clearBoard(teacher);

  const studentCtx = await browser.newContext({
    ...devices['Pixel 7'],
    storageState: STUDENT_STATE,
  });
  const student = await studentCtx.newPage();
  trackErrors(student, sErr);
  await student.goto(`/sessions/${LIVE_SESSION}`);
  await expect(student.getByRole('button', { name: /^leave$/i })).toBeVisible({
    timeout: 20_000,
  });
  const closeChat = student.getByRole('button', { name: /close panel/i });
  if (await closeChat.isVisible().catch(() => false)) await closeChat.click();
  await expect(student.locator('.tl-container').first()).toBeVisible({ timeout: 20_000 });

  // Import the PDF; it should sync to the student.
  const uploads: string[] = [];
  teacher.on('response', (r) => {
    if (r.url().includes('/board-asset') && r.request().method() === 'POST' && r.ok())
      uploads.push(r.url());
  });
  await teacher.locator('input[type="file"]').setInputFiles('e2e/fixtures/sample-doc.pdf');
  await expect.poll(() => uploads.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
  await expect
    .poll(() => shapeCount(student), { timeout: 25_000 })
    .toBeGreaterThanOrEqual(2);

  // Instructor deletes the PDF; the student should see it removed.
  await clearBoard(teacher);
  await expect.poll(() => shapeCount(teacher), { timeout: 10_000 }).toBe(0);
  await expect.poll(() => shapeCount(student), { timeout: 25_000 }).toBe(0);

  // The tell for the bug: after the cycle, a NEW instructor stroke must still
  // render locally AND sync to the student. If either board froze, this fails.
  await drawStroke(teacher);
  await expect.poll(() => shapeCount(teacher), { timeout: 8_000 }).toBeGreaterThan(0);
  await expect
    .poll(() => shapeCount(student), { timeout: 20_000 })
    .toBeGreaterThan(0);

  expect(tErr, `instructor errors:\n${tErr.join('\n')}`).toEqual([]);
  expect(sErr, `student errors:\n${sErr.join('\n')}`).toEqual([]);

  await studentCtx.close();
  await teacherCtx.close();
});

// BUG 1 (heavy, realistic PDF): a 12-page deck with big embedded rasters — the
// real conditions (large assets, long uploads, many shapes). Import, delete,
// draw; the board and pen must survive.
test('draw works after importing + deleting a heavy multi-page PDF', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const uploadFails: string[] = [];
  trackErrors(page, errors);
  page.on('response', (r) => {
    if (r.url().includes('/board-asset') && r.request().method() === 'POST' && !r.ok())
      uploadFails.push(`${r.status()} ${r.url()}`);
  });
  await openBoard(page);
  await clearBoard(page);

  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/heavy-deck.pdf');
  // Pages rasterise + compress + upload — allow generous time for shapes to land.
  await expect.poll(() => shapeCount(page), { timeout: 120_000 }).toBeGreaterThanOrEqual(3);

  await clearBoard(page);
  await expect.poll(() => shapeCount(page), { timeout: 15_000 }).toBe(0);

  await drawStroke(page);
  await expect.poll(() => shapeCount(page), { timeout: 8_000 }).toBeGreaterThan(0);

  expect(uploadFails, `board-asset upload failures:\n${uploadFails.join('\n')}`).toEqual([]);
  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

// BUG 1 (wide mid-import race): with 12 heavy pages streaming in, delete
// aggressively while the import is in flight, then draw.
test('draw works after deleting a heavy PDF mid-import (wide race)', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  trackErrors(page, errors);
  await openBoard(page);
  await clearBoard(page);

  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/heavy-deck.pdf');
  // Hammer delete while pages are still rasterising/uploading.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await expect.poll(() => shapeCount(page), { timeout: 15_000 }).toBe(0);

  await drawStroke(page);
  await expect.poll(() => shapeCount(page), { timeout: 8_000 }).toBeGreaterThan(0);
  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

// BUG 1 (eraser): a user often "deletes" a PDF by erasing it — a distinct
// tldraw code path from select+delete. Erase the imported pages, then draw.
test('draw still works after ERASING an imported PDF', async ({ page }) => {
  const errors: string[] = [];
  trackErrors(page, errors);
  await openBoard(page);
  await clearBoard(page);

  const uploads: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/board-asset') && r.request().method() === 'POST' && r.ok())
      uploads.push(r.url());
  });
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/sample-doc.pdf');
  await expect.poll(() => uploads.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => shapeCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);

  // Erase: drag the eraser across the board where the pages sit.
  const box = (await page.locator('.tl-container').first().boundingBox())!;
  await page.getByTestId('tools.eraser').click();
  const cx = box.x + box.width / 2;
  for (let y = 0.2; y <= 0.85; y += 0.06) {
    await page.mouse.move(cx - 140, box.y + box.height * y);
    await page.mouse.down();
    await page.mouse.move(cx + 140, box.y + box.height * y, { steps: 6 });
    await page.mouse.up();
  }

  // Now draw — did erasing the PDF break the pen?
  await drawStroke(page);
  await expect.poll(() => shapeCount(page), { timeout: 8_000 }).toBeGreaterThan(0);
  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

// BUG 1 (rapid cycles): repeatedly import + delete to stress the asset/sync
// pipeline, then confirm drawing still works and nothing errored.
test('draw still works after repeated PDF import/delete cycles', async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  trackErrors(page, errors);
  await openBoard(page);
  await clearBoard(page);

  for (let i = 0; i < 3; i++) {
    const uploads: string[] = [];
    const onResp = (r: import('@playwright/test').Response) => {
      if (r.url().includes('/board-asset') && r.request().method() === 'POST' && r.ok())
        uploads.push(r.url());
    };
    page.on('response', onResp);
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/sample-doc.pdf');
    await expect.poll(() => uploads.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
    page.off('response', onResp);
    await clearBoard(page);
    await expect.poll(() => shapeCount(page), { timeout: 10_000 }).toBe(0);
  }

  await drawStroke(page);
  await expect.poll(() => shapeCount(page), { timeout: 8_000 }).toBeGreaterThan(0);
  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

// BUG 1: after importing a PDF then deleting it, the draw tool "sometimes"
// stops working. Repeat a few times to catch the intermittency.
test('draw still works after importing then deleting a PDF', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await openBoard(page);

  // Import the PDF (2 pages -> 2 uploaded image shapes).
  const uploads: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/board-asset') && r.request().method() === 'POST' && r.ok())
      uploads.push(r.url());
  });
  const before = await shapeCount(page);
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/sample-doc.pdf');
  await expect.poll(() => uploads.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
  await expect.poll(() => shapeCount(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(before + 2);

  // Delete it: select everything and delete (the user's "delete the PDF").
  // Focus the canvas on an empty mid-left spot (NOT the top-left menu button),
  // close any stray menu, then select-all + delete.
  await page.getByTestId('tools.select').click();
  await page.keyboard.press('Escape');
  await page.locator('.tl-container').first().click({ position: { x: 120, y: 260 } });
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await expect.poll(() => shapeCount(page), { timeout: 10_000 }).toBe(0);

  // Now try to draw — this is what "stops working".
  const afterClear = await shapeCount(page);
  await drawStroke(page);
  await expect
    .poll(() => shapeCount(page), { timeout: 8_000 })
    .toBeGreaterThan(afterClear);

  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

// BUG 1 (race variant): delete the PDF WHILE its pages are still rasterising/
// uploading — the async asset upload resolving against a just-deleted shape is
// the most likely "sometimes it breaks" trigger.
test('draw still works after deleting a PDF mid-import (race)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  await openBoard(page);

  // Clean slate first.
  await page.getByTestId('tools.select').click();
  await page.keyboard.press('Escape');
  await page.locator('.tl-container').first().click({ position: { x: 120, y: 260 } });
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await expect.poll(() => shapeCount(page), { timeout: 10_000 }).toBe(0);

  // Kick off the import and delete AGGRESSIVELY while it's in flight — a few
  // select-all+delete cycles racing the per-page uploads.
  await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/sample-doc.pdf');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
  }
  // Let any in-flight uploads settle, then clear whatever landed.
  await page.waitForTimeout(2_000);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await expect.poll(() => shapeCount(page), { timeout: 10_000 }).toBe(0);

  // Now draw — does the tool still work, or did the board freeze?
  await drawStroke(page);
  await expect.poll(() => shapeCount(page), { timeout: 8_000 }).toBeGreaterThan(0);

  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});

// BUG 2: PDF scale/aspect on a mobile student. The presenter imports a PDF and
// the mobile follower fits the presenter's bounds to its own viewport. Capture
// what the student actually sees and measure the rendered page vs. the viewport.
test('mobile student sees an imported PDF at a sane scale', async ({ browser }) => {
  test.setTimeout(150_000);
  const teacherCtx = await browser.newContext({ storageState: INSTRUCTOR_STATE });
  const teacher = await teacherCtx.newPage();
  await openBoard(teacher);

  // Start from a clean board so the imported PDF is the only content (both for a
  // realistic measurement and because getCurrentPageBounds spans ALL shapes).
  await teacher.getByTestId('tools.select').click();
  await teacher.keyboard.press('Escape');
  await teacher.locator('.tl-container').first().click({ position: { x: 120, y: 260 } });
  await teacher.keyboard.press('Control+a');
  await teacher.keyboard.press('Delete');

  const studentCtx = await browser.newContext({
    ...devices['Pixel 7'],
    storageState: STUDENT_STATE,
  });
  const student = await studentCtx.newPage();
  // The student doesn't switch panels — it auto-follows the presenter to the
  // Chalkboard. Just wait for the classroom, then close the chat overlay that
  // opens over the board on mobile so the board is unobscured.
  await student.goto(`/sessions/${LIVE_SESSION}`);
  await expect(student.getByRole('button', { name: /^leave$/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(student.getByText(/following/i).first()).toBeVisible({ timeout: 20_000 });
  const closeChat = student.getByRole('button', { name: /close panel/i });
  if (await closeChat.isVisible().catch(() => false)) await closeChat.click();
  await expect(student.locator('.tl-container').first()).toBeVisible({ timeout: 20_000 });

  // Presenter imports the PDF.
  const uploads: string[] = [];
  teacher.on('response', (r) => {
    if (r.url().includes('/board-asset') && r.request().method() === 'POST' && r.ok())
      uploads.push(r.url());
  });
  await teacher.locator('input[type="file"]').setInputFiles('e2e/fixtures/sample-doc.pdf');
  await expect.poll(() => uploads.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);

  // Give the follow-sync a moment to land the page + fit bounds on the student.
  // Widest rendered PDF-page image as a fraction of the phone width.
  const widthFrac = () =>
    student.evaluate(() => {
      const vw = window.innerWidth;
      const ws = (
        Array.from(document.querySelectorAll('.tl-container img')) as HTMLImageElement[]
      )
        .map((im) => im.getBoundingClientRect().width)
        .filter((w) => w > 2);
      return ws.length ? Math.max(...ws) / vw : 0;
    });

  // Regression guard for the mobile-scale fix: the followed page must fill a
  // healthy fraction of the phone width. Before the fix it sat at ~31% (the
  // follower fit the presenter's wide desktop viewport); it should now be well
  // over half. Poll — the follow-fit lands a beat after the import syncs.
  await expect
    .poll(widthFrac, { timeout: 25_000 })
    .toBeGreaterThan(0.6);

  // Record the final layout + screenshots.
  const metrics = await student.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rects = (
      Array.from(document.querySelectorAll('.tl-container img')) as HTMLImageElement[]
    )
      .map((im) => im.getBoundingClientRect())
      .filter((r) => r.width > 2 && r.height > 2)
      .map((r) => ({ w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }));
    return { vw, vh, rects };
  });
  console.log('MOBILE PDF METRICS:', JSON.stringify(metrics));
  await student.screenshot({ path: 'test-results/mobile-pdf-student.png' });
  await teacher.screenshot({ path: 'test-results/mobile-pdf-teacher.png' });

  await studentCtx.close();
  await teacherCtx.close();
});
