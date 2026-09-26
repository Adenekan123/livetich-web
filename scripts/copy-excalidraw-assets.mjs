/**
 * Copy Excalidraw's runtime font files into `public/excalidraw-assets/`.
 *
 * Excalidraw loads its handwriting fonts at runtime (they are not the ones the
 * stylesheet declares). When `window.EXCALIDRAW_ASSET_PATH` is unset it fetches
 * them from a public CDN — an outside dependency in the middle of a live class,
 * on networks that may well block it. Serving them from our own origin removes
 * that; Excalidraw still keeps the CDN as an automatic fallback, so a missing
 * copy degrades rather than breaks.
 *
 * Runs on postinstall so a fresh CI checkout is never missing the fonts.
 */
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts');
const to = resolve(root, 'public/excalidraw-assets/fonts');

if (!existsSync(from)) {
  // Not an error: `postinstall` can run before the package is linked, and the
  // CDN fallback keeps the board working either way.
  console.warn('[excalidraw-assets] fonts not found, skipping copy');
  process.exit(0);
}

await mkdir(dirname(to), { recursive: true });
await cp(from, to, { recursive: true });
console.log('[excalidraw-assets] fonts copied to public/excalidraw-assets/fonts');
