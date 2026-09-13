import { test, expect, type Page } from '@playwright/test';
// Sessions are per-class rows, so this id goes stale whenever the local seed is
// rebuilt — override it without editing the spec:
//   LIVE_SESSION=<id> npx playwright test
const LIVE_SESSION = process.env.LIVE_SESSION ?? 'cmtu8bru50005vi7gvmrogb4a';

// The buzzer's question tone is a recorded file on a loop for as long as the
// round is open; the tone that closes a round is still the synthesised
// descending cue. Both facts are load-bearing, and neither is visible in the
// DOM — so this asserts on the Web Audio graph itself.
type Spy = { buffers: { loop: boolean; dur: number }[]; stops: number; oscs: number };

// Spy on the audio graph itself, not on our own code: recorded tones become
// AudioBufferSourceNodes, the synthesised cues become OscillatorNodes.
async function spy(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __tones: Spy };
    w.__tones = { buffers: [], stops: 0, oscs: 0 };
    const bs = AudioBufferSourceNode.prototype;
    const bufStart = bs.start;
    const bufStop = bs.stop;
    bs.start = function (
      this: AudioBufferSourceNode,
      when?: number,
      offset?: number,
      duration?: number,
    ) {
      w.__tones.buffers.push({ loop: this.loop, dur: this.buffer?.duration ?? -1 });
      return bufStart.call(this, when, offset, duration);
    };
    bs.stop = function (this: AudioBufferSourceNode, when?: number) {
      w.__tones.stops++;
      return bufStop.call(this, when);
    };
    const oscStart = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, when?: number) {
      w.__tones.oscs++;
      return oscStart.call(this, when);
    };
  });
}
const tones = (page: Page) => page.evaluate(() => (window as unknown as { __tones: Spy }).__tones);

test('buzzer tone loops while the question is up, stops when it closes', async ({ page, browser }) => {
  test.setTimeout(200_000);
  // The gateway refuses a round with nobody to quiz, so put a student in the room.
  const studentCtx = await browser.newContext({ storageState: 'e2e/.auth/student.json' });
  const student = await studentCtx.newPage();
  await student.goto(`http://localhost:3001/sessions/${LIVE_SESSION}`);
  await student.mouse.click(5, 5);
  await student.waitForTimeout(6000);

  await spy(page);
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await page.mouse.click(5, 5); // a real gesture: unlocks audio and primes the tones
  await page.waitForTimeout(6000);

  await page.locator('[title="Start a buzzer round"]').first().click();
  await page.locator('button:has-text("Start ▸")').first().click();

  // The question tone: one looping source, the 9.3s asset, still running.
  // The question tone: one source, flagged to loop, holding the whole asset.
  // `loop` is the proof that it repeats — no wall-clock assertion needed, and
  // racing the round's own countdown to prove it would only be flaky.
  await expect
    .poll(async () => (await tones(page)).buffers.filter((b) => b.loop).length, {
      timeout: 30_000,
    })
    .toBe(1);
  const open = await tones(page);
  console.log('  >> OPEN  ' + JSON.stringify(open));
  expect(open.buffers.filter((b) => b.loop)[0].dur).toBeGreaterThan(8);
  // The old one-shot buzz is gone: nothing synthesised fires on open.
  expect(open.oscs).toBe(0);
  expect(open.stops).toBe(0);

  // Time runs out: loop stops, and the synthesised dying tone still fires.
  // Time runs out (the round carries its own limit): the loop is stopped and
  // the synthesised dying tone plays.
  await expect
    .poll(async () => (await tones(page)).stops, { timeout: 90_000 })
    .toBeGreaterThan(0);
  const closed = await tones(page);
  console.log('  >> CLOSED stops=' + closed.stops + ' oscillators=' + closed.oscs);
  expect(closed.oscs).toBeGreaterThan(0);
  await studentCtx.close();
});
