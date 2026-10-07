import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AdmZip = require('C:/Users/User/OneDrive/Documents/netplus/livetich-vscode/node_modules/adm-zip/adm-zip.js');

const ARTIFACT_DIR = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\b8dd390a-b04c-4682-acb3-a76b1fa39e10';
const RECORDINGS_TEMP = path.join(ARTIFACT_DIR, 'scratch', 'video-temp');
if (!fs.existsSync(RECORDINGS_TEMP)) fs.mkdirSync(RECORDINGS_TEMP, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const API = 'http://127.0.0.1:3005';

async function login(email, password = 'password123') {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.accessToken) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  return data.accessToken;
}

async function setAuthCookie(context, token) {
  await context.clearCookies();
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
}

async function run() {
  console.log('1. Authenticating Instructor and Student...');
  const instructorToken = await login('instructor@livetich.dev');
  const studentToken = await login('seedstudent1@livetich.dev');
  console.log('Authentication successful.');

  const courseId = 'cmu03fv5z000avib87pa8xwya';
  const sessionId = 'cmu03fv6d000cvib8sjfixc9u';
  const taskTitle = `Algorithmic Sprint: Binary Search Tree (${Date.now().toString().slice(-4)})`;

  console.log('\n2. Executing Real API Flow across livetich-api...');

  // Phase 1: Instructor creates coding task via API
  console.log(`Instructor creating coding assignment: "${taskTitle}"...`);
  const createRes = await fetch(`${API}/coding/courses/${courseId}/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${instructorToken}`,
    },
    body: JSON.stringify({
      title: taskTitle,
      description: 'Implement insert, search, and inorder traversal in TypeScript. Handle edge cases with clean typing and O(log N) lookup.',
      language: 'typescript',
      difficulty: 'Intermediate',
      kind: 'LIVE',
      sessionId,
      passingScore: 80,
      maxAttempts: 3,
      allowResubmit: true,
      aiAutoReview: true,
      requirements: [
        { text: 'Insert adds values preserving BST property', mandatory: true },
        { text: 'Search returns true for existing keys and false otherwise', mandatory: true },
      ],
      rubric: [
        { criterion: 'Correctness', weight: 60, mandatory: true },
        { criterion: 'Code Quality & Typing', weight: 40 },
      ],
    }),
  });
  const assignmentData = await createRes.json();
  const assignmentId = assignmentData.id;
  console.log(`Created assignment ID: ${assignmentId}`);

  // Phase 1.5: Launch to live session
  console.log('Launching task to live session room...');
  await fetch(`${API}/coding/assignments/${assignmentId}/launch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${instructorToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  console.log('Task launched to live room.');

  // Phase 2: Student uploads real project zip via AdmZip
  console.log('Student packaging workspace into submission archive (bst-solution.zip)...');
  const zip = new AdmZip();
  zip.addFile('src/bst.ts', Buffer.from(`
// Student 1 Solution: Binary Search Tree
export class BinarySearchTree<T> {
  root: any = null;
  insert(value: T): void {
    const newNode = { value, left: null, right: null };
    if (!this.root) { this.root = newNode; return; }
    let curr = this.root;
    while (true) {
      if (value < curr.value) {
        if (!curr.left) { curr.left = newNode; break; }
        curr = curr.left;
      } else {
        if (!curr.right) { curr.right = newNode; break; }
        curr = curr.right;
      }
    }
  }
  search(value: T): boolean {
    let curr = this.root;
    while (curr) {
      if (value === curr.value) return true;
      curr = value < curr.value ? curr.left : curr.right;
    }
    return false;
  }
}
`));
  zip.addFile('README.md', Buffer.from('# BST Implementation\nPassed local unit tests.'));
  const zipBuffer = zip.toBuffer();

  const formData = new FormData();
  formData.append('file', new Blob([zipBuffer], { type: 'application/zip' }), 'bst-solution.zip');

  console.log('Submitting project to API /coding/assignments/:id/submit...');
  const submitRes = await fetch(`${API}/coding/assignments/${assignmentId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: formData,
  });
  const submitData = await submitRes.json();
  const submissionId = submitData?.submission?.id;
  console.log(`Submission recorded: ${submissionId}`);

  // Phase 3 & 4: Instructor adds feedback & decides submission
  if (submissionId) {
    console.log('Instructor adding line review comment...');
    await fetch(`${API}/coding/submissions/${submissionId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify({
        body: 'Clean generic typing and edge cases handled with O(log N) runtime.',
        filePath: 'src/bst.ts',
        line: 2,
        visibleToStudent: true,
      }),
    });

    console.log('Instructor issuing official final decision (PASS with 95%)...');
    await fetch(`${API}/coding/submissions/${submissionId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify({
        decision: 'PASS',
        finalScore: 95,
        feedback: 'Full marks on core BST logic and TypeScript type safety.',
      }),
    });
    console.log('Decision recorded.');
  }

  // =========================================================================
  // BROWSER RECORDING: VISUAL WORKBENCH WALKTHROUGH
  // =========================================================================
  console.log('\n3. Launching browser to record the visual VS Code & Antigravity IDE workflow...');
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

  const page = await context.newPage();

  try {
    console.log('Navigating to VS Code extension workbench harness...');
    await page.goto('http://localhost:3000/vscode-extension-flow.html', { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    // Update harness dynamic fields
    await page.evaluate((t) => {
      document.getElementById('task-title').value = t;
    }, taskTitle);

    // =======================================================================
    // SCENE 1: INSTRUCTOR CREATES CODING TASK IN VS CODE / ANTIGRAVITY IDE
    // =======================================================================
    console.log('\n--- SCENE 1: INSTRUCTOR AUTHORS CODING TASK IN VS CODE EXTENSION ---');
    await sleep(2000);
    console.log('Capturing Milestone 1: VS Code New Coding Task Webview Form...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vscode_step1_new_task.png') });
    fs.copyFileSync(
      path.join(ARTIFACT_DIR, 'vscode_step1_new_task.png'),
      'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\vscode_step1_new_task.png'
    );
    await sleep(1500);

    // Click "Create & Launch Live Task"
    const createBtn = page.locator('#btn-create-task');
    await createBtn.click();
    await sleep(3000);

    // =======================================================================
    // SCENE 2: STUDENT RECEIVES & SUBMITS WORKSPACE PROJECT IN EXTENSION
    // =======================================================================
    console.log('\n--- SCENE 2: STUDENT RECEIVES & SUBMITS PROJECT IN VS CODE EXTENSION ---');
    await page.locator('#btn-scene2').click();
    await sleep(2500);

    console.log('Capturing Milestone 2: Student Assignment Brief & Submit in VS Code...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vscode_step2_student_submit.png') });
    fs.copyFileSync(
      path.join(ARTIFACT_DIR, 'vscode_step2_student_submit.png'),
      'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\vscode_step2_student_submit.png'
    );
    await sleep(1500);

    // Click "Submit Project"
    const submitBtn = page.locator('#btn-submit-project');
    await submitBtn.click();
    await sleep(3000);

    // =======================================================================
    // SCENE 3: INSTRUCTOR SUBMISSIONS DASHBOARD IN VS CODE EXTENSION
    // =======================================================================
    console.log('\n--- SCENE 3: INSTRUCTOR SUBMISSIONS DASHBOARD IN VS CODE EXTENSION ---');
    await page.locator('#btn-scene3').click();
    await sleep(2500);

    console.log('Capturing Milestone 3: VS Code Submissions Dashboard with attempts & AI confidence...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vscode_step3_dashboard.png') });
    fs.copyFileSync(
      path.join(ARTIFACT_DIR, 'vscode_step3_dashboard.png'),
      'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\vscode_step3_dashboard.png'
    );
    await sleep(2000);

    // =======================================================================
    // SCENE 4: INSTRUCTOR CODE REVIEW & FINAL MARKING IN VS CODE EXTENSION
    // =======================================================================
    console.log('\n--- SCENE 4: INSTRUCTOR CODE REVIEW & DECISION IN VS CODE EXTENSION ---');
    await page.locator('#btn-scene4').click();
    await sleep(2500);

    console.log('Capturing Milestone 4: Code review, AI rubric evaluation, line feedback & decision...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vscode_step4_review_decision.png') });
    fs.copyFileSync(
      path.join(ARTIFACT_DIR, 'vscode_step4_review_decision.png'),
      'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\vscode_step4_review_decision.png'
    );
    await sleep(1500);

    // Instructor clicks Pass Submission
    const passBtn = page.locator('button.btn-pass');
    await passBtn.click();
    await sleep(3500);

    // =======================================================================
    // SCENE 5: LIVE CLASSROOM SYNCHRONIZATION (STAGE & POINTS BOARD)
    // =======================================================================
    console.log('\n--- SCENE 5: LIVE CLASSROOM STAGE & POINTS BOARD SYNCHRONIZED ---');
    await setAuthCookie(context, instructorToken);
    await page.goto(`http://localhost:3000/sessions/${sessionId}`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    const joinBtn = page.locator('button', { hasText: /Open the room|Join class/i }).first();
    if (await joinBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Clicking Join class in lobby...');
      await joinBtn.click({ force: true });
      await sleep(4000);
    }

    // Wait for room to enter and stage buttons to appear
    await sleep(4000);

    // Switch to Code stage
    const codeBtn = page.locator('button:has-text("Code")').first();
    if (await codeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Switching to Code stage...');
      await codeBtn.click({ force: true });
      await sleep(2000);
    }

    // Open Points / Coding drawer in live room
    const pointsBtn = page.locator('button:has-text("Points")').first();
    if (await pointsBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Opening live Points board...');
      await pointsBtn.click({ force: true });
      await sleep(2000);
    }

    console.log('Capturing Milestone 5: Live classroom stage synchronized with extension decision...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'vscode_step5_live_stage_synced.png') });
    fs.copyFileSync(
      path.join(ARTIFACT_DIR, 'vscode_step5_live_stage_synced.png'),
      'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\vscode_step5_live_stage_synced.png'
    );
    await sleep(3500);

    console.log('\n*** COMPLETE EXTENSION LIFECYCLE SUCCESSFULLY RECORDED! ***');
  } catch (err) {
    console.error('Error during recording:', err);
  } finally {
    console.log('Finalizing video recording file...');
    const video = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (video) {
      const originalPath = await video.path();
      console.log('Raw video path:', originalPath);
      const destPath = path.join(ARTIFACT_DIR, 'vscode_extension_flow.webm');
      fs.copyFileSync(originalPath, destPath);

      const publicPath = 'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\vscode_extension_flow.webm';
      fs.copyFileSync(originalPath, publicPath);

      const stats = fs.statSync(destPath);
      console.log(`Final video size: ${(stats.size / 1024).toFixed(1)} KB`);
    }
  }
}

run();
