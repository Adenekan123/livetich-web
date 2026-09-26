import {
  test,
  expect,
  type APIRequestContext,
  type Browser,
  type Page,
} from '@playwright/test';
import { authFile } from './global-setup';

/**
 * Tajweed beyond the live mushaf: preparing a lesson ahead of class, the
 * printable sheets, progress, a correction joining the recitation it was heard
 * in, its history, and a Qur'an block on the whiteboard.
 *
 * Same assumptions as tajweed.spec.ts. Every run uses one lesson on the course
 * (found by title, made once), and schedules its own session for that lesson.
 *   TAJWEED_COURSE=<courseId> npx playwright test tajweed-course --project=chromium
 */
const API = 'http://localhost:3000';
const COURSE = process.env.TAJWEED_COURSE ?? 'cmtu8brt20001vi7glocitk2l';
const PASSWORD = 'Test1234!';
const INSTRUCTOR = 'jeyson.umer@forliion.com';
const STUDENT = 'eames.rashed@forliion.com';
const LESSON_TITLE = 'Tajweed e2e';
const NOTE = 'Stretch it two counts.';

test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let teacherToken = '';
let studentToken = '';
let studentId = '';
let sectionId = '';
let sessionId = '';
let hifzEntryId = '';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** A mark points at parts of the text: a whole word, or one letter of it. */
const wordPart = (ayahNumber: number, wordIndex: number, surahNumber = 113) => ({
  surahNumber,
  ayahNumber,
  wordIndex,
});

async function tokenFor(request: APIRequestContext, email: string) {
  const res = await request.post(`${API}/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok(), `login ${email}: ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { accessToken: string }).accessToken;
}

function subOf(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return (payload as { sub: string }).sub;
}

interface Mark {
  id: string;
  version: number;
  note: string | null;
  rule: string | null;
  kept: boolean;
  ayahNumber: number;
  parts: { ayahNumber: number; wordIndex: number | null; letterIndex: number | null }[];
  sessionId: string | null;
  hifzEntryId: string | null;
}

