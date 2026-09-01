import { test, expect, type Page, devices } from '@playwright/test';

// Verifies the recent live-classroom board commits against the real stack
// (web :3001 + API :3000 + WS gateway). Seeded users share password123.
// The leftover LIVE session found in the dev DB (status=LIVE renders ClassRoom).
const LIVE_SESSION = 'cmtfiqi9y0001vilcs0gefpq4';
const INSTRUCTOR_STATE = 'e2e/.auth/instructor.json';
const STUDENT_STATE = 'e2e/.auth/student.json';

// Collect only genuine page errors / console.error (ignore benign noise).
function trackErrors(page: Page, sink: string[]) {
  page.on('pageerror', (e) => sink.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (/favicon|ResizeObserver|Download the React DevTools|hydrat/i.test(t)) return;
      sink.push(`console.error: ${t}`);
    }
  });
}

test('instructor opens the live classroom board without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  trackErrors(page, errors);

  await page.goto(`/sessions/${LIVE_SESSION}`);

  // Must not bounce to /login (auth) or 404 (wrong org/owner).
  await expect(page).toHaveURL(new RegExp(`/sessions/${LIVE_SESSION}`));
  await expect(page.getByText(/this class has ended/i)).toHaveCount(0);

  // ClassRoom mounted: the people toggle is a stable control on the top bar.
  await expect(page.getByRole('button', { name: /toggle people/i })).toBeVisible({
    timeout: 20_000,
  });

  // The room opens on the Qur'an/Hifz panel; switch to the board explicitly.
  await page.getByRole('button', { name: /^chalkboard$/i }).click();

  // The board canvas (tldraw) should now mount.
  await expect(page.locator('.tl-container, canvas').first()).toBeVisible({
    timeout: 20_000,
  });

  expect(errors, `runtime errors:\n${errors.join('\n')}`).toEqual([]);
});

test('mobile student joins the same live session and reaches the classroom', async ({
  browser,
}) => {
  // Presenter (desktop instructor).
  const teacherCtx = await browser.newContext({ storageState: INSTRUCTOR_STATE });
  const teacher = await teacherCtx.newPage();
  await teacher.goto(`/sessions/${LIVE_SESSION}`);
  await expect(teacher.getByRole('button', { name: /toggle people/i })).toBeVisible({
    timeout: 20_000,
  });
  // Presenter drives the board so the student has something to mirror.
  await teacher.getByRole('button', { name: /^chalkboard$/i }).click();

  // Student on a phone viewport — the surface the recent mobile fixes target.
  const studentCtx = await browser.newContext({
    ...devices['Pixel 7'],
    storageState: STUDENT_STATE,
  });
  const student = await studentCtx.newPage();
  const studentErrors: string[] = [];
  trackErrors(student, studentErrors);
  await student.goto(`/sessions/${LIVE_SESSION}`);

  // Student must reach the classroom (not /login, not "ended").
  await expect(student).toHaveURL(new RegExp(`/sessions/${LIVE_SESSION}`));
  await expect(student.getByText(/this class has ended/i)).toHaveCount(0);

  // Classroom mounted on mobile: the reflowed footer shows Leave + a "More
  // controls" menu (this reflow is one of the recent mobile fixes).
  await expect(student.getByRole('button', { name: /^leave$/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(student.getByRole('button', { name: /more controls/i })).toBeVisible();

  // Presence via the WS gateway: the student's roster lists both participants
  // (the presenter "jeyson umer" and the student themselves).
  await expect(student.getByText(/jeyson umer/i).first()).toBeVisible({
    timeout: 20_000,
  });

  // Mirroring/follow state: the student is following the presenter's view.
  await expect(student.getByText(/following/i).first()).toBeVisible({
    timeout: 20_000,
  });

  expect(studentErrors, `student runtime errors:\n${studentErrors.join('\n')}`).toEqual(
    [],
  );

  await student.screenshot({ path: 'test-results/student-mirroring.png', fullPage: false });

  await studentCtx.close();
  await teacherCtx.close();
});
