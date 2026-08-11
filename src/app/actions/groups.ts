'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';

export interface GroupActionState {
  error: string | null;
  ok?: boolean;
}

async function tokenOrLogin(): Promise<string> {
  const token = await getToken();
  if (!token) redirect('/login');
  return token;
}

/** Wraps a group mutation and revalidates the course's groups page. */
async function run(
  courseId: string,
  fn: (token: string) => Promise<unknown>,
): Promise<GroupActionState> {
  const token = await tokenOrLogin();
  try {
    await fn(token);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/courses/${courseId}/groups`);
  revalidatePath(`/courses/${courseId}/assignments`);
  revalidatePath(`/courses/${courseId}`);
  return { error: null, ok: true };
}

export async function createGroup(
  courseId: string,
  name: string,
): Promise<GroupActionState> {
  return run(courseId, (token) =>
    api(`/courses/${courseId}/groups`, { method: 'POST', token, body: { name } }),
  );
}

export async function renameGroup(
  courseId: string,
  groupId: string,
  name: string,
): Promise<GroupActionState> {
  return run(courseId, (token) =>
    api(`/courses/${courseId}/groups/${groupId}`, {
      method: 'PATCH',
      token,
      body: { name },
    }),
  );
}

export async function deleteGroup(
  courseId: string,
  groupId: string,
): Promise<GroupActionState> {
  return run(courseId, (token) =>
    api(`/courses/${courseId}/groups/${groupId}`, { method: 'DELETE', token }),
  );
}

export async function setGroupMembers(
  courseId: string,
  groupId: string,
  studentIds: string[],
): Promise<GroupActionState> {
  return run(courseId, (token) =>
    api(`/courses/${courseId}/groups/${groupId}/members`, {
      method: 'PATCH',
      token,
      body: { studentIds },
    }),
  );
}
