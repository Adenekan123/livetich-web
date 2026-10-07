import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\b8dd390a-b04c-4682-acb3-a76b1fa39e10';
const RECORDINGS_TEMP = path.join(ARTIFACT_DIR, 'scratch', 'video-temp');
if (!fs.existsSync(RECORDINGS_TEMP)) fs.mkdirSync(RECORDINGS_TEMP, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('1. Authenticating instructor via API...');
  const loginRes = await fetch('http://127.0.0.1:3005/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'instructor@livetich.dev', password: 'password123' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  if (!token) throw new Error('Failed to obtain instructor accessToken: ' + JSON.stringify(loginData));
  console.log('Obtained JWT token for Ada Okoro (instructor@livetich.dev).');

  console.log('2. Launching Chrome with video recorder...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--window-size=1440,900',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: RECORDINGS_TEMP,
      size: { width: 1440, height: 900 },
    },
  });

  // Inject authentication session cookie
  await context.addCookies([
    {
      name: 'lt_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  try {
    const sessionId = 'cmu03fv6d000cvib8sjfixc9u';
    console.log(`3. Navigating to live session: /sessions/${sessionId}...`);
    await page.goto(`http://localhost:3000/sessions/${sessionId}`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    // Capture initial lobby / prejoin screen
    console.log('Current URL:', page.url());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'code_flow_step1_lobby.png') });

    // Handle PreJoin screen
    const joinBtn = page.locator('button', { hasText: /Open the room|Join class/i }).first();
    if (await joinBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('PreJoin screen detected. Clicking "Open the room"...');
      await sleep(1500);
      await joinBtn.click();
      console.log('Entered live classroom.');
    } else {
      console.log('Already in classroom or direct join.');
    }
    await sleep(3500);

    // Switch stage to Code mode
    console.log('4. Switching stage to Code mode (CodeBoard)...');
    const codeModeBtn = page.locator('button', { hasText: 'Code' }).first();
    await codeModeBtn.waitFor({ timeout: 15000 });
    await sleep(1000);
    await codeModeBtn.click();
    console.log('Switched to Code mode.');
    await sleep(2500);

    // Focus CodeMirror editor and type code
    console.log('5. Focusing CodeMirror editor and typing code...');
    const editor = page.locator('.cm-content').first();
    await editor.waitFor({ timeout: 12000 });
    await editor.click();
    await sleep(800);

    const snippet = `// Livetich Collaborative Code Editor\n// Real-time peer-to-peer sync via Yjs CRDT\n\nfunction findTwoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const comp = target - nums[i];\n    if (map.has(comp)) return [map.get(comp), i];\n    map.set(nums[i], i);\n  }\n  return [];\n}\n`;

    await page.keyboard.type(snippet, { delay: 35 });
    console.log('Code entered successfully.');
    await sleep(2000);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'code_flow_step2_editor.png') });

    // Switch language in Code toolbar
    console.log('6. Switching editor language dropdown...');
    const langSelect = page.locator('select[aria-label="Editor language"]').first();
    if (await langSelect.isVisible({ timeout: 4000 }).catch(() => false)) {
      await langSelect.selectOption('python');
      console.log('Language switched to Python.');
      await sleep(2000);
      await langSelect.selectOption('typescript');
      console.log('Language switched to TypeScript.');
      await sleep(1500);
    }

    // Open Live Coding Task Panel
    console.log('7. Opening Live Coding Task panel in sidebar...');
    const codingPanelBtn = page.locator('button[aria-label="Coding task"], button[title="Coding task"]').first();
    if (await codingPanelBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await codingPanelBtn.click();
      console.log('Opened Live Coding Task panel.');
    }
    await sleep(4000);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'code_flow_step3_panel.png') });
    await sleep(2000);

    console.log('Flow completed successfully!');
  } catch (err) {
    console.error('Error during recording execution:', err);
  } finally {
    console.log('Finalizing video recording...');
    const video = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (video) {
      const originalPath = await video.path();
      console.log('Original video recorded at:', originalPath);
      const destPath = path.join(ARTIFACT_DIR, 'code_instructor_flow.webm');
      fs.copyFileSync(originalPath, destPath);
      console.log('Successfully saved video artifact to:', destPath);

      const stats = fs.statSync(destPath);
      console.log(`Video file size: ${(stats.size / 1024).toFixed(1)} KB`);
    }
  }
}

run();
