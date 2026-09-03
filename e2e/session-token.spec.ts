import { test, expect, type Page } from '@playwright/test';

// Regression cover for the "invalid token" / "Video unavailable" pop-up on join.
// Root cause was a client token cache (25m) that outlived the realtime token
// (15m), so a (re)connect replayed an expired token. Fix: cache < token TTL, and
// the room socket now self-heals a rejected token (drop it + re-open) instead of
// sticking, since Socket.IO won't auto-reconnect a server-initiated disconnect.
//
// Assumes the seeded LIVE session (status=LIVE renders ClassRoom) — same one the
// board specs use — owned by the seed instructor, with the seed student enrolled.
const LIVE_SESSION = 'cmtfiqi9y0001vilcs0gefpq4';
const STUDENT_STATE = 'e2e/.auth/student.json';

// The top-bar connection pill reads "Connected" once the room socket authed.
const connectedPill = (p: Page) => p.getByText(/^Connected$/);
const invalidTokenToast = (p: Page) => p.getByText(/invalid token/i);

async function reachesClassroom(p: Page) {
  await expect(p.getByRole('button', { name: /toggle people/i })).toBeVisible({
    timeout: 20_000,
  });
}

test.describe('live session join — realtime token', () => {
  test('instructor joins with no "invalid token" pop-up and the socket connects', async ({
    page,
  }) => {
    await page.goto(`/sessions/${LIVE_SESSION}`);
    await reachesClassroom(page);
    await expect(connectedPill(page)).toBeVisible({ timeout: 20_000 });
    await expect(invalidTokenToast(page)).toHaveCount(0);
  });

  test('student joins with no "invalid token" pop-up and the socket connects', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: STUDENT_STATE });
    const page = await ctx.newPage();
    try {
      await page.goto(`/sessions/${LIVE_SESSION}`);
      await reachesClassroom(page);
      await expect(connectedPill(page)).toBeVisible({ timeout: 20_000 });
      await expect(invalidTokenToast(page)).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  test('a stale realtime token self-heals instead of sticking on "invalid token"', async ({
    page,
  }) => {
    // Hand out a bad realtime token for the first ~900ms so the room socket's
    // auth is rejected at least once, then let real tokens through. The room
    // should drop the stale token, re-open the socket, and reach "Connected"
    // without leaving the invalid-token toast up.
    let firstAt = 0;
    await page.route('**/api/realtime-token', async (route) => {
      if (!firstAt) firstAt = Date.now();
      if (Date.now() - firstAt < 900) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ token: 'stale.invalid.token' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/sessions/${LIVE_SESSION}`);
    await reachesClassroom(page);

    // Recovers: the socket reconnects with a freshly-fetched token…
    await expect(connectedPill(page)).toBeVisible({ timeout: 25_000 });
    // …and the self-heal is silent — no lingering "invalid token" pop-up.
    await expect(invalidTokenToast(page)).toHaveCount(0);
  });
});
