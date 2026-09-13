import { test, expect, type Page } from '@playwright/test';

// Same convention as board-tools.spec.ts: override when the seed is rebuilt.
//   LIVE_SESSION=<id> npx playwright test
const LIVE_SESSION = process.env.LIVE_SESSION ?? 'cmtu8bru50005vi7gvmrogb4a';

// Unique per run: the board persists, so counting elements would race the
// initial sync and a fixed id could collide with a previous run's leftovers.
const DOC_ID = `TESTdoc${Date.now() % 1000000}`;
const PASTED = `https://docs.google.com/document/d/${DOC_ID}/edit?usp=sharing`;
const EXPECTED_SRC = `https://docs.google.com/document/d/${DOC_ID}/preview`;

async function openBoard(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.getByRole('button', { name: /^chalkboard$/i }).click();
  await expect(page.locator('.excalidraw-container').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.excalidraw-container canvas').first()).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Wait for the board to finish loading before acting on it.
 *
 * The canvas is visible well before the shared document has synced, and a
 * paste that lands in that window is dropped — Excalidraw is not ready to
 * receive it yet. Settling on a stable element count is what makes this
 * reliable; asserting on counts across that boundary is not.
 */
async function settle(page: Page) {
  const count = () =>
    page.evaluate(() => window.__livetichBoard?.getSceneElements().length ?? -1);
  let last = -2;
  for (let i = 0; i < 40; i++) {
    const now = await count();
    if (now >= 0 && now === last) return;
    last = now;
    await page.waitForTimeout(500);
  }
}

const embeds = (page: Page) =>
  page.evaluate(() =>
    (window.__livetichBoard?.getSceneElements() ?? [])
      .filter((el) => el.type === 'embeddable')
      .map((el) => ({ id: el.id, link: el.link ?? null })),
  );

test('pasting a Google Docs link puts the doc on the board', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openBoard(page);
  await settle(page);

  const box = (await page.locator('.excalidraw-container').first().boundingBox())!;

  // Paste the link exactly as it comes off the Google address bar.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate((url) => navigator.clipboard.writeText(url), PASTED);
  await page.keyboard.press('ControlOrMeta+V');

  // Excalidraw only creates an embeddable if validateEmbeddable accepted it;
  // without that it would paste the URL as a text element.
  await expect
    .poll(() => embeds(page).then((e) => e.filter((x) => x.link === PASTED).length), {
      timeout: 20_000,
    })
    .toBe(1);
  const created = (await embeds(page)).find((e) => e.link === PASTED)!;

  // ...and it renders through our viewer, pointed at the embeddable form.
  const frame = page.locator(`iframe[src="${EXPECTED_SRC}"]`);
  await expect(frame).toHaveCount(1, { timeout: 20_000 });
  // Scoped to this run's own embed: the board may already carry others.
  const shell = page.locator(`div:has(> iframe[src="${EXPECTED_SRC}"])`).last();
  await expect(shell.getByText('Google Doc', { exact: true })).toBeVisible();
  await expect(shell.getByText('read-only', { exact: true })).toBeVisible();

  // Leave the shared board as it was found.
  await page.evaluate((id) => {
    const api = window.__livetichBoard;
    if (!api) return;
    api.updateScene({
      elements: api
        .getSceneElements()
        .map((el) => (el.id === id ? { ...el, isDeleted: true } : el)),
    });
  }, created.id);
  await page.waitForTimeout(2000);
});
