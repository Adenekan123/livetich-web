'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, API_URL, ApiError, baseUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { CourseDocument, DraftResult } from '@/lib/types';

async function tokenOrLogin(): Promise<string> {
  const token = await getToken();
  if (!token) redirect('/login');
  return token;
}

/** Upload a PDF/DOCX (multipart) to ground AI drafting. */
export async function uploadDocument(
  courseId: string,
  formData: FormData,
): Promise<{ error: string | null; doc?: CourseDocument }> {
  const token = await tokenOrLogin();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a PDF or Word (.docx) file' };
  }
  const fwd = new FormData();
  fwd.append('file', file);

  let res: Response;
  try {
    // Server-side base URL (internal Docker network when set) — the public URL
    // hairpins from inside the web container and fails.
    res = await fetch(`${baseUrl()}/courses/${courseId}/assessment/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fwd,
      cache: 'no-store',
    });
  } catch {
    return { error: `Could not reach the API at ${API_URL}.` };
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data: { message?: string | string[] } = await res.json();
      if (data.message) {
        message = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message;
      }
    } catch {
      // keep status text
    }
    return { error: message };
  }
  revalidatePath(`/courses/${courseId}/assessment`);
  return { error: null, doc: (await res.json()) as CourseDocument };
}

export async function deleteDocument(
  courseId: string,
  documentId: string,
): Promise<{ error: string | null }> {
  const token = await tokenOrLogin();
  try {
    await api(`/courses/${courseId}/assessment/documents/${documentId}`, {
      method: 'DELETE',
      token,
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/courses/${courseId}/assessment`);
  return { error: null };
}

/** Ask Gemini to draft questions + tasks for a section from a document. */
export async function draftFromDocument(
  courseId: string,
  input: { documentId: string; sectionId: string; count: number },
): Promise<{ error: string | null; result?: DraftResult }> {
  const token = await tokenOrLogin();
  try {
    const result = await api<DraftResult>(
      `/courses/${courseId}/assessment/draft`,
      { method: 'POST', token, body: input, timeoutMs: 60_000 },
    );
    return { error: null, result };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

/** Save reviewed drafts into the bank (batch). */
export async function acceptDrafts(
  courseId: string,
  sectionId: string,
  questions: { body: string; options: string[]; correctIndex: number }[],
  tasks: { title: string; instructions?: string }[],
): Promise<{ error: string | null }> {
  const token = await tokenOrLogin();
  try {
    if (questions.length) {
      await api(`/courses/${courseId}/assessment/questions/batch`, {
        method: 'POST',
        token,
        body: { sectionId, questions },
      });
    }
    if (tasks.length) {
      await api(`/courses/${courseId}/assessment/tasks/batch`, {
        method: 'POST',
        token,
        body: { sectionId, tasks },
      });
    }
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/courses/${courseId}/assessment`);
  return { error: null };
}
