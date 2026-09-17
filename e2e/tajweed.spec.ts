import {
  test,
  expect,
  devices,
  type APIRequestContext,
  type Browser,
  type BrowserContextOptions,
  type Page,
} from '@playwright/test';
import { authFile } from './global-setup';

/**
 * Tajweed annotations on the shared mushaf, driven the way a class uses them:
 * an instructor and a student in the same live session, side by side.
 *
 * Needs the API on :3000 and the web app on :3001 (Redis + MySQL up), the seed
 * users, and a course whose workspace has the Islamic Education pack. Each run
 * schedules its own session on that course and ends it afterwards, so it never
 * depends on a session a previous run left open. When the seed is rebuilt:
 *   TAJWEED_COURSE=<courseId> npx playwright test tajweed --project=chromium
 */
const API = 'http://localhost:3000';
const COURSE = process.env.TAJWEED_COURSE ?? 'cmtu8brt20001vi7glocitk2l';
const PASSWORD = 'Test1234!';
const INSTRUCTOR = 'jeyson.umer@forliion.com';
const STUDENT = 'eames.rashed@forliion.com';

test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let teacherToken = '';
let studentToken = '';
let studentId = '';
let sessionId = '';

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

/** The user id inside an access token — no extra round trip needed. */
function subOf(token: string): string {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return (payload as { sub: string }).sub;
}

interface Listed {
  lesson: { id: string; note: string | null }[];
  corrections: { id: string }[];
}

