import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError } from './api';
import { getToken } from './auth';

/** Parked step-up token proving a recent password re-auth for the admin console. */
export const ADMIN_STEP_COOKIE = 'lt_admin_step';

export async function getStepUp(): Promise<string | null> {
  return (await cookies()).get(ADMIN_STEP_COOKIE)?.value ?? null;
}

/**
 * Fetch an /admin API route with both the session token AND the step-up token.
 * If the step-up is missing or the API rejects it (STEP_UP_REQUIRED), the
 * operator is sent to the unlock page to re-enter their password. Use this for
 * every admin data fetch so the step-up gate is enforced server-side, not just
 * in the UI.
 */
export async function adminApi<T>(
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
