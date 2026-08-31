'use client';

/**
 * The session cookie is httpOnly, so JS can't read it directly. Realtime
 * handshakes (Socket.IO, LiveKit) fetch the bearer token from a same-origin
 * route that reads the cookie server-side.
 *
 * The realtime token is minted with a 30-minute TTL, so we cache it per-tab and
 * reuse it well within that window. Without this, every board-asset upload
 * re-fetches a fresh token — importing a 30-page PDF alone would hammer the
 * token endpoint with 30 requests (and can trip its rate limit, which then
 * surfaces as failed uploads). A page reload (e.g. after logout) resets this.
 */
const TOKEN_TTL_MS = 25 * 60 * 1000; // a safe margin under the API's 30m expiry
let cached: { token: string; expiresAt: number } | null = null;

export async function getRealtimeToken(): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  try {
    const res = await fetch('/api/realtime-token', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { token: string | null };
    if (data.token) {
      cached = { token: data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
    }
    return data.token;
  } catch {
    return null;
  }
}

/** Drop the cached realtime token (e.g. after an auth failure) so the next
 *  caller re-fetches a fresh one. */
export function clearRealtimeToken() {
  cached = null;
}
