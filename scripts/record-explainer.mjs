// Records the platform onboarding explainer as captioned walkthroughs of the
// running local app (web :3001 + api :3000). Produces up to three chunks:
//   node scripts/record-explainer.mjs [onboarding|live|coursework|all]
// Output: recordings/<chunk>.webm
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import {
  readdirSync,
  renameSync,
  mkdirSync,
  existsSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:3001';
const OUT_DIR = 'recordings';
const INSTRUCTOR = 'e2e/.auth/instructor.json';
const LIVE_SESSION = 'cmtfiqi9y0001vilcs0gefpq4';
const API_DIR = '../livetich-api';
const DB_URL = 'mysql://root@localhost:3306/livetich_dev';

const which = process.argv[2] || 'all';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR);
const browser = await chromium.launch();

function makeHelpers(page) {
  const caption = async (text, ms = 4200, top = false) => {
    await page.evaluate(
      ({ t, top }) => {
        let el = document.getElementById('__cap');
        if (!el) {
          el = document.createElement('div');
          el.id = '__cap';
          document.body.appendChild(el);
        }
        el.textContent = t;
        Object.assign(el.style, {
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          top: top ? '66px' : '',
          bottom: top ? '' : '104px',
          background: 'linear-gradient(180deg,#0f766e,#0c2622)',
          color: '#fff',
          padding: '15px 30px',
          borderRadius: '16px',
          font: '600 25px/1.35 system-ui,-apple-system,Segoe UI,sans-serif',
          zIndex: '2147483647',
          boxShadow: '0 18px 46px rgba(0,0,0,.45)',
          maxWidth: '76vw',
          textAlign: 'center',
          opacity: '0',
          transition: 'opacity .45s ease',
        });
        requestAnimationFrame(() => (el.style.opacity = '1'));
      },
      { t: text, top },
    );
    await page.waitForTimeout(ms);
  };
  const goto = async (path) => {
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(900);
  };
  return { caption, goto };
}

async function recordChunk(name, opts, fn) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
    ...opts,
  });
  const page = await context.newPage();
  const before = new Set(readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm')));
  try {
    await fn(page, makeHelpers(page));
  } catch (e) {
    console.error(`[${name}] error:`, e.message);
  }
  await context.close();
  const fresh = readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.webm') && !before.has(f))
    .map((f) => ({ f, t: statSync(join(OUT_DIR, f)).mtimeMs }))
    .sort((a, b) => a.t - b.t);
  const latest = fresh[fresh.length - 1]?.f;
  if (latest) {
    const dest = `${name}.webm`;
    if (existsSync(join(OUT_DIR, dest))) renameSync(join(OUT_DIR, dest), join(OUT_DIR, `${name}.prev.webm`));
    renameSync(join(OUT_DIR, latest), join(OUT_DIR, dest));
    const kb = Math.round(statSync(join(OUT_DIR, dest)).size / 1024);
    console.log(`VIDEO ${name}: ${join(OUT_DIR, dest)} (${kb} KB)`);
  }
}

/* ---------------- Chunk 1: onboarding ---------------- */
async function onboarding(page, { caption, goto }) {
  const email = `amara.${Date.now()}@brightfuture.io`;
  await goto('/');
  await caption('livetich — teach live, to a room that actually shows up', 4600);

  const cta = page.getByRole('link', { name: /get started|create.*teaching|start teaching/i }).first();
  if (await cta.isVisible().catch(() => false)) await cta.click().catch(() => {});
  else await goto('/register');
  await page.waitForTimeout(1200);
  await caption('Create your teaching space — one short form', 3000);

  await page.fill('#organizationName', 'Bright Future Institute').catch(() => {});
  await page.waitForTimeout(500);
  await page.fill('#name', 'Amara Okafor').catch(() => {});
  await page.waitForTimeout(500);
  await page.fill('#email', email).catch(() => {});
  await page.waitForTimeout(400);
  await page.fill('#password', 'TeachLive!123').catch(() => {});
  await caption('Sign up in seconds', 2600);
  await page.getByRole('button', { name: /create my teaching space/i }).click().catch(() => {});
  await page.waitForTimeout(2500);
  await caption('Confirm your email with the 6-digit code we send you', 4200);

  // Stand in for entering the emailed code (the OTP is hashed server-side).
  try {
    execSync('npx prisma db execute --stdin --schema=prisma/schema.prisma', {
      cwd: API_DIR,
      input: `UPDATE User SET emailVerified = 1, verifyOtpHash = NULL, verifyOtpExpiresAt = NULL WHERE email = '${email}';`,
      env: { ...process.env, DATABASE_URL: DB_URL },
      stdio: ['pipe', 'ignore', 'inherit'],
    });
  } catch (e) {
    console.error('verify step failed:', e.message);
  }

  await goto('/login');
  await page.fill('#email', email).catch(() => {});
  await page.fill('#password', 'TeachLive!123').catch(() => {});
  await page.getByRole('button', { name: /log in/i }).click().catch(() => {});
  await page.waitForTimeout(2600);
  await caption("You're in — your live-teaching dashboard", 4600);
}

