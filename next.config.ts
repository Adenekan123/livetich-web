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
  // Type-check runs locally (and should in CI) before every deploy, so repeating
  // it inside `next build` only adds the slowest, most memory-hungry phase to the
  // Docker build on the small staging/prod box. Skip it here.
  // NOTE: a type error won't FAIL the server build — the local `tsc --noEmit`
  // gate before pushing is what keeps that honest.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
