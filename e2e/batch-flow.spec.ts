import { test, expect, type BrowserContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// The batch flow spans an ORG_ADMIN (creates the batch) and a STUDENT (picks
// it). We have no admin login in global-setup, so a tiny helper in the API repo
// mints an admin JWT (signed with the real JWT_SECRET) and tells us which
// program to use — then cleans up the batches we create. Admin auth is injected
// as the httpOnly `lt_token` cookie, exactly what a real login sets.
const API_REPO = path.resolve(process.cwd(), '..', 'livetich-api');
const HELPER = path.join(API_REPO, 'test', 'e2e-admin-helper.mjs');
const BASE = 'http://localhost:3001';

interface Setup {
  adminToken: string;
  studentEnrolled: boolean;
  programId: string;
  programTitle: string;
  batchCount: number;
}

function runHelper(args: string[] = []): Setup | null {
  const out = execFileSync('node', [HELPER, ...args], { cwd: API_REPO }).toString();
  return out.trim() ? (JSON.parse(out) as Setup) : null;
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

test.describe('program batches — end to end', () => {
  let setup: Setup;
  const label = `E2E Batch ${Date.now()}`;

  test.beforeAll(() => {
    setup = runHelper()!;
    expect(setup?.programId, 'helper returned a program').toBeTruthy();
  });

  test.afterAll(() => {
    try {
      runHelper(['--cleanup']);
    } catch {
      // best-effort; a leftover "E2E Batch …" is harmless and cleared next run
    }
  });

  test('admin creates a batch → visible on program, hidden-but-counted in catalog, pickable by a student', async ({
    browser,
  }) => {
    // ---------- ADMIN: create a batch ----------
    const admin = await adminContext(browser, setup.adminToken);
    const ap = await admin.newPage();

    await ap.goto(`/courses/${setup.programId}`);
    await ap.getByRole('button', { name: /add batch/i }).click();

    const dialog = ap.getByRole('dialog', { name: /add batch/i });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/batch label/i).fill(label);
    // Give it a distinct cadence (Mon) — days are sr-only checkboxes.
    await dialog.locator('input[name="meetingDays"][value="1"]').check({ force: true });
    await dialog.getByRole('button', { name: /create batch/i }).click();

    // Redirected to the new batch's OWN page (a course id different from the
    // program we started on).
    await ap.waitForURL(
      (url) => {
        const m = new URL(url).pathname.match(/^\/courses\/([^/]+)$/);
        return !!m && m[1] !== setup.programId;
      },
      { timeout: 20_000 },
    );
    const batchId = ap.url().split('/').pop()!;
    expect(batchId, 'batch has its own id').not.toEqual(setup.programId);
    // Header carries the "Program — Label" title, and a breadcrumb back to the program.
    await expect(ap.getByRole('heading', { level: 1 })).toContainText(label);
    await expect(
      ap.getByRole('link', { name: setup.programTitle }).first(),
    ).toBeVisible();

    // ---------- ADMIN: batch shows in the program's Batches section ----------
    await ap.goto(`/courses/${setup.programId}`);
    const batches = ap.locator('#batches');
    await expect(batches).toBeVisible();
    await expect(batches.getByText(label)).toBeVisible();
    await expect(batches.getByRole('link', { name: /manage/i }).first()).toBeVisible();

    // ---------- ADMIN: catalog groups it under the program ----------
    await ap.goto('/courses');
    // The program card advertises its batches…
    await expect(ap.getByText(/runs in \d+ batch/i).first()).toBeVisible();
    // …and the batch is NOT a catalog card of its own.
    await expect(ap.getByText(label)).toHaveCount(0);

    await admin.close();

    // ---------- STUDENT: can see and pick the batch ----------
    const student: BrowserContext = await browser.newContext({
      baseURL: BASE,
      storageState: 'e2e/.auth/student.json',
    });
    const sp = await student.newPage();
    await sp.goto(`/courses/${setup.programId}`);

    const sBatches = sp.locator('#batches');
    await expect(sBatches).toBeVisible();
    await expect(sBatches.getByText(label)).toBeVisible();
    // A student's row offers a way in (enrol on the batch, or open if enrolled).
    await expect(
      sBatches.getByRole('link', { name: /view & enrol|open/i }).first(),
    ).toBeVisible();

    // When the student isn't enrolled in the program itself, the rail steers
    // them to the batch picker instead of a program-level enrol.
    if (!setup.studentEnrolled) {
      await expect(sp.getByText(/choose your batch/i)).toBeVisible();
    }

    await student.close();
  });
});
