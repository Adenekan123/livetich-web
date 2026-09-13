import { test, expect, type Page } from '@playwright/test';

// Same convention as board-tools.spec.ts: this id goes stale whenever the
// local seed is rebuilt, so override it rather than editing the spec.
//   LIVE_SESSION=<id> npx playwright test
const LIVE_SESSION = process.env.LIVE_SESSION ?? 'cmtu8bru50005vi7gvmrogb4a';

/** Every run writes its own equations, so a shared board that already holds
 *  other people's work cannot make this pass or fail by accident. */
const TAG = Date.now() % 100000;
const ORIGINAL = `M = \\frac{x_1 + ${TAG}}{8}`;
const EDITED = `M = \\frac{3 + ${TAG}}{8}`;
const REPLACED = `M = ${TAG}`;

async function openBoard(page: Page) {
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.getByRole('button', { name: /^chalkboard$/i }).click();
  await expect(page.locator('.excalidraw-container').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.excalidraw-container canvas').first()).toBeVisible({
    timeout: 20_000,
  });
}

interface MathEl {
  id: string;
  latex: string;
  x: number;
  y: number;
}

const mathEls = (page: Page): Promise<MathEl[]> =>
  page.evaluate(
    () =>
      (window.__livetichBoard?.getSceneElements() ?? [])
        .filter((el) => (el.customData as { livetichMath?: string })?.livetichMath)
        .map((el) => ({
          id: el.id,
          latex: (el.customData as { livetichMath: string }).livetichMath,
          x: el.x,
          y: el.y,
        })),
  );

/** Wait for the equation carrying this exact source, and hand it back. */
async function waitForMath(page: Page, latex: string): Promise<MathEl> {
  await expect
    .poll(() => mathEls(page).then((m) => m.filter((x) => x.latex === latex).length), {
      timeout: 25_000,
    })
    .toBe(1);
  return (await mathEls(page)).find((m) => m.latex === latex)!;
}

async function select(page: Page, id: string) {
  await page.evaluate((elId) => {
    window.__livetichBoard?.updateScene({
      appState: { selectedElementIds: { [elId]: true } },
    });
  }, id);
}

test('an imported equation can be edited and re-added', async ({ page }) => {
  await openBoard(page);

  // --- insert one ---
  await page.getByRole('button', { name: /^Math$/ }).click();
  await page.locator('#board-math-input').fill(ORIGINAL);
  await page.getByRole('button', { name: 'Add to board' }).click();
  const first = await waitForMath(page, ORIGINAL);

  // --- selecting it reveals Edit, loaded with its own source ---
  await select(page, first.id);
  const edit = page.getByRole('button', { name: 'Edit equation' });
  await expect(edit).toBeVisible({ timeout: 10_000 });
  await edit.click();
  await expect(page.locator('#board-math-input')).toHaveValue(ORIGINAL);

  // --- change a value, add it as the next line: original kept, new one below ---
  await page.locator('#board-math-input').fill(EDITED);
  await page.getByRole('button', { name: 'Add as a new line' }).click();
  const added = await waitForMath(page, EDITED);
  expect(added.y, 'the next step lands under the one it came from').toBeGreaterThan(
    first.y,
  );
  expect(added.x).toBeCloseTo(first.x, 1);
  await waitForMath(page, ORIGINAL); // the original survives

  // --- replace rewrites in place: same element, same spot, new source ---
  await select(page, added.id);
  await page.getByRole('button', { name: 'Edit equation' }).click();
  await page.locator('#board-math-input').fill(REPLACED);
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  const replaced = await waitForMath(page, REPLACED);
  expect(replaced.id, 'replace must edit, not add').toBe(added.id);
  expect(replaced.x).toBeCloseTo(added.x, 1);
  expect(replaced.y).toBeCloseTo(added.y, 1);
  expect(
    (await mathEls(page)).some((m) => m.latex === EDITED),
    'the replaced source is gone',
  ).toBe(false);

  // Leave the shared board as it was found.
  await page.evaluate(
    (ids) => {
      const api = window.__livetichBoard;
      if (!api) return;
      api.updateScene({
        elements: api
          .getSceneElements()
          .map((el) => (ids.includes(el.id) ? { ...el, isDeleted: true } : el)),
      });
    },
    [first.id, added.id],
  );
});
