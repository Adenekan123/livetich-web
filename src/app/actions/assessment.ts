'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { AssessmentResult } from '@/lib/types';

export interface AssessmentActionState {
  error: string | null;
  ok?: boolean;
}

async function tokenOrLogin(): Promise<string> {
  const token = await getToken();
  if (!token) redirect('/login');
  return token;
}

async function run(
  fn: (token: string) => Promise<unknown>,
  ...revalidate: string[]
): Promise<AssessmentActionState> {
  const token = await tokenOrLogin();
  try {
    await fn(token);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  for (const p of revalidate) revalidatePath(p);
  return { error: null, ok: true };
}

// ---- Release control (manager) ----

/** Toggle whether class-end quizzes release instantly or are held for review. */
export async function setInstantAssessment(
  courseId: string,
  instant: boolean,
): Promise<AssessmentActionState> {
  return run(
    (token) =>
      api(`/courses/${courseId}/assessment/settings`, {
        method: 'PATCH',
        token,
        body: { instantClassAssessment: instant },
      }),
    `/courses/${courseId}/assessment`,
  );
}

/** Release a held class-end quiz to students. */
export async function releaseAssessment(
  courseId: string,
  assessmentId: string,
): Promise<AssessmentActionState> {
  return run(
    (token) =>
      api(`/assessments/${assessmentId}/release`, { method: 'POST', token }),
    `/courses/${courseId}/assessment`,
  );
}

// ---- Authoring: questions ----

export async function createQuestion(
  courseId: string,
  input: { sectionId: string; body: string; options: string[]; correctIndex: number },
): Promise<AssessmentActionState> {
  return run(
    (token) =>
      api(`/courses/${courseId}/assessment/questions`, {
        method: 'POST',
        token,
        body: input,
      }),
    `/courses/${courseId}/assessment`,
  );
}

export async function deleteQuestion(
  courseId: string,
  questionId: string,
): Promise<AssessmentActionState> {
  return run(
    (token) =>
      api(`/courses/${courseId}/assessment/questions/${questionId}`, {
        method: 'DELETE',
        token,
      }),
    `/courses/${courseId}/assessment`,
  );
}

// ---- Authoring: remediation tasks ----

export async function createTask(
  courseId: string,
  input: { sectionId: string; title: string; instructions?: string },
): Promise<AssessmentActionState> {
  return run(
    (token) =>
      api(`/courses/${courseId}/assessment/tasks`, {
        method: 'POST',
        token,
        body: input,
      }),
    `/courses/${courseId}/assessment`,
  );
}

export async function deleteTask(
  courseId: string,
  taskId: string,
): Promise<AssessmentActionState> {
  return run(
    (token) =>
      api(`/courses/${courseId}/assessment/tasks/${taskId}`, {
        method: 'DELETE',
        token,
      }),
    `/courses/${courseId}/assessment`,
  );
}

// ---- Student: take + remediation ----

/** Submits answers, returns the graded result (score + any assigned tasks). */
export async function submitAssessment(
  courseId: string,
  assessmentId: string,
  answers: { questionId: string; answerIndex: number }[],
): Promise<{ error: string | null; result?: AssessmentResult }> {
  const token = await tokenOrLogin();
  try {
    const result = await api<AssessmentResult>(
      `/assessments/${assessmentId}/submit`,
      { method: 'POST', token, body: { answers } },
    );
    revalidatePath(`/courses/${courseId}/assessment`);
    return { error: null, result };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

export async function markRemediationDone(
  courseId: string,
  remediationId: string,
): Promise<AssessmentActionState> {
  return run(
    (token) =>
      api(`/remediation/${remediationId}/done`, { method: 'POST', token }),
    `/courses/${courseId}/assessment`,
  );
}
