import { NextResponse } from 'next/server';
import { api } from '@/lib/api';

interface Shortcut {
  workspaceName: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

/**
 * The web app manifest for one student's shortcut.
 *
 * This is what turns "save the link" into a home-screen icon carrying the
 * workspace's own name and logo, opening full-screen with no browser chrome —
 * the difference between a bookmark and something that feels like the school's
 * app. It is generated per shortcut rather than shipped as a static file
 * because the name, colour and icon come from that workspace's brand kit.
 *
 * `start_url` is the shortcut itself, so tapping the icon lands on the passcode
 * screen when the session has lapsed and goes straight through when it has not.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  let shortcut: Shortcut;
  try {
    shortcut = await api<Shortcut>(`/auth/quick-access/${slug}`);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  const icons = shortcut.logoUrl
    ? [
        {
          src: shortcut.logoUrl,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
      ]
    : [{ src: '/favicon-dark.png', sizes: '512x512', type: 'image/png' }];

  return NextResponse.json(
    {
      name: shortcut.workspaceName,
      short_name: shortcut.workspaceName.slice(0, 12),
      description: `Live classes at ${shortcut.workspaceName}`,
      start_url: `/q/${slug}`,
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: shortcut.primaryColor ?? '#0a0a0a',
      icons,
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        // Branding changes rarely; a stale icon for a few minutes is fine, and
        // a student opening this on a bad connection should not wait for it.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      },
    },
  );
}
