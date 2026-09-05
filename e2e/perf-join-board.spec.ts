import { test, expect, type Page } from '@playwright/test';

// Bugs #3/#4: measure how long joining a live session and first-loading the
// board actually take (instructor). Not a pass/fail — it logs milestones so we
// can see where the time goes.
const LIVE_SESSION = 'cmtfiqi9y0001vilcs0gefpq4';

test('measure: join session + first board load (instructor)', async ({ page }) => {
  test.setTimeout(120_000);

  // Capture timing of the key connection requests.
  const net: string[] = [];
  const startWall = Date.now();
  page.on('requestfinished', (req) => {
    const url = req.url();
    if (/realtime-token|socket\.io|livekit|\/board|rtc|twirp/i.test(url)) {
      let dur = -1;
      try {
        const t = req.timing();
        dur = t.responseEnd >= 0 ? Math.round(t.responseEnd - t.requestStart) : -1;
      } catch {
        /* ignore */
      }
      net.push(`+${((Date.now() - startWall) / 1000).toFixed(1)}s  ${dur}ms  ${url.replace(/\?.*/, '').slice(0, 70)}`);
    }
  });

  // ---- Join timing ----
  const t0 = Date.now();
  await page.goto(`/sessions/${LIVE_SESSION}`, { waitUntil: 'commit' });
  const domContentLoaded = Date.now();

  // Classroom shell mounted (a stable control on the top bar).
  await expect(page.getByRole('button', { name: /toggle people/i })).toBeVisible({ timeout: 40_000 });
  const shellReady = Date.now();

  // "Connected" indicator (room socket connected).
  const connected = page.getByText(/^connected$/i).first();
  await connected.isVisible().catch(() => false);
  await page.waitForFunction(() => !!document.body.innerText.match(/connected/i), null, { timeout: 40_000 }).catch(() => {});
  const socketConnected = Date.now();

  // ---- Board first-load timing ----
  const tBoardClick = Date.now();
  await page.getByRole('button', { name: /^chalkboard$/i }).click();
  await expect(page.locator('.tl-container').first()).toBeVisible({ timeout: 40_000 });
  await expect(page.locator('.tl-container canvas').first()).toBeVisible({ timeout: 40_000 });
  const boardReady = Date.now();

  const ms = (a: number, b: number) => `${((b - a) / 1000).toFixed(1)}s`;
  console.log('===== TIMINGS (instructor) =====');
  console.log(`nav→domCommit:        ${ms(t0, domContentLoaded)}`);
  console.log(`nav→classroom shell:  ${ms(t0, shellReady)}`);
  console.log(`nav→socket connected: ${ms(t0, socketConnected)}`);
  console.log(`JOIN total (nav→ready): ${ms(t0, socketConnected)}`);
  console.log(`BOARD first load (click→canvas): ${ms(tBoardClick, boardReady)}`);
  console.log('----- key requests (time since nav / duration) -----');
  for (const line of net.slice(0, 30)) console.log(line);

  // ---- Leave timing ----
  const leaveBtn = page.getByRole('button', { name: /^leave$/i }).first();
  if (await leaveBtn.isVisible().catch(() => false)) {
    const tLeave = Date.now();
    await leaveBtn.click().catch(() => {});
    await page.waitForURL((u) => !u.pathname.startsWith('/sessions/'), { timeout: 40_000 }).catch(() => {});
    console.log(`LEAVE (click→navigated away): ${ms(tLeave, Date.now())}`);
  }
});
