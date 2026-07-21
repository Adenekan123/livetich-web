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
    // Readable by JS on purpose — the socket.io handshake needs it.
    httpOnly: false,
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
  redirect('/dashboard');
}

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
        role: formData.get('role'),
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return { error: e.message };
    throw e;
  }
  await setToken(result.accessToken);
  redirect('/dashboard');
}

export async function logout() {
  (await cookies()).delete(TOKEN_COOKIE);
  redirect('/login');
}