async function listAs(token: string, query = `sessionId=${sessionId}`): Promise<Listed> {
  const res = await api.get(`${API}/courses/${COURSE}/tajweed/annotations?${query}`, {
    headers: auth(token),
  });
  expect(res.ok(), `list annotations: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as Listed;
}

test.beforeAll(async ({ playwright }) => {
  api = await playwright.request.newContext();
  teacherToken = await tokenFor(api, INSTRUCTOR);
  studentToken = await tokenFor(api, STUDENT);
  studentId = subOf(studentToken);

  const made = await api.post(`${API}/sessions`, {
    headers: auth(teacherToken),
    data: { courseId: COURSE, scheduledAt: new Date().toISOString() },
  });
  expect(made.ok(), `create session: ${made.status()} ${await made.text()}`).toBeTruthy();
  sessionId = ((await made.json()) as { id: string }).id;

  const started = await api.post(`${API}/sessions/${sessionId}/start`, {
    headers: auth(teacherToken),
  });
  expect(started.ok(), `start session: ${started.status()} ${await started.text()}`).toBeTruthy();
});

test.afterAll(async () => {
  if (!sessionId) return;
  // Leave the course as it was found: every annotation this run made, then the
  // session itself.
  const mine = await listAs(teacherToken).catch(() => null);
  const theirs = await listAs(teacherToken, `studentId=${studentId}`).catch(() => null);
  const ids = new Set([
    ...(mine?.lesson ?? []).map((a) => a.id),
    ...(mine?.corrections ?? []).map((a) => a.id),
    ...(theirs?.corrections ?? []).map((a) => a.id),
  ]);
  for (const id of ids) {
    await api.delete(`${API}/courses/${COURSE}/tajweed/annotations/${id}`, {
      headers: auth(teacherToken),
    });
  }
  await api.post(`${API}/sessions/${sessionId}/end`, { headers: auth(teacherToken) });
  await api.dispose();
});

/** Open the class as one role and get to the mushaf. The instructor switches
 *  the room to it; the student is carried there by the room. */
async function openMushaf(
  browser: Browser,
  role: 'instructor' | 'student',
  options: BrowserContextOptions = {},
): Promise<Page> {
  const ctx = await browser.newContext({ ...options, storageState: authFile(role) });
  const page = await ctx.newPage();
  await page.goto(`/sessions/${sessionId}`);
  const mushaf = page.locator('[data-ayah="1"]').first();
  if (role === 'instructor') {
    // Switch only once the room has been joined: the join replays the room's
    // stored surface, and a switch made just before it lands is put back.
    await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(async () => {
      await page.getByRole('button', { name: /qur.an/i }).first().click();
      await expect(mushaf).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 40_000 });
  }
  await expect(mushaf).toBeVisible({ timeout: 40_000 });
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
const letter = (p: Page, ayah: number, w: number, l: number) =>
  p.locator(`[data-ayah="${ayah}"] [data-word="${w}"][data-letter="${l}"]`).first();
const label = (p: Page, ayah: number, text: string) =>
  p.locator(`[data-ayah="${ayah}"] [data-tajweed-label]`, { hasText: text });
const toolbar = (p: Page) => p.locator('[data-tajweed-toolbar]');
/** A rule as it is offered: Recent chips carry the rule's name. */
const rule = (p: Page, name: string | RegExp) =>
  toolbar(p).getByRole('button', { name, exact: typeof name === 'string' });

test('a live mark reaches the student, and goes when the teacher clears it', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const teacher = await openMushaf(browser, 'instructor');
  const student = await openMushaf(browser, 'student');
  await turnTo(teacher, 113, 'Al-Falaq');
  await expect(student.getByText('Al-Falaq').first()).toBeVisible({ timeout: 20_000 });

  await teacher.getByRole('button', { name: 'Tajweed', exact: true }).click();
  await word(teacher, 3, 1).click();
  await rule(teacher, /^Ikhfa haqiqi/).click();

  const seen = label(student, 3, 'Ikhfa haqiqi');
  await expect(seen).toBeVisible();
  // Live marks are drawn dashed, so a class can tell them from kept ones.
  expect(await word(student, 3, 1).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    'dashed',
  );

  await toolbar(teacher).getByRole('button', { name: 'Clear live mark' }).click();
  await expect(seen).toHaveCount(0);

  // Live means live: nothing reached the database.
  expect((await listAs(teacherToken)).lesson).toHaveLength(0);
  await teacher.context().close();
  await student.context().close();
});

test('the class sees what the teacher has picked, before any rule', async ({ browser }) => {
  test.setTimeout(180_000);
  const teacher = await openMushaf(browser, 'instructor');
  await turnTo(teacher, 113, 'Al-Falaq');
  const student = await openMushaf(browser, 'student');
  await expect(student.getByText('Al-Falaq').first()).toBeVisible({ timeout: 20_000 });

  await teacher.getByRole('button', { name: 'Tajweed', exact: true }).click();
  await word(teacher, 2, 1).click();

  // The same word, outlined on the student's screen while the teacher decides:
  // marking is something the class watches, not a result that appears.
  await expect(async () => {
    const outline = await word(student, 2, 1).evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    );
    expect(outline).toBe('dashed');
  }).toPass({ timeout: 20_000 });
  // Nothing has been marked: no label yet, and nothing saved.
  await expect(student.locator('[data-ayah="2"] [data-tajweed-label]')).toHaveCount(0);

  // Dropping the pick takes the outline away again.
  await toolbar(teacher).getByRole('button', { name: 'Clear picks' }).click();
  await expect(async () => {
    const outline = await word(student, 2, 1).evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    );
    expect(outline).not.toBe('dashed');
  }).toPass({ timeout: 20_000 });
  await teacher.context().close();
  await student.context().close();
});

test('a lesson annotation keeps its note, survives a reload, and goes when deleted', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const teacher = await openMushaf(browser, 'instructor');
  // Every test turns the page itself, so each one runs on its own.
  await turnTo(teacher, 113, 'Al-Falaq');
  const student = await openMushaf(browser, 'student');
  await expect(student.getByText('Al-Falaq').first()).toBeVisible({ timeout: 20_000 });

  await teacher.getByRole('button', { name: 'Tajweed', exact: true }).click();
  await word(teacher, 2, 0).click();
  await toolbar(teacher).getByRole('radio', { name: 'Lesson' }).click();
  await toolbar(teacher)
    .getByPlaceholder('Teacher note (optional)')
    .fill('Keep the sound hidden, with its ghunnah.');
  await rule(teacher, /^Ikhfa haqiqi/).click();

  await expect(label(student, 2, 'Ikhfa haqiqi')).toBeVisible();
  await expect.poll(async () => (await listAs(teacherToken)).lesson.length).toBe(1);

  // The student can read the teacher's note, and is told the rule by name.
  await label(student, 2, 'Ikhfa haqiqi').click();
  const card = student.locator('[data-tajweed-card]');
  await expect(card).toContainText('Keep the sound hidden');
  await expect(card).toContainText('إخفاء حقيقي');

  // It belongs to the lesson now, so it comes back when the page does.
  await student.reload();
  await expect(label(student, 2, 'Ikhfa haqiqi')).toBeVisible({ timeout: 40_000 });

  await word(teacher, 2, 0).click();
  await toolbar(teacher).getByRole('button', { name: 'Delete annotation' }).click();
  await expect(label(student, 2, 'Ikhfa haqiqi')).toHaveCount(0);
  await expect.poll(async () => (await listAs(teacherToken)).lesson.length).toBe(0);
  await teacher.context().close();
  await student.context().close();
});

test('a correction is recorded against the student, and only staff and that student see it', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const teacher = await openMushaf(browser, 'instructor');
  // Every test turns the page itself, so each one runs on its own.
  await turnTo(teacher, 113, 'Al-Falaq');
  const student = await openMushaf(browser, 'student');
  await expect(student.getByText('Al-Falaq').first()).toBeVisible({ timeout: 20_000 });

  await teacher.getByRole('button', { name: 'Tajweed', exact: true }).click();
  await toolbar(teacher).getByRole('radio', { name: 'Correction' }).click();
  await toolbar(teacher).getByLabel('Student reciting').selectOption(studentId);
  await word(teacher, 1, 0).click();
  await toolbar(teacher).getByRole('button', { name: 'Tajweed issue' }).click();
  await rule(teacher, /^Qalqalah kubra/).click();

  await expect(label(teacher, 1, 'Qalqalah kubra issue')).toBeVisible();

  // The label shows at once (it is optimistic), so wait for the save to land
  // rather than reading the server in the same instant.
  type Corrections = {
    corrections: { rule: string; outcome: string }[];
    byRule: Record<string, { issues: number }>;
  };
  const readCorrections = async (): Promise<Corrections> => {
    const res = await api.get(
      `${API}/courses/${COURSE}/tajweed/students/${studentId}/corrections`,
      { headers: auth(studentToken) },
    );
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as Corrections;
  };
  await expect.poll(async () => (await readCorrections()).corrections.length).toBe(1);
  const body = await readCorrections();
  expect(body.corrections).toEqual([
    expect.objectContaining({ rule: 'qalqalah.kubra', outcome: 'TAJWEED_ISSUE' }),
  ]);
  expect(body.byRule['qalqalah.kubra'].issues).toBe(1);

  // Feedback on one student is never broadcast to the class; the student finds
  // their own correction when the lesson loads.
  await expect(label(student, 1, 'Qalqalah kubra issue')).toHaveCount(0);
  await student.reload();
  await expect(label(student, 1, 'Qalqalah kubra issue')).toBeVisible({ timeout: 40_000 });
  await teacher.context().close();
  await student.context().close();
});

test('a student cannot annotate, and a reference outside the Qur’an is refused', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const student = await openMushaf(browser, 'student');
  await expect(student.getByRole('button', { name: 'Tajweed', exact: true })).toHaveCount(0);
  await student.context().close();

  const annotation = {
    id: `e2e-${Date.now()}`,
    mode: 'LESSON',
    sessionId,
    parts: [wordPart(1, 0)],
    rule: 'madd.tabii',
  };
  const asStudent = await api.post(`${API}/courses/${COURSE}/tajweed/annotations`, {
    headers: auth(studentToken),
    data: annotation,
  });
  expect(asStudent.status()).toBe(403);

  const offTheText = await api.post(`${API}/courses/${COURSE}/tajweed/annotations`, {
    headers: auth(teacherToken),
    data: { ...annotation, parts: [wordPart(9, 0)] },
  });
  expect(offTheText.status()).toBe(400);
  expect(await offTheText.text()).toContain('has no ayah 9');
});

test('a mark can hold letters from two different ayahs', async ({ browser }) => {
  test.setTimeout(180_000);
  const teacher = await openMushaf(browser, 'instructor');
  await turnTo(teacher, 113, 'Al-Falaq');
  const student = await openMushaf(browser, 'student');
  await expect(student.getByText('Al-Falaq').first()).toBeVisible({ timeout: 20_000 });

  await teacher.getByRole('button', { name: 'Tajweed', exact: true }).click();
  await toolbar(teacher).getByRole('radio', { name: 'Lesson' }).click();
  // Tap a word in ayah 3 first: the class follows to the verse being marked,
  // and that verse and the ones either side of it are the ones whose letters
  // become their own elements. Switching to Letters lets the pick go.
  await word(teacher, 3, 4).click();
  await toolbar(teacher).getByRole('radio', { name: 'Letters' }).click();
  await letter(teacher, 3, 4, 1).click();
  await letter(teacher, 4, 0, 0).click();
  await rule(teacher, /^Ikhfa haqiqi/).click();

  // One mark, named on both ayahs it reaches into.
  await expect(label(student, 3, 'Ikhfa haqiqi')).toBeVisible({ timeout: 20_000 });
  await expect(label(student, 4, 'Ikhfa haqiqi')).toBeVisible();
  await expect.poll(async () => (await listAs(teacherToken)).lesson.length).toBe(1);

  const [saved] = (await listAs(teacherToken)).lesson as unknown as {
    parts: { ayahNumber: number; wordIndex: number; letterIndex: number | null }[];
  }[];
  expect(saved.parts).toEqual([
    { surahNumber: 113, ayahNumber: 3, wordIndex: 4, letterIndex: 1 },
    { surahNumber: 113, ayahNumber: 4, wordIndex: 0, letterIndex: 0 },
  ]);
  await teacher.context().close();
  await student.context().close();
});

test('on a tablet, a teacher marks single letters by tapping', async ({ browser }) => {
  test.setTimeout(180_000);
  const tablet = devices['iPad (gen 7) landscape'];
  const teacher = await openMushaf(browser, 'instructor', {
    viewport: tablet.viewport,
    userAgent: tablet.userAgent,
    deviceScaleFactor: tablet.deviceScaleFactor,
    isMobile: tablet.isMobile,
    hasTouch: true,
  });
  await turnTo(teacher, 113, 'Al-Falaq');
  const student = await openMushaf(browser, 'student');
  await expect(student.getByText('Al-Falaq').first()).toBeVisible({ timeout: 20_000 });

  await teacher.getByRole('button', { name: 'Tajweed', exact: true }).tap();
  const letters = toolbar(teacher).getByRole('radio', { name: 'Letters' });
  await expect(letters).toBeVisible();
  // Big enough for a finger, not a mouse pointer.
  expect((await letters.boundingBox())!.height).toBeGreaterThanOrEqual(32);
  await letters.tap();

  await letter(teacher, 1, 1, 0).tap();
  // Where the next word sits for the student before anything is marked.
  const before = await word(student, 1, 2).boundingBox();
  await rule(teacher, /^Madd tabi/).tap();

  await expect(label(student, 1, 'Madd tabi')).toBeVisible();
  // A label floats above its word: the text a student is reading must not
  // shift along the line when the teacher marks something.
  const after = await word(student, 1, 2).boundingBox();
  expect(Math.round(after!.x)).toBe(Math.round(before!.x));
  expect(Math.round(after!.y)).toBe(Math.round(before!.y));
  // …and the label sits above its word, within its width: never over the
  // harakat being taught, never across the next word.
  const wordBox = (await word(student, 1, 1).boundingBox())!;
  const labelBox = (await label(student, 1, 'Madd tabi').boundingBox())!;
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(wordBox.y + 1);
  expect(labelBox.x).toBeGreaterThanOrEqual(wordBox.x - 1);
  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(wordBox.x + wordBox.width + 1);
  await student.screenshot({ path: test.info().outputPath('student-letter-mark.png') });
  // A letter mark splits only that word into letters, on the student's side too.
  expect(await word(student, 1, 1).locator('span').count()).toBeGreaterThan(1);

  await toolbar(teacher).getByRole('button', { name: 'Clear live (1)', exact: true }).tap();
  await expect(label(student, 1, 'Madd tabi')).toHaveCount(0);
  await teacher.context().close();
  await student.context().close();
});

test('on a phone, the Tajweed controls fit the screen and still mark a word', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const phone = devices['Pixel 7'];
  const asPhone: BrowserContextOptions = {
    viewport: phone.viewport,
    userAgent: phone.userAgent,
    deviceScaleFactor: phone.deviceScaleFactor,
    isMobile: phone.isMobile,
    hasTouch: true,
  };
  const fitsWidth = (p: Page) =>
    p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  const teacher = await openMushaf(browser, 'instructor', asPhone);
  await turnTo(teacher, 113, 'Al-Falaq');
  const student = await openMushaf(browser, 'student', asPhone);
  await expect(student.getByText('Al-Falaq').first()).toBeVisible({ timeout: 20_000 });

  await teacher.getByRole('button', { name: 'Tajweed', exact: true }).tap();
  await word(teacher, 2, 0).tap();

  // Every control a teacher reaches for is on the screen, not off its edge.
  const width = teacher.viewportSize()!.width;
  const ikhfa = rule(teacher, /^Ikhfa haqiqi/);
  for (const control of [
    ikhfa,
    toolbar(teacher).getByRole('radio', { name: 'Correction' }),
    toolbar(teacher).getByRole('radio', { name: 'Letters' }),
    toolbar(teacher).getByRole('button', { name: 'Style' }),
  ]) {
    await control.scrollIntoViewIfNeeded();
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  }
  // …and nothing pushes the page sideways, for either of them.
  expect(await fitsWidth(teacher)).toBe(true);

  await ikhfa.tap();
  await expect(label(student, 2, 'Ikhfa haqiqi')).toBeVisible();
  expect(await fitsWidth(student)).toBe(true);

  await teacher.screenshot({ path: test.info().outputPath('teacher-phone.png') });
  await student.screenshot({ path: test.info().outputPath('student-phone.png') });

  await toolbar(teacher).getByRole('button', { name: 'Clear live (1)', exact: true }).tap();
  await expect(label(student, 2, 'Ikhfa haqiqi')).toHaveCount(0);
  await teacher.context().close();
  await student.context().close();
});
