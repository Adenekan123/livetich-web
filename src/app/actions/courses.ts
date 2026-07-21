'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { CourseDetail, LiveSession } from '@/lib/types';

export interface ActionState {
  error: string | null;
}

/** Wraps an API mutation into the useActionState contract. */
async function run(
  fn: (token: string) => Promise<unknown>,
  revalidate?: string,
): Promise<ActionState> {
  const token = await getToken();
  if (!token) redirect('/login');
  try {
    await fn(token);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  if (revalidate) revalidatePath(revalidate);
  return { error: null };
}

export async function createCourse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = await getToken();
  if (!token) redirect('/login');
  let course: CourseDetail;
  try {
    course = await api<CourseDetail>('/courses', {
      method: 'POST',
      token,
      body: {
        title: formData.get('title'),
        description: formData.get('description') || undefined,
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  redirect(`/courses/${course.id}`);
}

export async function addSection(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = formData.get('courseId') as string;
  return run(
    (token) =>
      api(`/courses/${courseId}/sections`, {
        method: 'POST',
        token,
        body: { title: formData.get('title') },
      }),
    `/courses/${courseId}`,
  );
}

export async function enroll(courseId: string): Promise<void> {
  await run(
    (token) => api(`/courses/${courseId}/enroll`, { method: 'POST', token }),
    `/courses/${courseId}`,
  );
}

export async function unenroll(courseId: string): Promise<void> {
  await run(
    (token) => api(`/courses/${courseId}/enroll`, { method: 'DELETE', token }),
    `/courses/${courseId}`,
  );
}

export async function scheduleSession(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = formData.get('courseId') as string;
  const sectionId = formData.get('sectionId') as string;
  const scheduledAt = formData.get('scheduledAt') as string;
  return run(
    (token) =>
      api<LiveSession>('/sessions', {
        method: 'POST',
        token,
        body: {
          courseId,
          sectionId: sectionId || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
        },
      }),
    `/courses/${courseId}`,
  );
}

export async function startSession(
  sessionId: string,
  courseId: string,
): Promise<void> {
  await run(
    (token) => api(`/sessions/${sessionId}/start`, { method: 'POST', token }),
    `/courses/${courseId}`,
  );
}

export async function endSession(
  sessionId: string,
  courseId: string,
): Promise<void> {
  await run(
    (token) => api(`/sessions/${sessionId}/end`, { method: 'POST', token }),
    `/courses/${courseId}`,
  );
}

export async function issueCertificate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = formData.get('courseId') as string;
  return run(
    (token) =>
      api('/certificates', {
        method: 'POST',
        token,
        body: { courseId, studentId: formData.get('studentId') },
      }),
    `/courses/${courseId}`,
  );
}