async function list(query: string): Promise<{ lesson: Mark[]; corrections: Mark[] }> {
  const res = await api.get(`${API}/courses/${COURSE}/tajweed/annotations?${query}`, {
    headers: auth(teacherToken),
  });
  expect(res.ok(), `list: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as { lesson: Mark[]; corrections: Mark[] };
}

/** Remove this lesson's marks and the student's corrections. */
async function clearTajweed() {
  const { lesson } = await list(`sectionId=${sectionId}`);
  const { corrections } = await list(`studentId=${studentId}`);
  for (const m of [...lesson, ...corrections]) {
    await api.delete(`${API}/courses/${COURSE}/tajweed/annotations/${m.id}`, {
      headers: auth(teacherToken),
    });
  }
}

/** The lesson's Madd on Al-Falaq 5, made over the API when a test needs it and
 *  an earlier one did not leave it — so each test also runs on its own. */
async function ensureLessonMark() {
  const { lesson } = await list(`sectionId=${sectionId}`);
  if (lesson.some((m) => m.rule === 'madd.tabii' && m.ayahNumber === 5)) return;
  const res = await api.post(`${API}/courses/${COURSE}/tajweed/annotations`, {
    headers: auth(teacherToken),
    data: {
      id: `e2e-lesson-${Date.now()}`,
      mode: 'LESSON',
      sectionId,
      parts: [wordPart(5, 0)],
      rule: 'madd.tabii',
      note: NOTE,
    },
  });
  expect(res.ok(), `lesson mark: ${res.status()} ${await res.text()}`).toBeTruthy();
}

test.beforeAll(async ({ playwright }) => {
  api = await playwright.request.newContext();
  teacherToken = await tokenFor(api, INSTRUCTOR);
  studentToken = await tokenFor(api, STUDENT);
  studentId = subOf(studentToken);

  // One lesson for every run, found by its title, so runs do not pile up.
  const course = await api.get(`${API}/courses/${COURSE}`, { headers: auth(teacherToken) });
  expect(course.ok()).toBeTruthy();
  const { sections } = (await course.json()) as { sections: { id: string; title: string }[] };
  sectionId = sections.find((s) => s.title === LESSON_TITLE)?.id ?? '';
  if (!sectionId) {
    const made = await api.post(`${API}/courses/${COURSE}/sections`, {
      headers: auth(teacherToken),
      data: { title: LESSON_TITLE },
    });
    expect(made.ok(), `add lesson: ${made.status()} ${await made.text()}`).toBeTruthy();
    sectionId = ((await made.json()) as { id: string }).id;
  }
  await clearTajweed();

  const made = await api.post(`${API}/sessions`, {
    headers: auth(teacherToken),
    data: { courseId: COURSE, sectionId, scheduledAt: new Date().toISOString() },
  });
  expect(made.ok(), `create session: ${made.status()} ${await made.text()}`).toBeTruthy();
  sessionId = ((await made.json()) as { id: string }).id;
  const started = await api.post(`${API}/sessions/${sessionId}/start`, {
    headers: auth(teacherToken),
  });
  expect(started.ok(), `start session: ${started.status()}`).toBeTruthy();
});

test.afterAll(async () => {
  if (sectionId) await clearTajweed().catch(() => {});
  if (hifzEntryId) {
    await api.delete(`${API}/courses/${COURSE}/hifz/entries/${hifzEntryId}`, {
      headers: auth(teacherToken),
    });
  }
  if (sessionId) {
    await api.post(`${API}/sessions/${sessionId}/end`, { headers: auth(teacherToken) });
  }
  await api.dispose();
});

/** Open the class; the instructor switches the room to a surface once joined. */
async function openClass(
  browser: Browser,
  role: 'instructor' | 'student',
  surface: 'quran' | 'board',
): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile(role) });
  const page = await ctx.newPage();
  await page.goto(`/sessions/${sessionId}`);
  const ready =
    surface === 'quran'
      ? page.locator('[data-ayah="1"]').first()
      : page.locator('.excalidraw-container canvas').first();
  if (role === 'instructor') {
    await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible({
      timeout: 30_000,
    });
    const button = surface === 'quran' ? /qur.an/i : /^chalkboard$/i;
    await expect(async () => {
      await page.getByRole('button', { name: button }).first().click();
      await expect(ready).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 40_000 });
  }
  await expect(ready).toBeVisible({ timeout: 40_000 });
  return page;
}

async function turnTo(page: Page, surah: number, name: string) {
  await page.getByRole('button', { name: 'Choose surah' }).click();
  await page.getByPlaceholder('Search surah…').fill(String(surah));
  await page.getByRole('button', { name: `${surah}.` }).first().click();
  await expect(page.getByText(name).first()).toBeVisible();
}

const word = (p: Page, ayah: number, w: number) =>
  p.locator(`[data-ayah="${ayah}"] [data-word="${w}"]`).first();
const label = (p: Page, ayah: number, text: string) =>
  p.locator(`[data-ayah="${ayah}"] [data-tajweed-label]`, { hasText: text });
const toolbar = (p: Page) => p.locator('[data-tajweed-toolbar]');
const rule = (p: Page, name: RegExp) => toolbar(p).getByRole('button', { name });

// The prep page saves nothing while Live is the only mode in the toolbar: no
// Lesson radio, no note field, no history. The API still does all of it, so
// this comes back by deleting the .skip once those modes are un-commented in
// tajweed-toolbar.tsx.
test.skip('a lesson prepared on the course page is on the mushaf when its class runs', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  await clearTajweed();
  const ctx = await browser.newContext({ storageState: authFile('instructor') });
  const prep = await ctx.newPage();
  await prep.goto(`/courses/${COURSE}/tajweed?lesson=${sectionId}`);
  await expect(prep.getByRole('heading', { name: 'Tajweed', exact: true })).toBeVisible();
  await expect(prep.getByLabel('Lesson')).toHaveValue(sectionId);
  await expect(toolbar(prep)).toBeVisible({ timeout: 30_000 });
  // No class to show live marks to, and no student reciting: Lesson only. The
  // Words/Letters radios are how a tap picks, not what a rule does.
  await expect(toolbar(prep).getByRole('radio', { name: 'Lesson' })).toBeVisible();
  await expect(toolbar(prep).getByRole('radio', { name: 'Live' })).toHaveCount(0);
  await expect(toolbar(prep).getByRole('radio', { name: 'Correction' })).toHaveCount(0);

  await turnTo(prep, 113, 'Al-Falaq');
  await word(prep, 5, 0).click();
  await toolbar(prep).getByPlaceholder('Teacher note (optional)').fill(NOTE);
  await rule(prep, /^Madd tabi/).click();

  await expect.poll(async () => (await list(`sectionId=${sectionId}`)).lesson.length).toBe(1);
  const [saved] = (await list(`sectionId=${sectionId}`)).lesson;
  expect(saved).toMatchObject({ rule: 'madd.tabii', note: NOTE, sessionId: null });
  expect(saved.parts).toEqual([
    { surahNumber: 113, ayahNumber: 5, wordIndex: 0, letterIndex: null },
  ]);

  // Its history says what happened to it.
  await word(prep, 5, 0).click();
  await toolbar(prep).getByRole('button', { name: 'Annotation history' }).click();
  await expect(prep.locator('[data-tajweed-history]')).toContainText('Created');
  await ctx.close();

  // The class that runs this lesson has it on the shared mushaf.
  const teacher = await openClass(browser, 'instructor', 'quran');
  await turnTo(teacher, 113, 'Al-Falaq');
  const student = await openClass(browser, 'student', 'quran');
  await expect(label(student, 5, 'Madd tabi')).toBeVisible({ timeout: 30_000 });
  await teacher.context().close();
  await student.context().close();
});

test('a kept mark comes back in another lesson of the same course', async () => {
  test.setTimeout(120_000);
  await clearTajweed();
  const id = `e2e-kept-${Date.now()}`;
  const made = await api.post(`${API}/courses/${COURSE}/tajweed/annotations`, {
    headers: auth(teacherToken),
    data: {
      id,
      mode: 'LESSON',
      sectionId,
      kept: true,
      parts: [wordPart(4, 1)],
      rule: 'qalqalah.kubra',
    },
  });
  expect(made.ok(), `kept mark: ${made.status()} ${await made.text()}`).toBeTruthy();

  // A class with no lesson of its own still opens on what the teacher kept:
  // "keep for next time" belongs to the ayah, not to one lesson.
  const elsewhere = await list(`sessionId=${sessionId}`);
  expect(elsewhere.lesson.map((m) => m.id)).toContain(id);
  expect(elsewhere.lesson.find((m) => m.id === id)?.kept).toBe(true);

  await api.delete(`${API}/courses/${COURSE}/tajweed/annotations/${id}`, {
    headers: auth(teacherToken),
  });
});

// The sheet and the board block read marks the API makes (ensureLessonMark),
// not marks made through the toolbar, so both still hold with Live only.
test('the lesson sheet shows the lesson’s marks, ready to print', async ({ browser }) => {
  test.setTimeout(120_000);
  await ensureLessonMark();
  const ctx = await browser.newContext({ storageState: authFile('instructor') });
  const page = await ctx.newPage();
  await page.goto(`/courses/${COURSE}/tajweed/print/lesson/${sectionId}`);

  await expect(page.getByRole('heading', { name: LESSON_TITLE })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Al-Falaq 5')).toBeVisible();
  await expect(page.getByRole('cell', { name: /Madd tabi/ }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: NOTE }).first()).toBeVisible();

  const print = page.getByRole('button', { name: 'Print or save as PDF' });
  await expect(print).toBeVisible();
  // On paper the button goes, the app's navigation goes, and the marks stay.
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(print).toBeHidden();
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeHidden();
  await expect(page.getByRole('cell', { name: NOTE }).first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('lesson-sheet.png'), fullPage: true });
  await ctx.close();
});

test('a correction heard in class joins the recitation, with its history and in progress', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const id = `e2e-corr-${Date.now()}`;
  const created = await api.post(`${API}/courses/${COURSE}/tajweed/annotations`, {
    headers: auth(teacherToken),
    data: {
      id,
      mode: 'STUDENT_CORRECTION',
      sessionId,
      studentId,
      outcome: 'TAJWEED_ISSUE',
      rule: 'qalqalah.kubra',
      parts: [wordPart(1, 0)],
    },
  });
  expect(created.ok(), `correction: ${created.status()} ${await created.text()}`).toBeTruthy();
  const edited = await api.patch(`${API}/courses/${COURSE}/tajweed/annotations/${id}`, {
    headers: auth(teacherToken),
    data: { version: 1, note: 'Let the qaf bounce.' },
  });
  expect(edited.ok(), `edit: ${edited.status()} ${await edited.text()}`).toBeTruthy();

  // The teacher saves the student's recitation from that session…
  const entry = await api.post(`${API}/courses/${COURSE}/hifz/entries`, {
    headers: auth(teacherToken),
    data: {
      studentId,
      surahNumber: 113,
      ayahStart: 1,
      ayahEnd: 5,
      kind: 'NEW_HIFZ',
      sessionId,
    },
  });
  expect(entry.ok(), `recitation: ${entry.status()} ${await entry.text()}`).toBeTruthy();
  hifzEntryId = ((await entry.json()) as { id: string }).id;

  // …and the correction heard in it is now part of that recitation.
  const linked = (await list(`studentId=${studentId}`)).corrections.find((c) => c.id === id);
  expect(linked).toMatchObject({ hifzEntryId, note: 'Let the qaf bounce.', version: 3 });

  const history = await api.get(`${API}/courses/${COURSE}/tajweed/annotations/${id}/history`, {
    headers: auth(teacherToken),
  });
  expect(history.ok()).toBeTruthy();
  expect(((await history.json()) as { change: string }[]).map((h) => h.change)).toEqual([
    'CREATED',
    'UPDATED',
    'UPDATED',
  ]);
  const asStudent = await api.get(
    `${API}/courses/${COURSE}/tajweed/annotations/${id}/history`,
    { headers: auth(studentToken) },
  );
  expect(asStudent.status()).toBe(403);

  // The student finds it on their recitation, and sees only their own progress.
  const studentCtx = await browser.newContext({ storageState: authFile('student') });
  const mine = await studentCtx.newPage();
  await mine.goto(`/courses/${COURSE}/hifz`);
  await expect(
    mine.getByRole('list', { name: 'Tajweed corrections' }).first(),
  ).toContainText('Qalqalah kubra issue', { timeout: 30_000 });
  await mine.goto(`/courses/${COURSE}/tajweed`);
  await expect(mine.locator('tbody tr')).toHaveCount(1, { timeout: 30_000 });
  await expect(mine.locator('tbody tr')).toContainText('1 to work on');
  await studentCtx.close();

  // The teacher sees the class, and the student's correction sheet.
  const teacherCtx = await browser.newContext({ storageState: authFile('instructor') });
  const page = await teacherCtx.newPage();
  await page.goto(`/courses/${COURSE}/tajweed`);
  await page.getByRole('tab', { name: 'Progress' }).click();
  await expect(page.locator('tbody tr', { hasText: 'Qalqalah kubra' }).first()).toContainText(
    '1 to work on',
    { timeout: 30_000 },
  );
  await page.goto(`/courses/${COURSE}/tajweed/print/student/${studentId}`);
  await expect(page.getByText('Tajweed correction sheet')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('cell', { name: 'Qalqalah kubra issue' })).toBeVisible();
  await teacherCtx.close();
});

test('a Qur’an block on the board shows the ayahs with the lesson’s marks, for the class too', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  await ensureLessonMark();
  const teacher = await openClass(browser, 'instructor', 'board');
  const student = await openClass(browser, 'student', 'board');

  await teacher.getByRole('button', { name: 'Qur’an block' }).click();
  const panel = teacher.locator('[data-quran-block-panel]');
  await panel.getByLabel('Surah').fill('113');
  await panel.getByLabel('From ayah').fill('1');
  await panel.getByLabel('To ayah').fill('5');
  await panel.getByRole('button', { name: 'Add to board' }).click();

  for (const page of [teacher, student]) {
    const block = page.locator('[data-quran-block]').first();
    await expect(block).toBeVisible({ timeout: 30_000 });
    await expect(block).toContainText('Al-Falaq');
    // The mark prepared for this lesson is drawn on the board's copy too.
    await expect(
      block.locator('[data-ayah="5"] [data-tajweed-label]', { hasText: 'Madd tabi' }),
    ).toBeVisible({ timeout: 20_000 });
  }
  await student.screenshot({ path: test.info().outputPath('student-board-block.png') });

  // Leave the shared board as it was found. The version bump is what carries
  // the deletion to everyone else.
  await teacher.evaluate(() => {
    const board = window.__livetichBoard;
    if (!board) return;
    board.updateScene({
      elements: board.getSceneElements().map((el) =>
        el.type === 'embeddable' && el.link?.includes('quran.invalid')
          ? {
              ...el,
              isDeleted: true,
              version: el.version + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
            }
          : el,
      ),
    });
  });
  await teacher.waitForTimeout(2000);
  await teacher.context().close();
  await student.context().close();
});
