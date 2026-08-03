'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';

export interface AssignmentActionState {
  error: string | null;
  ok?: boolean;
}

async function tokenOrLogin(): Promise<string> {
  const token = await getToken();
  if (!token) redirect('/login');
  return token;
}

export async function createAssignment(
  _prev: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const courseId = formData.get('courseId') as string;
  const token = await tokenOrLogin();
  const maxPoints = formData.get('maxPoints');
  const dueAt = formData.get('dueAt') as string;
  try {
    await api(`/courses/${courseId}/assignments`, {
      method: 'POST',
      token,
      body: {
        title: formData.get('title'),
        instructions: formData.get('instructions') || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        maxPoints: maxPoints ? Number(maxPoints) : undefined,
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/courses/${courseId}`);
  return { error: null, ok: true };
}

export async function submitAssignment(
  _prev: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const courseId = formData.get('courseId') as string;
  const assignmentId = formData.get('assignmentId') as string;
  const token = await tokenOrLogin();
  try {
    await api(`/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      token,
      body: {
        content: formData.get('content') || undefined,
        fileUrl: formData.get('fileUrl') || undefined,
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/courses/${courseId}`);
  return { error: null, ok: true };
}

export async function gradeSubmission(
  _prev: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const submissionId = formData.get('submissionId') as string;
  const courseId = formData.get('courseId') as string;
  const assignmentId = formData.get('assignmentId') as string;
  const token = await tokenOrLogin();
  try {
    await api(`/submissions/${submissionId}`, {
      method: 'PATCH',
      token,
      body: {
        grade: Number(formData.get('grade')),
        feedback: formData.get('feedback') || undefined,
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/courses/${courseId}/assignments/${assignmentId}`);
  return { error: null, ok: true };
}
