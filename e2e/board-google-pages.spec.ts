import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';

// Same convention as board-tools.spec.ts: override when the seed is rebuilt.
//   LIVE_SESSION=<id> npx playwright test
const LIVE_SESSION = process.env.LIVE_SESSION ?? 'cmtu8bru50005vi7gvmrogb4a';

const DOC = `https://docs.google.com/document/d/PAGES${Date.now() % 1000000}/edit`;

async function openBoard(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.getByRole('button', { name: /^chalkboard$/i }).click();
  await expect(page.locator('.excalidraw-container canvas').first()).toBeVisible({
    timeout: 20_000,
  });
}

/** The canvas is visible well before the shared document has synced. */
async function settle(page: Page) {
  const count = () =>
    page.evaluate(() => window.__livetichBoard?.getSceneElements().length ?? -1);
  let last = -2;
  let steady = 0;
  for (let i = 0; i < 60; i++) {
    const now = await count();
    steady = now >= 0 && now === last ? steady + 1 : 0;
    if (steady >= 3) return;
    last = now;
    await page.waitForTimeout(500);
  }
}

const images = (page: Page) =>
  page.evaluate(
    () =>
      (window.__livetichBoard?.getSceneElements() ?? []).filter(
        (el) => el.type === 'image',
      ).length,
  );

/**
 * The client half of importing a Google file as pages.
 *
 * The API's fetch of Google is stubbed with a real PDF: whether a particular
 * file is shared is Google's business, and cannot be arranged from a test. What
 * is ours is everything after the response — that the PDF becomes page images
 * on the board, which is what makes it scroll in step and take annotation.
 */
test('a Google file imports as page images', async ({ page }) => {
  const pdf = fs.readFileSync('e2e/fixtures/sample-doc.pdf');

  await page.route('**/board-google-import', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: pdf,
    }),
  );

  await openBoard(page);
  await settle(page);
  const before = await images(page);

  await page.getByRole('button', { name: 'Link' }).click();
  await page.locator('#board-link-input').fill(DOC);
  await page.getByRole('button', { name: /Add as pages/ }).click();

  // Every page of the PDF lands as its own image element.
  await expect
    .poll(() => images(page), { timeout: 60_000 })
    .toBeGreaterThan(before);
  await expect(page.locator('#board-link-input')).toHaveCount(0);

  // They are ordinary board content — not an iframe — which is the whole point:
  // the follow mechanism carries them and they can be drawn on.
  await expect(page.locator(`iframe[src*="${DOC.split('/d/')[1].split('/')[0]}"]`)).toHaveCount(0);

  const added = (await images(page)) - before;
  console.log(`>> imported ${added} page image(s)`);

  // Leave the shared board as it was found.
  await page.evaluate((n) => {
    const api = window.__livetichBoard;
    if (!api) return;
    const els = api.getSceneElements();
    const imgs = els.filter((e) => e.type === 'image');
    const doomed = new Set(imgs.slice(-n).map((e) => e.id));
    api.updateScene({
      elements: els.map((e) => (doomed.has(e.id) ? { ...e, isDeleted: true } : e)),
    });
  }, added);
  await page.waitForTimeout(2500);
});

/** A link the importer cannot handle is refused in the panel, by name. */
test('an unimportable link is refused without leaving the panel', async ({ page }) => {
  await openBoard(page);
  await settle(page);

  await page.getByRole('button', { name: 'Link' }).click();
  await page.locator('#board-link-input').fill('https://example.com/notes.pdf');
  await page.getByRole('button', { name: /Add as pages/ }).click();

  await expect(page.getByText(/cannot be imported/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#board-link-input')).toBeVisible();
});
