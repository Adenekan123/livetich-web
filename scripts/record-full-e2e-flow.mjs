import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\User\\.gemini\\antigravity-ide\\brain\\b8dd390a-b04c-4682-acb3-a76b1fa39e10';
const RECORDINGS_TEMP = path.join(ARTIFACT_DIR, 'scratch', 'video-temp');
if (!fs.existsSync(RECORDINGS_TEMP)) fs.mkdirSync(RECORDINGS_TEMP, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loginApi(email, password = 'password123') {
  const res = await fetch('http://127.0.0.1:3005/auth/login', {
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
  const instructorToken = await loginApi('instructor@livetich.dev');
  const studentToken = await loginApi('seedstudent1@livetich.dev');
  console.log('Authentication complete.');

  const courseId = 'cmu03fv5z000avib87pa8xwya';
  const sessionId = 'cmu03fv6d000cvib8sjfixc9u';
  const taskTitle = `Live Challenge: QuickSort Partition (${Date.now().toString().slice(-4)})`;

  console.log('2. Launching browser with full video recording (1440x900 HD)...');
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
    // =========================================================================
    // SCENE 1: INSTRUCTOR CREATES A CODING TASK
    // =========================================================================
    console.log('\n========================================');
    console.log('SCENE 1: INSTRUCTOR CREATES CODING TASK');
    console.log('========================================');
    await setAuthCookie(context, instructorToken);

    console.log(`Navigating to Course Assignment Lab: /courses/${courseId}/assignments...`);
    await page.goto(`http://localhost:3000/courses/${courseId}/assignments`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);

    console.log('Instructor clicks "+ Add assignment"...');
    const addBtn = page.locator('button', { hasText: '+ Add assignment' }).first();
    await addBtn.waitFor({ timeout: 10000 });
    await addBtn.click();
    await sleep(1500);

    console.log(`Filling assignment title: "${taskTitle}"...`);
    await page.fill('input[name="title"]', taskTitle);
    await sleep(800);

    console.log('Filling assignment instructions...');
    const instructionsText = 'Implement the Lomuto partition algorithm in TypeScript. Return the pivot index after in-place swaps.';
    const instructionsArea = page.locator('textarea[name="instructions"], #a-instructions').first();
    if (await instructionsArea.isVisible()) {
      await instructionsArea.fill(instructionsText);
    }
    await sleep(800);

    console.log('Setting maxPoints: 100...');
    await page.fill('input[name="maxPoints"]', '100');
    await sleep(800);

    console.log('Selecting live session for assignment...');
    const sessionSelect = page.locator('select[name="sessionId"]').first();
    if (await sessionSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sessionSelect.selectOption(sessionId).catch(async () => {
        const opts = await sessionSelect.locator('option').all();
        if (opts.length > 1) await sessionSelect.selectOption({ index: 1 });
      });
    }
    await sleep(1200);

    console.log('Submitting new assignment form...');
    const createBtn = page.locator('button[type="submit"]', { hasText: /Create assignment/i }).first();
    await createBtn.click();
    await sleep(3500);

    console.log('Selecting created assignment in Assignment Lab to show details...');
    const createdItem = page.locator('button').filter({ hasText: taskTitle }).first();
    if (await createdItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createdItem.click();
      await sleep(1800);
    }

    console.log('Capturing Milestone 1: Coding task created & details verified.');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'flow_step1_task_created.png') });
    fs.copyFileSync(
      path.join(ARTIFACT_DIR, 'flow_step1_task_created.png'),
      'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\flow_step1_task_created.png'
    );
    await sleep(2500);

    // =========================================================================
    // SCENE 2: STUDENT RECEIVES AND SUBMITS CODING TASK
    // =========================================================================
    console.log('\n========================================');
    console.log('SCENE 2: STUDENT SUBMITS CODING TASK');
    console.log('========================================');
    await setAuthCookie(context, studentToken);

    console.log(`Student navigating to assignments: /courses/${courseId}/assignments...`);
    await page.goto(`http://localhost:3000/courses/${courseId}/assignments`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    console.log(`Finding student assignment card for: "${taskTitle}"...`);
    const studentCard = page.locator('li').filter({ hasText: taskTitle }).first();
    await studentCard.waitFor({ timeout: 10000 });

    console.log('Student selects programming language: TypeScript...');
    const langSelect = studentCard.locator('select[name="language"]').first();
    if (await langSelect.isVisible({ timeout: 4000 }).catch(() => false)) {
      await langSelect.selectOption('typescript');
      await sleep(1000);
    }

    console.log('Student writing code solution into editor...');
    const codeTextarea = studentCard.locator('textarea[name="content"]').first();
    await codeTextarea.scrollIntoViewIfNeeded();
    await codeTextarea.click();
    await sleep(600);

    const studentCode = `// Lomuto Partition Algorithm in TypeScript
export function partition(arr: number[], low: number, high: number): number {
  const pivot = arr[high];
  let i = low - 1;
  for (let j = low; j < high; j++) {
    if (arr[j] <= pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  return i + 1;
}
`;

    // Type with visible pacing
    await page.keyboard.type(studentCode, { delay: 20 });
    console.log('Student code solution typed.');
    await sleep(2000);

    console.log('Capturing Milestone 2: Student code solution entered.');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'flow_step2_student_submitted.png') });
    fs.copyFileSync(
      path.join(ARTIFACT_DIR, 'flow_step2_student_submitted.png'),
      'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\flow_step2_student_submitted.png'
    );

    console.log('Student clicks Submit button...');
    const submitBtn = studentCard.locator('button[type="submit"]', { hasText: /Submit/i }).first();
    await submitBtn.click();
    await sleep(3500);

    console.log('Switching to Past tab to verify submission state...');
    const pastTab = page.locator('button[role="tab"]', { hasText: 'Past' }).first();
    if (await pastTab.isVisible().catch(() => false)) {
      await pastTab.click();
      await sleep(2500);
    }

    // =========================================================================
    // SCENE 3: INSTRUCTOR REVIEWS & MARKS CODE IN LIVE CLASSROOM
    // =========================================================================
    console.log('\n========================================');
    console.log('SCENE 3: INSTRUCTOR REVIEWS & MARKS STUDENT CODE');
    console.log('========================================');
    await setAuthCookie(context, instructorToken);

    console.log(`Instructor entering live session: /sessions/${sessionId}...`);
    await page.goto(`http://localhost:3000/sessions/${sessionId}`, { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    // Prejoin lobby entry
    const joinBtn = page.locator('button', { hasText: /Open the room|Join class/i }).first();
    if (await joinBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Entering live room from prejoin lobby...');
      await joinBtn.click();
      await sleep(3500);
    }

    console.log('Opening Grade assignments panel in classroom...');
    const gradePanelBtn = page.locator('button[title="Grade assignments"], button[aria-label="Grade assignments"]').first();
    if (await gradePanelBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
      await gradePanelBtn.click();
      console.log('Grade assignments panel opened.');
    } else {
      const fallbackBtn = page.locator('button:has(svg.h-4.w-4)').filter({ hasText: '' }).first();
      await fallbackBtn.click().catch(() => {});
    }
    await sleep(2500);

    console.log(`Locating assignment accordion for "${taskTitle}"...`);
    const assignmentAccordion = page.locator('button').filter({ hasText: taskTitle }).first();
    await assignmentAccordion.waitFor({ timeout: 10000 });
    await assignmentAccordion.click();
    console.log('Assignment accordion clicked to expand student submission.');
    await sleep(2500);

    console.log('Inspecting student submission code, entering grade 98...');
    const gradeInput = page.locator('input[placeholder*="Grade"], input[type="number"]').first();
    await gradeInput.waitFor({ timeout: 8000 });
    await gradeInput.fill('98');
    await sleep(1000);

    console.log('Clicking the official Grade save button right beside the input...');
    const gradeSubmitBtn = gradeInput.locator('xpath=following-sibling::button').first();
    await gradeSubmitBtn.click();
    await sleep(3000);

    console.log('Capturing Milestone 3: Submission marked with verified checkmark & grade pill.');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'flow_step3_reviewed_graded.png') });
    fs.copyFileSync(
      path.join(ARTIFACT_DIR, 'flow_step3_reviewed_graded.png'),
      'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\flow_step3_reviewed_graded.png'
    );
    await sleep(2500);

    // =========================================================================
    // SCENE 4: REAL-TIME COLLABORATIVE CODE EDITOR (STAGE)
    // =========================================================================
    console.log('\n========================================');
    console.log('SCENE 4: REAL-TIME COLLABORATIVE CODEBOARD');
    console.log('========================================');
    console.log('Switching stage to Code mode...');
    const codeModeBtn = page.locator('button', { hasText: 'Code' }).first();
    if (await codeModeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await codeModeBtn.click();
      await sleep(2500);

      const editor = page.locator('.cm-content').first();
      if (await editor.isVisible({ timeout: 6000 }).catch(() => false)) {
        await editor.click();
        await sleep(600);
        const liveInstructorCode = `// Instructor Classroom Code Review\nconsole.log("Verified Lomuto partition implementation: O(N) runtime confirmed! Grade: 98/100");\n`;
        await page.keyboard.type(liveInstructorCode, { delay: 25 });
        await sleep(2500);
      }
    }

    console.log('Capturing Milestone 4: Collaborative CodeBoard active.');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'flow_step4_live_editor.png') });
    fs.copyFileSync(
      path.join(ARTIFACT_DIR, 'flow_step4_live_editor.png'),
      'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\flow_step4_live_editor.png'
    );
    await sleep(4000);

    console.log('\n*** COMPLETE FULL E2E WORKFLOW SUCCESSFULLY EXECUTED AND RECORDED! ***');
  } catch (err) {
    console.error('Error during recording execution:', err);
  } finally {
    console.log('Finalizing video file...');
    const video = page.video();
    await page.close();
    await context.close();
    await browser.close();

    if (video) {
      const originalPath = await video.path();
      console.log('Raw video recorded at:', originalPath);
      const destPath = path.join(ARTIFACT_DIR, 'code_instructor_flow.webm');
      fs.copyFileSync(originalPath, destPath);

      const publicPath = 'c:\\Users\\User\\OneDrive\\Documents\\netplus\\livetich-web\\public\\code_instructor_flow.webm';
      fs.copyFileSync(originalPath, publicPath);

      const stats = fs.statSync(destPath);
      console.log(`Final video size: ${(stats.size / 1024).toFixed(1)} KB`);
    }
  }
}

run();
