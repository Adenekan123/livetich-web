import { test, expect, type Page } from '@playwright/test';

// Arming a polygon borrows currentItemOpacity — it is set to 0 so the rectangle
// placeholder is invisible while the drag is in flight — and hands it back when
// the shape lands. Two paths out of that state never did: picking a second
// polygon re-read the borrowed 0 as the "real" value, and picking a native
// square/diamond/circle returned early without restoring anything.
//
// The board then drew every later shape, and every line of text, at opacity 0.
// Nothing errors; the elements are created, synced and selectable, just wholly
// transparent. It reads as the chalkboard having stopped working, and it does
// not recover without a reload — so it is worth a test.
// Sessions are per-class rows, so this id goes stale whenever the local seed is
// rebuilt — override it without editing the spec:
//   LIVE_SESSION=<id> npx playwright test
const LIVE_SESSION = process.env.LIVE_SESSION ?? 'cmtu8bru50005vi7gvmrogb4a';

async function openBoard(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.getByRole('button', { name: 'Chalkboard' }).click();
  await page.waitForFunction(() => !!(window as never as { __livetichBoard?: unknown }).__livetichBoard, null, { timeout: 60_000 });
  await page.locator('[data-board-shapes] button').first().waitFor({ timeout: 30_000 });
}

const pick = async (page: Page, label: string) => {
  await page.locator('[data-board-shapes] button').first().click();
  await page.getByRole('menuitem', { name: label }).click();
};

const currentOpacity = (page: Page) =>
  page.evaluate(() => (window as never as { __livetichBoard: { getAppState(): { currentItemOpacity: number } } })
    .__livetichBoard.getAppState().currentItemOpacity);

test('polygon then native shape hands the opacity back', async ({ page }) => {
  test.setTimeout(120_000);
  await openBoard(page);
  const before = await currentOpacity(page);
  await pick(page, 'Star');       // arms a polygon -> borrows opacity (0)
  await pick(page, 'Square');     // native tool: used to return early
  expect(await currentOpacity(page)).toBe(before);
});

test('two polygons in a row do not poison the baseline', async ({ page }) => {
  test.setTimeout(120_000);
  await openBoard(page);
  const before = await currentOpacity(page);
  await pick(page, 'Star');
  await pick(page, 'Pentagon');   // used to capture the borrowed 0 as baseline
  await pick(page, 'Square');     // hand it back
  expect(await currentOpacity(page)).toBe(before);
});
