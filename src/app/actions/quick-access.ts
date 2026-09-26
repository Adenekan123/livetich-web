'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken, TOKEN_COOKIE } from '@/lib/auth';
import type { AuthResult } from '@/lib/types';

/** Matches the API's 7d JWT expiry, as the password login does. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export interface QuickAccessState {
  error: string | null;
}

/**
 * Redeem a shortcut: slug from the URL, six digits from the student.
 *
 * The session this sets is the same one a password login sets — same token,
 * same cookie, same expiry — so nothing downstream has to know the student
 * arrived this way.
 */
export async function redeemQuickAccess(
  slug: string,
  _prev: QuickAccessState,
  formData: FormData,
): Promise<QuickAccessState> {
  let result: AuthResult;
  try {
    result = await api<AuthResult>(
      `/auth/quick-access/${encodeURIComponent(slug)}`,
      { method: 'POST', body: { passcode: String(formData.get('passcode') ?? '') } },
    );
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  (await cookies()).set(TOKEN_COOKIE, result.accessToken, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
  // Back to the shortcut, which now renders today's classes rather than the
  // passcode screen. Keeping the URL the same is what lets the home-screen icon
  // be the one destination a student ever needs.
  redirect(`/q/${encodeURIComponent(slug)}`);
}

/** Create or rotate the signed-in student's shortcut. */
export async function setQuickAccess(
  _prev: { error: string | null; slug?: string },
  formData: FormData,
): Promise<{ error: string | null; slug?: string }> {
  const token = await getToken();
  if (!token) return { error: 'Sign in first' };
  try {
    const res = await api<{ slug: string }>('/auth/quick-access', {
      method: 'POST',
      token,
      body: { passcode: String(formData.get('passcode') ?? '') },
    });
    return { error: null, slug: res.slug };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}

/** Turn the shortcut off; the old link stops working immediately. */
export async function revokeQuickAccess(): Promise<{ error: string | null }> {
  const token = await getToken();
  if (!token) return { error: 'Sign in first' };
  try {
    await api('/auth/quick-access', { method: 'DELETE', token });
    return { error: null };
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
}
