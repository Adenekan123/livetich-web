'use server';

import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type {
  AlocDraftResult,
  ExamDetail,
  ExamResults,
  ExamReview,
  ExamStart,
  ExamSubmitResult,
  ExamQuestionInput,
} from '@/lib/types';

async function tokenOrLogin(): Promise<string> {
  const token = await getToken();
  if (!token) redirect('/login');
  return token;
}

/** Pull draft questions from ALOC for the builder (1 credit per cache miss). */
export async function importAlocQuestions(params: {
  subject: string;
  examType: string;
  year?: number;
  limit?: number;
}): Promise<{ result?: AlocDraftResult; error?: string }> {
  const token = await tokenOrLogin();
  const qs = new URLSearchParams({
    subject: params.subject,
    examType: params.examType,
  });
  if (params.year) qs.set('year', String(params.year));
  if (params.limit) qs.set('limit', String(params.limit));
  try {
    const result = await api<AlocDraftResult>(`/exams/import/aloc?${qs}`, { token });
    return { result };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Import failed' };
  }
}

export async function createExam(
  courseId: string,
  payload: { title: string; durationMinutes: number; questions: ExamQuestionInput[] },
): Promise<{ id?: string; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const exam = await api<{ id: string }>(`/courses/${courseId}/exams`, {
      method: 'POST',
      token,
      body: payload,
    });
    return { id: exam.id };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Could not create exam' };
  }
}

export async function getExamDetail(
  courseId: string,
  examId: string,
): Promise<{ exam?: ExamDetail; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const exam = await api<ExamDetail>(`/courses/${courseId}/exams/${examId}`, {
      token,
    });
    return { exam };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Could not load exam' };
  }
}

export async function updateExam(
  courseId: string,
  examId: string,
  payload: {
    title?: string;
    durationMinutes?: number;
    questions?: ExamQuestionInput[];
  },
): Promise<{ id?: string; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const exam = await api<{ id: string }>(
      `/courses/${courseId}/exams/${examId}`,
      { method: 'PATCH', token, body: payload },
    );
    return { id: exam.id };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Could not update exam' };
  }
}

export async function deleteExam(
  courseId: string,
  examId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const token = await tokenOrLogin();
  try {
    await api(`/courses/${courseId}/exams/${examId}`, { method: 'DELETE', token });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Could not delete exam' };
  }
}

export async function getExamResults(
  examId: string,
): Promise<{ results?: ExamResults; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const results = await api<ExamResults>(`/exams/${examId}/results`, { token });
    return { results };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Could not load results' };
  }
}

export async function getExamReview(
  examId: string,
): Promise<{ review?: ExamReview; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const review = await api<ExamReview>(`/exams/${examId}/review`, { token });
    return { review };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Could not load review' };
  }
}

export async function startExam(
  examId: string,
): Promise<{ take?: ExamStart; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const take = await api<ExamStart>(`/exams/${examId}/attempts`, {
      method: 'POST',
      token,
    });
    return { take };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Could not start exam' };
  }
}

export async function submitExam(
  attemptId: string,
  answers: { questionId: string; chosenIndex: number }[],
): Promise<{ result?: ExamSubmitResult; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const result = await api<ExamSubmitResult>(`/attempts/${attemptId}/submit`, {
      method: 'POST',
      token,
      body: { answers },
    });
    return { result };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Could not submit' };
  }
}
