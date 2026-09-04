import { test, expect, type Page } from '@playwright/test';

// Verifies the three new chalkboard features against the real stack:
//  1. Full-screen toggle (CSS overlay) enters/exits.
//  2. Export menu offers this-page / all-pages PDF + PNG, and a PDF actually
//     downloads (the A4 export path runs end-to-end without throwing).
//  3. "Start buzzer" opens a modal (picker when questions exist, else create).
const LIVE_SESSION = 'cmtfiqi9y0001vilcs0gefpq4';
const INSTRUCTOR_STATE = 'e2e/.auth/instructor.json';

test.use({ storageState: INSTRUCTOR_STATE });

async function openBoard(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.getByRole('button', { name: /^chalkboard$/i }).click();
  await expect(page.locator('.tl-container').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.tl-container canvas').first()).toBeVisible({ timeout: 20_000 });
}

async function drawStroke(page: Page) {
  const box = await page.locator('.tl-container').first().boundingBox();
  if (!box) throw new Error('no board bounds');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.getByTestId('tools.draw').click();
  await page.mouse.move(cx - 60, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 30, { steps: 4 });
  await page.mouse.move(cx + 60, cy, { steps: 4 });
  await page.mouse.up();
}

test('full-screen toggle enters and exits', async ({ page }) => {
  test.setTimeout(90_000);
  await openBoard(page);

  const fsBtn = page.getByRole('button', { name: 'Full screen' });
  await expect(fsBtn).toBeVisible();
  await fsBtn.click();
  // Exit control now shows (the board wrapper is a fixed full-screen overlay).
  await expect(page.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Full screen' })).toBeVisible();
});

test('export menu offers this-page / all-pages PDF + PNG and a PDF downloads', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openBoard(page);
  await drawStroke(page);

  await page.getByRole('button', { name: /export/i }).click();
  await expect(page.getByRole('menuitem', { name: /PDF — this page/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /PDF — all pages/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /PNG image/i })).toBeVisible();

  const download = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('menuitem', { name: /PDF — this page/i }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
});

test('"Start buzzer" opens a modal', async ({ page }) => {
  test.setTimeout(90_000);
  await openBoard(page);
  // The Start-buzzer control lives in the bottom dock.
  await page.getByRole('button', { name: /start buzzer/i }).click();
  // Either the picker ("Start a buzzer round") or the create modal ("New buzzer
  // question") — both are dialogs — must appear.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
});
