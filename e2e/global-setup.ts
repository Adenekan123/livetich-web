import { chromium } from '@playwright/test';
import fs from 'fs';
import zlib from 'zlib';

// Log each seed user in ONCE and persist the session cookie, so the test suite
// reuses it instead of re-hitting /auth/login (capped at 20/min per user — a
// full suite trips it). Tests load their storageState and skip login entirely.
const PASSWORD = 'Test1234!';
const BASE = 'http://localhost:3001';
const USERS: Record<string, string> = {
  instructor: 'jeyson.umer@forliion.com',
  student: 'eames.rashed@forliion.com',
};

export const AUTH_DIR = 'e2e/.auth';
export const FIXTURE_DIR = 'e2e/fixtures';
export const authFile = (role: keyof typeof USERS | string) => `${AUTH_DIR}/${role}.json`;

async function loginAndSave(email: string, file: string) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ baseURL: BASE });
    await page.goto('/login');
    await page.fill('#email', email);
    await page.fill('#password', PASSWORD);
    await page.getByRole('button', { name: /log in/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
    await page.context().storageState({ path: file });
  } finally {
    await browser.close();
  }
}

// --- Test fixtures, generated so no binaries live in the repo ---

/** A real WxH RGBA PNG with a busy gradient (a non-trivial raster). */
function makePng(w: number, h: number, seed: number): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 4));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      raw[o++] = ((x * 255) / w) | 0;
      raw[o++] = ((y * 255) / h) | 0;
      raw[o++] = (x + y + seed * 40) % 256;
      raw[o++] = 255;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function buildFixtures() {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { jsPDF } = require('jspdf') as typeof import('jspdf');

  // A proper standalone image.
  fs.writeFileSync(`${FIXTURE_DIR}/sample-image.png`, makePng(160, 100, 3));

  // A small 2-page text PDF.
  const doc = new jsPDF();
  doc.setFontSize(28);
  doc.text('Livetich board test — Page 1', 20, 40);
  doc.addPage();
  doc.setFontSize(28);
  doc.text('Livetich board test — Page 2', 20, 40);
  fs.writeFileSync(`${FIXTURE_DIR}/sample-doc.pdf`, Buffer.from(doc.output('arraybuffer')));

  // A heavy 12-page deck with large embedded rasters (real-material conditions).
  const heavy = new jsPDF({ unit: 'pt', format: 'a4' });
  const PAGES = 12;
  for (let p = 1; p <= PAGES; p++) {
    if (p > 1) heavy.addPage();
    const dataUrl = 'data:image/png;base64,' + makePng(900, 650, p).toString('base64');
    heavy.addImage(dataUrl, 'PNG', 40, 80, 515, 372);
    heavy.setFontSize(22);
    heavy.text(`Heavy deck — slide ${p} of ${PAGES}`, 40, 60);
  }
  fs.writeFileSync(`${FIXTURE_DIR}/heavy-deck.pdf`, Buffer.from(heavy.output('arraybuffer')));
}

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await buildFixtures();
  // Sequential + only 2 logins total, well under the auth throttle.
  await loginAndSave(USERS.instructor, authFile('instructor'));
  await loginAndSave(USERS.student, authFile('student'));
}
