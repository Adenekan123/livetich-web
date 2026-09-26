import { test, expect, type Page, type Browser } from '@playwright/test';
import { authFile } from './global-setup';

// Same convention as board-tools.spec.ts: override when the seed is rebuilt.
//   LIVE_SESSION=<id> npx playwright test
const LIVE_SESSION = process.env.LIVE_SESSION ?? 'cmtu8bru50005vi7gvmrogb4a';

/** Must outlast REFOLLOW_GRACE_MS in board-excalidraw.tsx. */
const PAST_GRACE_MS = 7500;

/**
 * Open the board as one role.
 *
 * The instructor reaches it through the Chalkboard panel; a student is put on
 * it directly with no such button — worth stating, because a helper that
 * clicks Chalkboard for both simply times out for the student.
 */
async function board(browser: Browser, role: 'instructor' | 'student'): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile(role) });
  const page = await ctx.newPage();
  await page.goto(`/sessions/${LIVE_SESSION}`);
  if (role === 'instructor') {
    await page.getByRole('button', { name: /^chalkboard$/i }).click();
  }
  await expect(page.locator('.excalidraw-container canvas').first()).toBeVisible({
    timeout: 25_000,
  });
  await page.waitForTimeout(5000);
  return page;
}

const cam = (p: Page) =>
  p.evaluate(() => {
    const s = window.__livetichBoard?.getAppState();
    return s ? { x: Math.round(s.scrollX), y: Math.round(s.scrollY) } : null;
  });

/** The follow pill's text — the viewer's own account of its state. */
const followLabel = (p: Page) =>
  p.evaluate(
    () =>
      [...document.querySelectorAll('button')]
        .map((b) => b.textContent?.trim() ?? '')
        .find((t) => /instructor/i.test(t)) ?? 'none',
  );

async function scroll(p: Page, times: number) {
  const box = (await p.locator('.excalidraw-container').first().boundingBox())!;
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < times; i++) {
    await p.mouse.wheel(0, 260);
    await p.waitForTimeout(160);
  }
}

const moved = (a: { x: number; y: number } | null, b: { x: number; y: number } | null) =>
  a && b ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : 0;

test("a student follows the instructor's camera", async ({ browser }) => {
  test.setTimeout(240_000);
  const teacher = await board(browser, 'instructor');
  const student = await board(browser, 'student');

  expect(await followLabel(student)).toBe('Following instructor');

  // Frame the whole board first. This is the state the drift needed: zoomed
  // out far enough that the viewport runs past the content, so the follower's
  // region gets clipped and starts shrinking as the instructor scrolls.
  await teacher.evaluate(() =>
    window.__livetichBoard!.scrollToContent(undefined, { fitToContent: true }),
  );
  await teacher.waitForTimeout(2500);

  // Step by step, because the defect was a *rate*: the follower moved at half
  // the instructor's speed and fell further behind on every scroll. Totals hide
  // that — the student does move, just never as far — so each step is compared
  // on its own, with time to settle between them.
  const box = (await teacher.locator('.excalidraw-container').first().boundingBox())!;
  await teacher.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  let tPrev = await cam(teacher);
  let sPrev = await cam(student);
  for (let step = 0; step < 3; step++) {
    await teacher.mouse.wheel(0, 120);
    await teacher.waitForTimeout(1800);
    const tNow = await cam(teacher);
    const sNow = await cam(student);
    const tStep = moved(tPrev, tNow);
    const sStep = moved(sPrev, sNow);
    expect(tStep, 'the instructor should have moved').toBeGreaterThan(20);
    expect(
      Math.abs(tStep - sStep),
      `step ${step}: instructor moved ${tStep}, student ${sStep}`,
    ).toBeLessThan(Math.max(40, tStep * 0.15));
    tPrev = tNow;
    sPrev = sNow;
  }

  // --- the case that was broken ---
  // A student nudges the board themselves. That detaches them, which is the
  // point: they are looking at something.
  await scroll(student, 2);
  await student.waitForTimeout(1000);
  expect(await followLabel(student)).toBe("Back to instructor's view");

  // While they are still navigating, the instructor's move must leave them be.
  const parked = await cam(student);
  await scroll(teacher, 4);
  await teacher.waitForTimeout(2500);
  expect(moved(parked, await cam(student)), 'a viewer mid-navigation is left alone').toBe(0);

  // Once they have gone quiet, the instructor's next move brings them back.
  // Before this, one nudge of a wheel stranded a student for the rest of the
  // lesson unless they spotted a small pill.
  await student.waitForTimeout(PAST_GRACE_MS);
  const before = await cam(student);
  await scroll(teacher, 4);
  await expect
    .poll(async () => moved(before, await cam(student)), { timeout: 30_000 })
    .toBeGreaterThan(20);
  expect(await followLabel(student)).toBe('Following instructor');

  await teacher.context().close();
  await student.context().close();
});
