import { NextResponse, type NextRequest } from 'next/server';

// Kept in sync with TOKEN_COOKIE in lib/auth (can't import it — that module
// pulls in next/headers, which isn't available in the edge middleware runtime).
const TOKEN_COOKIE = 'lt_token';

// Routes an unverified (but logged-in) user may still reach.
const OPEN_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/privacy',
  '/terms',
]);

function isOpen(pathname: string): boolean {
  return OPEN_PATHS.has(pathname) || pathname.startsWith('/join');
}

/** Reads the JWT payload WITHOUT verifying it — fine for a UX redirect, since
 *  the API guard is the real enforcement (it verifies the signature + DB). */
function payloadOf(token: string): { emailVerified?: boolean } | null {
  try {
    const seg = token.split('.')[1];
    if (!seg) return null;
    const json = atob(seg.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Hard email-verification gate: a logged-in user whose token isn't marked
 * verified is pinned to /verify-email; a verified user never sits on it.
 * Anonymous visitors are left alone (pages handle their own login redirect).
 */
export function middleware(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.next();

  // Only gate tokens that EXPLICITLY say unverified. Pre-feature tokens (issued
  // before email verification existed) have no claim — let them through so we
  // don't loop or lock out live sessions on rollout; the API guard + DB remain
  // the real enforcement, and new tokens always carry the claim.
  const claim = payloadOf(token)?.emailVerified;
  const { pathname } = req.nextUrl;

  if (claim === false && !isOpen(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = '/verify-email';
    return NextResponse.redirect(url);
  }
  if (claim === true && pathname === '/verify-email') {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on pages, skipping Next internals and static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
