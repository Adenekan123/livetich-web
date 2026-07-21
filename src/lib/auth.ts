import 'server-only';
import { cookies } from 'next/headers';
import { api, ApiError } from './api';
import type { SessionUser } from './types';

/**
 * The API JWT lives in a readable (non-httpOnly) cookie because the
 * socket.io clients need it in the browser for the realtime handshake.
 * Revisit (httpOnly + token endpoint) before production hardening.
 */
export const TOKEN_COOKIE = 'lt_token';

export async function getToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

/** Validates the cookie against the API; null when logged out/expired. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    return await api<SessionUser>('/auth/me', { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}
