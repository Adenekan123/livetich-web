'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { CourseDetail } from '@/lib/types';

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
  const meetingDays = formData
    .getAll('meetingDays')
    .map((d) => Number(d))
    .filter((d) => !Number.isNaN(d));
  const durationWeeks = formData.get('durationWeeks');
  const startDate = formData.get('startDate') as string;

  let course: CourseDetail;
  try {
    course = await api<CourseDetail>('/courses', {
      method: 'POST',
      token,
      body: {
        title: formData.get('title'),
        description: formData.get('description') || undefined,
        category: formData.get('category') || undefined,
        level: formData.get('level') || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        durationWeeks: durationWeeks ? Number(durationWeeks) : undefined,
        meetingDays: meetingDays.length ? meetingDays : undefined,
        meetingTime: formData.get('meetingTime') || undefined,
        timezone: formData.get('timezone') || undefined,
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

/** Records that the student tapped "Add to calendar" for this class. */
export async function recordReminderAdded(courseId: string): Promise<void> {
  await run(
    (token) =>
      api(`/courses/${courseId}/reminder`, { method: 'POST', token }),
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

/** Org admin adds a specific student to a program. */
export async function addStudentToCourse(
  courseId: string,
  studentId: string,
): Promise<ActionState> {
  const state = await run(
    (token) =>
      api(`/courses/${courseId}/students`, {
        method: 'POST',
        token,
        body: { studentId },
      }),
    `/courses/${courseId}`,
  );
  revalidatePath('/account/students');
  return state;
}

/** Org admin removes a specific student from a program. */
export async function removeStudentFromCourse(
  courseId: string,
  studentId: string,
): Promise<ActionState> {
  const state = await run(
    (token) =>
      api(`/courses/${courseId}/students/${studentId}`, {
        method: 'DELETE',
        token,
      }),
    `/courses/${courseId}`,
  );
  revalidatePath('/account/students');
  return state;
}

/**
 * Enter today's live session for a course. The backend materialises the
 * occurrence, then we route the user into the classroom. Only reachable on a
 * scheduled meeting day (the button is disabled otherwise).
 */
export async function joinLiveSession(courseId: string): Promise<ActionState> {
  const token = await getToken();
  if (!token) redirect('/login');
  let res: { sessionId: string };
  try {
    res = await api<{ sessionId: string }>(`/sessions/course/${courseId}/join`, {
      method: 'POST',
      token,
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  redirect(`/sessions/${res.sessionId}`);
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

/** Admin issues a certificate to one enrolled student, straight from the roster. */
export async function issueCertificateFor(
  courseId: string,
  studentId: string,
): Promise<ActionState> {
  return run(
    (token) =>
      api('/certificates', {
        method: 'POST',
        token,
        body: { courseId, studentId },
      }),
    `/courses/${courseId}`,
  );
}
