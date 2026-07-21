'use client';

/** Browser-side read of the auth cookie (see TOKEN_COOKIE in lib/auth.ts). */
export function getClientToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)lt_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
