'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken, TOKEN_COOKIE } from '@/lib/auth';
import { ADMIN_STEP_COOKIE, ADMIN_TOKEN_COOKIE, getStepUp } from '@/lib/admin-api';
import type { Role, UserStatus } from '@/lib/types';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const STEP_MAX_AGE = 30 * 60; // matches the API step-up token TTL

function cookieOpts(maxAge: number) {
  return {
    path: '/',
    maxAge,
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  };
}

type Result = { error: string | null; ok?: boolean };

/**
 * Call an /admin API route with the session token AND the step-up token. Missing
 * or stale step-up (STEP_UP_REQUIRED — e.g. a destructive action past its 5-min
 * fresh-password window) sends the operator to re-enter their password.
 */
async function callAdmin<T>(
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const token = await getToken();
  if (!token) redirect('/login');
  const step = await getStepUp();
  if (!step) redirect('/admin-unlock');
  try {
    return await api<T>(path, {
      ...opts,
      token,
      headers: { 'x-admin-step-up': step },
    });
  } catch (e) {
    if (e instanceof ApiError && e.message === 'STEP_UP_REQUIRED') {
      redirect('/admin-unlock');
    }
    throw e;
  }
}

async function mutate(
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown },
): Promise<Result> {
  try {
    await callAdmin(path, opts);
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  revalidatePath('/admin/users');
  revalidatePath('/admin');
  return { error: null, ok: true };
}

export async function setUserStatus(id: string, status: UserStatus) {
  return mutate(`/admin/users/${id}/status`, { method: 'POST', body: { status } });
}

export async function setUserRole(id: string, role: Role) {
  return mutate(`/admin/users/${id}/role`, { method: 'POST', body: { role } });
}

export async function setSuperAdmin(id: string, value: boolean) {
  return mutate(`/admin/users/${id}/super-admin`, {
    method: 'POST',
    body: { value },
  });
}

export async function sendResetLink(id: string) {
  return mutate(`/admin/users/${id}/reset-link`, { method: 'POST' });
}

export async function verifyUserEmail(id: string) {
  return mutate(`/admin/users/${id}/verify-email`, { method: 'POST' });
}

/**
 * Log in AS a user for support/debugging. Requires a fresh step-up. Parks the
 * operator's own token so "Stop impersonating" can restore it, swaps in the
 * 30-min impersonation token, and lands on the app as that user.
 */
export async function impersonate(id: string): Promise<Result> {
  let impToken: string;
  try {
    const res = await callAdmin<{ token: string }>(
      `/admin/users/${id}/impersonate`,
      { method: 'POST' },
    );
    impToken = res.token;
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  const jar = await cookies();
  const own = jar.get(TOKEN_COOKIE)?.value;
  if (own) jar.set(ADMIN_TOKEN_COOKIE, own, cookieOpts(COOKIE_MAX_AGE));
  jar.set(TOKEN_COOKIE, impToken, cookieOpts(30 * 60));
  redirect('/dashboard');
}

/** Restore the operator's parked token and return to the admin console. */
export async function stopImpersonating(): Promise<void> {
  const jar = await cookies();
  const own = jar.get(ADMIN_TOKEN_COOKIE)?.value;
  if (own) {
    jar.set(TOKEN_COOKIE, own, cookieOpts(COOKIE_MAX_AGE));
    jar.delete(ADMIN_TOKEN_COOKIE);
  }
  redirect('/admin/users');
}

/**
 * Step-up unlock: re-verify the operator's password to (re)issue the step-up
 * token that the admin console requires. Lands back where they were headed.
 */
export async function adminUnlock(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/admin');
  const token = await getToken();
  if (!token) redirect('/login');
  let stepUpToken: string;
  try {
    const res = await api<{ stepUpToken: string }>('/auth/admin-reauth', {
      method: 'POST',
      token,
      body: { password },
    });
    stepUpToken = res.stepUpToken;
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  (await cookies()).set(ADMIN_STEP_COOKIE, stepUpToken, cookieOpts(STEP_MAX_AGE));
  redirect(next.startsWith('/admin') ? next : '/admin');
}
