'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { CourseDetail } from '@/lib/types';

export interface ActionState {
  error: string | null;
  /** Bumped on each successful mutation so client forms can react (e.g. close a modal). */
  ok?: number;
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
  return { error: null, ok: Date.now() };
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

/**
 * Create a batch (a scheduled instance) of an existing program. The batch
 * inherits the program's identity + content; here we send only its label and
 * schedule. On success we jump to the new batch's page.
 */
export async function createBatch(
  programId: string,
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

  let batch: CourseDetail;
  try {
    batch = await api<CourseDetail>(`/courses/${programId}/batches`, {
      method: 'POST',
      token,
      body: {
        label: formData.get('label') || undefined,
        instructorId: formData.get('instructorId') || undefined,
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
  redirect(`/courses/${batch.id}`);
}

/**
 * Edit an existing program — owning admin or the assigned instructor (the API
 * enforces both). Covers the cohort schedule (days, time, timezone, start,
 * duration) alongside the basics. Meeting days are always sent (even when empty)
 * so unchecking every day clears the cadence; the other fields are omitted when
 * blank so a partial edit never wipes them.
 */
export async function updateCourse(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = formData.get('courseId') as string;
  const meetingDays = formData
    .getAll('meetingDays')
    .map((d) => Number(d))
    .filter((d) => !Number.isNaN(d));
  const startDate = (formData.get('startDate') as string) || '';
  const durationWeeks = formData.get('durationWeeks');
  return run(
    (token) =>
      api(`/courses/${courseId}`, {
        method: 'PATCH',
        token,
        body: {
          title: formData.get('title'),
          description: (formData.get('description') as string) ?? '',
          category: (formData.get('category') as string) || undefined,
          level: (formData.get('level') as string) || undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          durationWeeks: durationWeeks ? Number(durationWeeks) : undefined,
          meetingDays,
          meetingTime: (formData.get('meetingTime') as string) || undefined,
          timezone: (formData.get('timezone') as string) || undefined,
        },
      }),
    `/courses/${courseId}`,
  );
}

export async function addSection(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = formData.get('courseId') as string;
  const description = (formData.get('description') as string)?.trim();
  return run(
    (token) =>
      api(`/courses/${courseId}/sections`, {
        method: 'POST',
        token,
        body: { title: formData.get('title'), description: description || undefined },
      }),
    `/courses/${courseId}`,
  );
}

/**
 * Turn a pasted document table of contents into curriculum section titles.
 * Strips the noise a copied TOC carries — leading numbering (1., 1.2, IV.),
 * "Chapter/Unit/Part N" prefixes, bullets, and trailing dot-leaders + page
 * numbers ("Introduction .......... 5") — leaving just the heading text.
 */
function parseToc(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\.{2,}\s*\d+\s*$/, '') // dot leaders + page no: "Intro .... 5"
        .replace(/\s{2,}\d+\s*$/, '') // trailing page number after a gap
        .replace(/^[\s\-*•·—]+/, '') // leading bullets / dashes
        .replace(
          /^(chapter|section|unit|part|module|lesson|week)\s+[\dIVXLC]+\s*[:.)\-]*\s*/i,
          '',
        ) // "Chapter 1: " / "Week 3 - "
        .replace(/^[\dIVXLC]+\s*[.)]\s*/i, '') // "1. " / "1) " / "IV. "
        .replace(/^\d+(\.\d+)+\s+/, '') // "1.2.3 "
        .trim(),
    )
    .filter((t) => t.length > 0 && t.length <= 200);
}

/**
 * Populate the curriculum in bulk from a document's table of contents — one
 * section per heading, created in the pasted order. Owner-only (the API's
 * section create already enforces it).
 */
export async function importSectionsFromToc(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const courseId = formData.get('courseId') as string;
  const titles = parseToc((formData.get('toc') as string) ?? '').slice(0, 50);
  if (titles.length === 0) {
    return {
      error:
        'No headings found — paste a table of contents with one heading per line.',
    };
  }
  return run(async (token) => {
    for (const title of titles) {
      await api(`/courses/${courseId}/sections`, {
        method: 'POST',
        token,
        body: { title },
      });
    }
  }, `/courses/${courseId}`);
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

/** Org admin assigns the instructor who teaches a program (null = unassign). */
export async function assignInstructor(
  courseId: string,
  instructorId: string | null,
): Promise<ActionState> {
  return run(
    (token) =>
      api(`/courses/${courseId}/instructor`, {
        method: 'PATCH',
        token,
        body: { instructorId: instructorId ?? undefined },
      }),
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
export async function joinLiveSession(
  courseId: string,
  /** 'teach' lets a solo-teacher admin enter as the instructor (go live);
   *  omitted, an admin shadow-joins as a hidden observer. */
  mode?: 'teach',
): Promise<ActionState> {
  const token = await getToken();
  if (!token) redirect('/login');
  const qs = mode === 'teach' ? '?as=teach' : '';
  let res: { sessionId: string };
  try {
    res = await api<{ sessionId: string }>(
      `/sessions/course/${courseId}/join${qs}`,
      { method: 'POST', token },
    );
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  redirect(`/sessions/${res.sessionId}${qs}`);
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
