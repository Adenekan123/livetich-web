'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { TOKEN_COOKIE } from '@/lib/auth';
import type { AuthResult } from '@/lib/types';

export interface AuthFormState {
  error: string | null;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // matches the API's 7d JWT expiry

async function setToken(token: string) {
  (await cookies()).set(TOKEN_COOKIE, token, {
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    sameSite: 'lax',
    // httpOnly so XSS can't read the session. Realtime clients get the token
    // from the /api/realtime-token route (server-side cookie read) instead.
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let result: AuthResult;
  try {
    result = await api<AuthResult>('/auth/login', {
      method: 'POST',
      body: {
        email: formData.get('email'),
        password: formData.get('password'),
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  await setToken(result.accessToken);
  redirect(result.user.emailVerified ? '/dashboard' : '/verify-email');
}

/** Student/instructor signup via an org invite link (token from the join page). */
export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let result: AuthResult;
  try {
    result = await api<AuthResult>('/auth/register', {
      method: 'POST',
      body: {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        inviteToken: formData.get('inviteToken'),
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  await setToken(result.accessToken);
  redirect(result.user.emailVerified ? '/dashboard' : '/verify-email');
}

/** Company signup — creates the organization and its first admin together. */
export async function registerOrganization(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  let result: AuthResult;
  try {
    result = await api<AuthResult>('/auth/register-organization', {
      method: 'POST',
      body: {
        organizationName: formData.get('organizationName'),
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        tagline: formData.get('tagline') || undefined,
        primaryColor: formData.get('primaryColor') || undefined,
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  await setToken(result.accessToken);
  redirect(result.user.emailVerified ? '/dashboard' : '/verify-email');
}

export interface PasswordFormState {
  error: string | null;
  ok?: boolean;
}

export async function changePassword(
  _prev: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (newPassword !== confirm) {
    return { error: 'New passwords do not match', ok: false };
  }
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) redirect('/login');
  try {
    await api('/auth/change-password', {
      method: 'POST',
      token,
      body: {
        currentPassword: formData.get('currentPassword'),
        newPassword,
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, ok: false };
    throw e;
  }
  return { error: null, ok: true };
}

export async function logout() {
  (await cookies()).delete(TOKEN_COOKIE);
  redirect('/login');
}

/** Sends (or resends) the email-verification code to the logged-in user. */
export async function sendVerification(): Promise<{ error: string | null }> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) redirect('/login');
  try {
    await api('/auth/send-verification', { method: 'POST', token });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  return { error: null };
}

export interface VerifyEmailState {
  error: string | null;
}

/** Confirms the 6-digit code; on success swaps in the fresh (verified) token. */
export async function verifyEmail(
  _prev: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) redirect('/login');
  let result: AuthResult;
  try {
    result = await api<AuthResult>('/auth/verify-email', {
      method: 'POST',
      token,
      body: { code: String(formData.get('code') ?? '').trim() },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  await setToken(result.accessToken);
  redirect('/dashboard');
}

export interface ForgotPasswordState {
  error: string | null;
  sent?: boolean;
}

/** Requests a reset link. Always reports success (no account enumeration). */
export async function forgotPassword(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  try {
    await api('/auth/forgot-password', {
      method: 'POST',
      body: { email: formData.get('email') },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  return { error: null, sent: true };
}

export interface ResetPasswordState {
  error: string | null;
  ok?: boolean;
}

export async function resetPassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (newPassword !== confirm) {
    return { error: 'New passwords do not match', ok: false };
  }
  try {
    await api('/auth/reset-password', {
      method: 'POST',
      body: { token: formData.get('token'), newPassword },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message, ok: false };
    throw e;
  }
  return { error: null, ok: true };
}
