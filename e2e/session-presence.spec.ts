import { test, expect, type Page, type Browser } from '@playwright/test';

// Regression cover for: a student sees "Your instructor will join you soon"
// even though the instructor is present. Root cause was presence being keyed by
// userId in Redis, so when the instructor's socket reconnected, the OLD socket's
// disconnect (firing after the NEW one re-joined) ran `hdel(userId)` and erased
// the fresh presence for everyone. Fix: on disconnect, keep presence/hands if
// the same user still has another live socket in the room.
//
// Uses the seeded LIVE session (renders ClassRoom) owned by the seed instructor,
// with the seed student enrolled — same fixture the board/token specs use.
const LIVE_SESSION = 'cmtfiqi9y0001vilcs0gefpq4';
const INSTRUCTOR_STATE = 'e2e/.auth/instructor.json';
const STUDENT_STATE = 'e2e/.auth/student.json';

const waitingOverlay = (p: Page) => p.getByText(/your instructor will join/i);

async function reachesClassroom(p: Page) {
  await expect(p.getByRole('button', { name: /toggle people/i })).toBeVisible({
    timeout: 20_000,
  });
}

/** Open the classroom as the instructor in its own context (its own socket). */
async function openInstructor(browser: Browser) {
  const ctx = await browser.newContext({ storageState: INSTRUCTOR_STATE });
  const page = await ctx.newPage();
  await page.goto(`/sessions/${LIVE_SESSION}`);
  await reachesClassroom(page);
  return { ctx, page };
}

test.describe('live session presence — instructor visibility', () => {
  test('student does not see "instructor will join soon" while the instructor is present', async ({
    browser,
  }) => {
    const instr = await openInstructor(browser);
    const studentCtx = await browser.newContext({ storageState: STUDENT_STATE });
    const student = await studentCtx.newPage();
    try {
      await student.goto(`/sessions/${LIVE_SESSION}`);
      await reachesClassroom(student);

      // Instructor present → the waiting overlay must not be shown.
      await expect(waitingOverlay(student)).toHaveCount(0);

      // …and the instructor shows in the student's People roster.
      await student.getByRole('button', { name: /toggle people/i }).click();
      await expect(student.getByText(/jeyson umer/i).first()).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await studentCtx.close();
      await instr.ctx.close();
    }
  });

  test('instructor presence survives one socket dropping while another remains (reconnect race)', async ({
    browser,
  }) => {
    // Two instructor sockets — the overlap a reconnect creates (or two tabs).
    const a = await openInstructor(browser);
    const b = await openInstructor(browser);

    const studentCtx = await browser.newContext({ storageState: STUDENT_STATE });
    const student = await studentCtx.newPage();
    try {
      await student.goto(`/sessions/${LIVE_SESSION}`);
      await reachesClassroom(student);
      await expect(waitingOverlay(student)).toHaveCount(0);

      // Drop one instructor socket. Presence is keyed by userId, so the naive
      // behaviour would erase the instructor for everyone — but the other socket
      // is still in the room, so presence must survive.
      await a.ctx.close();

      // Give the disconnect + presence re-broadcast time to land. If the fix
      // regressed, the overlay would appear here (instructor wrongly removed).
      await student.waitForTimeout(3000);
      await expect(waitingOverlay(student)).toHaveCount(0);

      // Belt-and-braces: the instructor is still in the student's roster.
      await student.getByRole('button', { name: /toggle people/i }).click();
      await expect(student.getByText(/jeyson umer/i).first()).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await studentCtx.close();
      await b.ctx.close();
    }
  });

  test('student DOES see the waiting overlay once the only instructor leaves (negative control)', async ({
    browser,
  }) => {
    // The mirror of the race test: with a single instructor socket and no other,
    // leaving correctly removes presence — proving the disconnect fires promptly
    // and the overlay is genuinely presence-driven (so the race test above isn't
    // a false positive).
    const instr = await openInstructor(browser);
    const studentCtx = await browser.newContext({ storageState: STUDENT_STATE });
    const student = await studentCtx.newPage();
    try {
      await student.goto(`/sessions/${LIVE_SESSION}`);
      await reachesClassroom(student);
      await expect(waitingOverlay(student)).toHaveCount(0);

      // The sole instructor leaves → no other socket for them → the student now
      // waits.
      await instr.ctx.close();
      await expect(waitingOverlay(student)).toBeVisible({ timeout: 15_000 });
    } finally {
      await studentCtx.close();
    }
  });
});
