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
  let steady = 0;
  for (let i = 0; i < 60; i++) {
    const now = await count();
    // Three readings, not one: the shared document streams in, and a single
    // plateau between batches looks exactly like the end of the load.
    steady = now >= 0 && now === last ? steady + 1 : 0;
    if (steady >= 3) return;
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
  const shell = page.locator(`[data-doc-embed]:has(iframe[src="${EXPECTED_SRC}"])`);
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

test('the Link control adds a Google file, and rejects what it cannot open', async ({
  page,
}) => {
  await openBoard(page);
  await settle(page);

  await page.getByRole('button', { name: 'Link' }).click();
  const field = page.locator('#board-link-input');
  await expect(field).toBeFocused();

  // Something the board cannot open is refused, and says what it takes.
  await field.fill('https://example.com/notes.pdf');
  await page.getByRole('button', { name: /Add live view/ }).click();
  await expect(page.getByText(/cannot be opened on the board/i)).toBeVisible();
  await expect(page.locator('#board-link-input')).toBeVisible(); // panel stays open

  // A real Google link lands on the board.
  const url = `https://docs.google.com/presentation/d/CTRL${Date.now() % 1000000}/edit`;
  await field.fill(url);
  await page.getByRole('button', { name: /Add live view/ }).click();
  await expect
    .poll(() => embeds(page).then((e) => e.filter((x) => x.link === url).length), {
      timeout: 20_000,
    })
    .toBe(1);
  await expect(page.locator('#board-link-input')).toHaveCount(0); // panel closed

  const made = (await embeds(page)).find((e) => e.link === url)!;
  // Slides embeds at /embed, not /preview. Scoped to this run's own id, since
  // the board is shared and may already carry other decks.
  const src = url.replace('/edit', '/embed');
  await expect(page.locator(`iframe[src="${src}"]`)).toHaveCount(1, {
    timeout: 20_000,
  });

  await page.evaluate((id) => {
    const api = window.__livetichBoard;
    if (!api) return;
    api.updateScene({
      elements: api
        .getSceneElements()
        .map((el) => (el.id === id ? { ...el, isDeleted: true } : el)),
    });
  }, made.id);
  await page.waitForTimeout(2000);
});