/* ---------------- Chunk 2: teaching live ---------------- */
async function live(page, { caption, goto }) {
  await goto(`/sessions/${LIVE_SESSION}`);
  const chalk = page.getByRole('button', { name: /^chalkboard$/i });
  if (await chalk.isVisible().catch(() => false)) await chalk.click().catch(() => {});
  await page.waitForTimeout(1600);
  await caption('Teach on a live, shared chalkboard', 3400, true);

  const box = await page.locator('.tl-container').first().boundingBox().catch(() => null);
  if (box) {
    // Write a maths problem with the text tool.
    await page.getByTestId('tools.text').click().catch(() => {});
    await page.mouse.click(box.x + box.width * 0.28, box.y + box.height * 0.32);
    await page.waitForTimeout(400);
    await page.keyboard.type('Solve:  3x - 7 = 14', { delay: 55 });
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');
    await caption('Write and work through problems together', 3400, true);
    // A quick freehand stroke underlining the work.
    await page.getByTestId('tools.draw').click().catch(() => {});
    const cy = box.y + box.height * 0.55;
    await page.mouse.move(box.x + box.width * 0.28, cy);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, cy + 6, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    await page.getByTestId('tools.select').click().catch(() => {});
  }

  // Full-screen mode.
  const fs = page.getByRole('button', { name: 'Full screen' });
  if (await fs.isVisible().catch(() => false)) {
    await fs.click().catch(() => {});
    await page.waitForTimeout(1200);
    await caption('Go full-screen for the whole class', 3600, true);
    const exit = page.getByRole('button', { name: 'Exit full screen' });
    await exit.click().catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(900);
  }

  // Templates / import.
  const axes = page.getByRole('button', { name: /^axes$/i });
  if (await axes.isVisible().catch(() => false)) {
    await axes.click().catch(() => {});
    await page.waitForTimeout(900);
  }
  await caption('Drop in PDFs, templates and images', 3400, true);

  // Buzzer.
  const startBz = page.getByRole('button', { name: /start buzzer/i });
  if (await startBz.isVisible().catch(() => false)) {
    await startBz.click().catch(() => {});
    await page.waitForTimeout(1400);
    await caption('Run buzzer rounds — first correct answer wins', 3800);
    const pick = page.getByRole('button', { name: /start ▸|start round|save & start/i }).first();
    if (await pick.isVisible().catch(() => false)) {
      await pick.click().catch(() => {});
      await page.waitForTimeout(1800);
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
  }

  // Leaderboard.
  const points = page.getByRole('button', { name: /points/i }).first();
  if (await points.isVisible().catch(() => false)) {
    await points.click().catch(() => {});
    await page.waitForTimeout(1400);
  }
  await caption('A live leaderboard keeps everyone in it', 4400);
}

/* ---------------- Chunk 3: coursework ---------------- */
async function coursework(page, { caption, goto }) {
  await goto('/courses');
  await caption('Every program is a full course, not just a video call', 3600);
  // Open the first program (click its card link — robust to Join/View labels).
  const anyCourse = page.locator('a[href^="/courses/"]').first();
  if (await anyCourse.isVisible().catch(() => false)) await anyCourse.click().catch(() => {});
  await page.waitForTimeout(2000);

  const lab = page.getByText(/assignment lab/i).first();
  if (await lab.isVisible().catch(() => false)) {
    await lab.click().catch(() => {});
    await page.waitForTimeout(1800);
    await caption('Set assignments and group your students', 4000);
  }

  await page.goBack().catch(() => {});
  await page.waitForTimeout(1200);
  const exams = page.getByText(/assessments/i).first();
  if (await exams.isVisible().catch(() => false)) {
    await exams.click().catch(() => {});
    await page.waitForTimeout(1800);
    await caption('Build graded assessments with a question bank', 4200);
  }
  await caption('livetich — start teaching live', 4200);
}

if (which === 'onboarding' || which === 'all')
  await recordChunk('onboarding', {}, onboarding);
if (which === 'live' || which === 'all')
  await recordChunk('live', { storageState: INSTRUCTOR }, live);
if (which === 'coursework' || which === 'all')
  await recordChunk('coursework', { storageState: INSTRUCTOR }, coursework);

await browser.close();
console.log('done');
