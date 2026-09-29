import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { api, ApiError } from './api';
import type { SessionUser } from './types';

/**
 * The API JWT lives in an httpOnly cookie (server-readable only). Realtime
 * clients that need the token in the browser fetch it from the same-origin
 * /api/realtime-token route, which reads this cookie server-side.
 */
export const TOKEN_COOKIE = 'lt_token';

export async function getToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

/**
 * Validates the cookie against the API; null when logged out/expired.
 *
 * Memoised per request: a layout, the header, the impersonation banner and the
 * page all ask, and without this each one was its own /auth/me — enough to trip
 * the API's rate limit after a few quick actions.
 */
export const getCurrentUser = cache(
  async (): Promise<SessionUser | null> => {
    const token = await getToken();
    if (!token) return null;
    try {
      return await api<SessionUser>('/auth/me', { token });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
);
