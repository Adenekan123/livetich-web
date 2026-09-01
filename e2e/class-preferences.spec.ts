import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Drives the class-preferences UI as an ORG_ADMIN (who also manages courses).
// Admin auth is a minted JWT injected as the httpOnly `lt_token` cookie — the
// same seam the batch-flow spec uses. The API-repo helper also seeds/cleans the
// held quiz used by the release test and resets org prefs afterwards.
const API_REPO = path.resolve(process.cwd(), '..', 'livetich-api');
const HELPER = path.join(API_REPO, 'test', 'e2e-admin-helper.mjs');
const BASE = 'http://localhost:3001';

interface Setup {
  adminToken: string;
  programId: string;
  programTitle: string;
}

function helper(args: string[] = []): string {
  return execFileSync('node', [HELPER, ...args], { cwd: API_REPO }).toString();
}

async function adminContext(browser: import('@playwright/test').Browser, token: string) {
  const ctx = await browser.newContext({ baseURL: BASE });
  await ctx.addCookies([
    {
      name: 'lt_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    },
  ]);
  return ctx;
}

test.describe('class preferences', () => {
  let setup: Setup;

  test.beforeAll(() => {
    setup = JSON.parse(helper()) as Setup;
  });

  test.afterAll(() => {
    try {
      helper(['--reset-prefs']);
    } catch {
      /* best effort */
    }
  });

  test('admin toggles org class preferences and they persist', async ({ browser }) => {
    const admin = await adminContext(browser, setup.adminToken);
    const ap = await admin.newPage();
    await ap.goto('/account/preferences');

    const mic = ap.locator('input[name="micRequiresRaisedHand"]');
    const evict = ap.locator('input[name="evictOnInstructorLeave"]');
    const lead = ap.locator('#reminderLeadMinutes');
    await expect(mic).toBeVisible();

    // Turn both toggles ON and set a distinct lead time.
    if (!(await mic.isChecked())) await mic.check({ force: true });
    if (!(await evict.isChecked())) await evict.check({ force: true });
    await lead.fill('45');

    await ap.getByRole('button', { name: /save preferences/i }).click();
    await expect(ap.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });

    // The toggles must NOT snap back after saving (the form-reset bug). Assert
    // they hold their new values immediately, before any reload.
    await expect(mic).toBeChecked();
    await expect(evict).toBeChecked();
    await expect(lead).toHaveValue('45');

    // Reload — the server re-renders from the DB, proving the save stuck.
    await ap.reload();
    await expect(ap.locator('input[name="micRequiresRaisedHand"]')).toBeChecked();
    await expect(ap.locator('input[name="evictOnInstructorLeave"]')).toBeChecked();
    await expect(ap.locator('#reminderLeadMinutes')).toHaveValue('45');

    await admin.close();
  });

  test('instructor holds the class-end quiz, then releases a held one', async ({
    browser,
  }) => {
    // A held quiz to release (an ENDED session + unreleased Assessment).
    let held: { assessmentId: string };
    try {
      held = JSON.parse(helper(['--seed-held', setup.programId]));
    } catch (e) {
      test.skip(true, `could not seed a held quiz: ${String(e)}`);
      return;
    }

    const admin = await adminContext(browser, setup.adminToken);
    const ap = await admin.newPage();
    try {
      await ap.goto(`/courses/${setup.programId}/assessment`);

      // The Release card's instant toggle (the checkbox beside its label).
      const instant = ap
        .locator('label', { hasText: /release the quiz instantly/i })
        .locator('input[type="checkbox"]');
      await expect(instant).toBeVisible();

      // Flip instant OFF and confirm it persists across a reload.
      if (await instant.isChecked()) {
        await instant.uncheck({ force: true });
        // the toggle fires a server action; wait for it to settle
        await ap.waitForTimeout(1500);
        await ap.reload();
        await expect(
          ap
            .locator('label', { hasText: /release the quiz instantly/i })
            .locator('input[type="checkbox"]'),
        ).not.toBeChecked();
      }

      // The seeded held quiz shows with a Release button.
      const heldSection = ap.locator('text=/held quizzes/i');
      await expect(heldSection).toBeVisible({ timeout: 10_000 });
      const releaseBtn = ap.getByRole('button', { name: /^release$/i }).first();
      await expect(releaseBtn).toBeVisible();

      // Release it — the row (and the section, now empty) disappears.
      await releaseBtn.click();
      await expect(ap.locator('text=/held quizzes/i')).toBeHidden({
        timeout: 10_000,
      });

      // Put the course preference back to instant.
      const instant2 = ap
        .locator('label', { hasText: /release the quiz instantly/i })
        .locator('input[type="checkbox"]');
      if (!(await instant2.isChecked())) {
        await instant2.check({ force: true });
        await ap.waitForTimeout(1000);
      }
    } finally {
      await admin.close();
      try {
        helper(['--cleanup-held']);
      } catch {
        /* best effort */
      }
    }
  });

  test('ending class evicts students when the org enables it', async ({ browser }) => {
    helper(['--evict-on']);
    const { sessionId, courseId } = JSON.parse(
      helper(['--seed-live', setup.programId]),
    ) as { sessionId: string; courseId: string };

    const teacherCtx = await browser.newContext({
      baseURL: BASE,
      storageState: 'e2e/.auth/instructor.json',
    });
    const studentCtx = await browser.newContext({
      baseURL: BASE,
      storageState: 'e2e/.auth/student.json',
    });
    try {
      // Instructor enters the (seeded, live) room.
      const teacher = await teacherCtx.newPage();
      await teacher.goto(`/sessions/${sessionId}`);
      await expect(
        teacher.getByRole('button', { name: /end class/i }).first(),
      ).toBeVisible({ timeout: 20_000 });

      // Student enters the same room and reaches the classroom (not "ended").
      const student = await studentCtx.newPage();
      await student.goto(`/sessions/${sessionId}`);
      await expect(student.getByText(/this class has ended/i)).toHaveCount(0);
      await expect(
        student.getByRole('button', { name: /^leave$/i }),
      ).toBeVisible({ timeout: 20_000 });
      // Let the student's socket finish room:join before the room closes.
      await student.waitForTimeout(2000);

      // Instructor ends the class (trigger → confirm dialog).
      await teacher.getByRole('button', { name: /end class/i }).first().click();
      const dialog = teacher.getByRole('dialog', { name: /end class/i });
      await dialog.getByRole('button', { name: /^end class$/i }).click();

      // The `room:closed` event evicts the student back to the program page.
      await expect(student).toHaveURL(new RegExp(`/courses/${courseId}$`), {
        timeout: 20_000,
      });
    } finally {
      await teacherCtx.close();
      await studentCtx.close();
      try {
        helper(['--cleanup-live']);
      } catch {
        /* best effort */
      }
      try {
        helper(['--evict-off']);
      } catch {
        /* best effort */
      }
    }
  });
});
