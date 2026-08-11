'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { HifzKind } from '@/lib/types';

export interface HifzActionState {
  error: string | null;
  ok?: boolean;
}

async function tokenOrLogin(): Promise<string> {
  const token = await getToken();
  if (!token) redirect('/login');
  return token;
}

/** Wraps a Hifz mutation and revalidates the course's Hifz page. */
async function run(
  courseId: string,
  fn: (token: string) => Promise<unknown>,
): Promise<HifzActionState> {
  const token = await tokenOrLogin();
  try {
    await fn(token);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/courses/${courseId}/hifz`);
  revalidatePath(`/courses/${courseId}`);
  return { error: null, ok: true };
}

export interface TargetInput {
  studentId: string;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  dueAt?: string | null;
  note?: string | null;
}

export async function createHifzTarget(
  courseId: string,
  input: TargetInput,
): Promise<HifzActionState> {
  return run(courseId, (token) =>
    api(`/courses/${courseId}/hifz/targets`, {
      method: 'POST',
      token,
      body: {
        studentId: input.studentId,
        surahNumber: input.surahNumber,
        ayahStart: input.ayahStart,
        ayahEnd: input.ayahEnd,
        dueAt: input.dueAt || undefined,
        note: input.note || undefined,
      },
    }),
  );
}

export async function deleteHifzTarget(
  courseId: string,
  targetId: string,
): Promise<HifzActionState> {
  return run(courseId, (token) =>
    api(`/courses/${courseId}/hifz/targets/${targetId}`, {
      method: 'DELETE',
      token,
    }),
  );
}

export interface EntryInput {
  studentId: string;
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
  kind: HifzKind;
  rating?: number | null;
  tajweed?: string | null;
  notes?: string | null;
}

export async function logHifzEntry(
  courseId: string,
  input: EntryInput,
): Promise<HifzActionState> {
  return run(courseId, (token) =>
    api(`/courses/${courseId}/hifz/entries`, {
      method: 'POST',
      token,
      body: {
        studentId: input.studentId,
        surahNumber: input.surahNumber,
        ayahStart: input.ayahStart,
        ayahEnd: input.ayahEnd,
        kind: input.kind,
        rating: input.rating ?? undefined,
        tajweed: input.tajweed || undefined,
        notes: input.notes || undefined,
      },
    }),
  );
}

export async function deleteHifzEntry(
  courseId: string,
  entryId: string,
): Promise<HifzActionState> {
  return run(courseId, (token) =>
    api(`/courses/${courseId}/hifz/entries/${entryId}`, {
      method: 'DELETE',
      token,
    }),
  );
}
