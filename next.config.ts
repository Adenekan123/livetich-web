import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image ships only the traced deps — see livetich-api/deploy/DEPLOY.md.
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  // Recording a class locally means exposing this dev server through a tunnel,
  // because LiveKit's browser opens the recorder page from its own network. Next
  // blocks cross-origin access to /_next dev resources by default, which kills
  // the HMR socket for a tunnelled host — and a dev client that cannot hold that
  // socket reloads the page instead of finishing hydration, so the recorder page
  // never runs its effects and LiveKit films a blank frame. Allowing the quick
  // tunnel domain is what makes a local end-to-end recording testable at all.
  // Dev-only setting; production serves no /_next dev resources.
  allowedDevOrigins: ['*.trycloudflare.com'],
  // `next dev` forks a child process per request on a dynamic route to collect
  // generateStaticParams. On Windows that child's shutdown looks like a crash
  // (no real SIGTERM, so the exit code never matches the expected 143), and
  // jest-worker respawns it forever — the dev server then wedges and every
  // dynamic route 500s with "Jest worker encountered 2 child process
  // exceptions". Running those workers as threads sidesteps the fork entirely.
  // Dev only: `next build`'s workers are left on processes, as shipped.
  experimental: { workerThreads: process.env.NODE_ENV === 'development' },
  // Type-check runs locally (and should in CI) before every deploy, so repeating
  // it inside `next build` only adds the slowest, most memory-hungry phase to the
  // Docker build on the small staging/prod box. Skip it here.
  // NOTE: a type error won't FAIL the server build — the local `tsc --noEmit`
  // gate before pushing is what keeps that honest.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), display-capture=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
