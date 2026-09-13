import { test, expect, type Page } from '@playwright/test';
import { tool } from './board-tools-helper';

// Exercises the actual Excalidraw surface + the app's Import pipeline on the live
// board (instructor = canDraw). Shapes sync through the real Yjs/socket stack,
// and imported images/PDFs upload to the API's board-asset endpoint (the fix
// that made shared media visible to students, not blob: URLs).
// The live session these specs drive. Sessions are per-class rows, so this id
// goes stale whenever the local seed is rebuilt — override it without editing
// every spec:  LIVE_SESSION=<id> npx playwright test
const LIVE_SESSION =
  process.env.LIVE_SESSION ?? 'cmtu8bru50005vi7gvmrogb4a';

/** Open the Excalidraw board (Chalkboard panel). Authed as instructor via storageState. */
async function openBoard(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.getByRole('button', { name: /^chalkboard$/i }).click();
  await expect(page.locator('.excalidraw-container').first()).toBeVisible({ timeout: 20_000 });
  // Let Excalidraw finish mounting its canvas + toolbar.
  await expect(page.locator('.excalidraw-container canvas').first()).toBeVisible({
    timeout: 20_000,
  });
}

function shapeCount(page: Page) {
  return page.evaluate(
    () => window.__livetichBoard?.getSceneElements().length ?? 0,
  );
}

test('instructor can draw with the pen and add a shape tool', async ({ page }) => {
  await openBoard(page);
  const box = await page.locator('.excalidraw-container').first().boundingBox();
  if (!box) throw new Error('no board bounds');
  const before = await shapeCount(page);

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // --- Pen / draw tool (select via Excalidraw's toolbar, not a keyboard guess) ---
  await tool(page, 'freedraw').click();
  await page.mouse.move(cx - 120, cy + 40);
  await page.mouse.down();
  for (const [dx, dy] of [
    [-60, -40],
    [0, 40],
    [60, -30],
    [120, 20],
  ]) {
    await page.mouse.move(cx + dx, cy + dy, { steps: 6 });
  }
  await page.mouse.up();
  await expect
    .poll(() => shapeCount(page), { timeout: 10_000 })
    .toBeGreaterThan(before);

  // --- A shape, from the app's shapes menu ---
  // Square, diamond and circle are `display: none` in the native toolbar
  // (board-excalidraw.css): they were moved into one menu so each shape has a
  // single home. Clicking the hidden native button can never work — it has no
  // box — so this drives the menu the instructor actually uses.
  const afterDraw = await shapeCount(page);
  await page.locator('[data-board-shapes] button').click();
  await page.getByRole('menuitem', { name: 'Square' }).click();
  await page.mouse.move(cx + 160, cy - 120);
  await page.mouse.down();
  await page.mouse.move(cx + 280, cy - 30, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() => shapeCount(page), { timeout: 10_000 })
    .toBeGreaterThan(afterDraw);

  await page.screenshot({ path: 'test-results/board-drawing.png' });
});

test('instructor imports an image — it uploads to the API (same-origin URL, not blob:)', async ({
  page,
}) => {
  await openBoard(page);
  const before = await shapeCount(page);

  // Excalidraw parses the image to size the element; a degenerate file makes that
  // parser throw and the shape never lands. Catch that here so the test proves
  // a real image genuinely imports (not just that the upload fired).
  const parseErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /DataView|Offset is outside/i.test(m.text())) {
      parseErrors.push(m.text());
    }
  });

  const uploadPromise = page.waitForResponse(
    (r) => r.url().includes('/board-asset') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles('e2e/fixtures/sample-image.png');

  const res = await uploadPromise;
  expect(res.ok(), `board-asset upload status ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { url: string };
  // The whole point of the fix: a shareable same-origin URL, never a blob:.
  expect(body.url).not.toMatch(/^blob:/);
  expect(body.url).toContain('/api/files/');

  // A new image shape lands on the board.
  await expect.poll(() => shapeCount(page), { timeout: 15_000 }).toBeGreaterThan(before);

  // The uploader (instructor) may preview from a local blob:, but the shared
  // asset URL must be servable by the API so *other clients* (students) can load
  // it. Fetch it with the session cookie and confirm it serves image bytes —
  // this is exactly what a student's browser does.
  const assetUrl = new URL(body.url, page.url()).toString();
  const served = await page.request.get(assetUrl);
  expect(served.ok(), `serving ${assetUrl} -> ${served.status()}`).toBeTruthy();
  // Images are compressed to WebP on upload so they stay light and load fast.
  expect(served.headers()['content-type'] ?? '').toMatch(/image\/webp/);

  // The image parsed cleanly — no image-decode error.
  expect(parseErrors, `image parse errors:\n${parseErrors.join('\n')}`).toEqual([]);
});

test('instructor imports a 2-page PDF — pages rasterise into synced image shapes', async ({
  page,
}) => {
  await openBoard(page);
  const before = await shapeCount(page);

  // The board is a shared, server-persisted doc, so shape counts drift as prior
  // runs' shapes sync in — synchronize on the ACTUAL per-page asset uploads
  // instead. Each PDF page rasterises to a PNG and POSTs to board-asset.
  const uploads: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/board-asset') && r.request().method() === 'POST' && r.ok()) {
      uploads.push(r.url());
    }
  });

  await page
    .locator('input[type="file"]')
    .setInputFiles('e2e/fixtures/sample-doc.pdf');

  // Two pages ⇒ two rasterised uploads (rasterise + upload takes a few seconds).
  await expect
    .poll(() => uploads.length, { timeout: 60_000 })
    .toBeGreaterThanOrEqual(2);

  // Those uploads land as new image shapes on the board.
  await expect
    .poll(() => shapeCount(page), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(before + 2);

  await page.screenshot({ path: 'test-results/board-pdf-import.png' });
});
