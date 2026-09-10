/**
 * Shared-board asset plumbing for the Excalidraw whiteboard.
 *
 * Excalidraw keeps image bytes in a `files` map, separate from the elements,
 * as base64 data URLs. Putting those straight into the shared Yjs doc would
 * push megabytes of base64 through the socket on every join and replay, so the
 * board instead uploads each file once to `sessions/:id/board-asset` and syncs
 * only the resulting URL. Every other client fetches that URL and re-hydrates
 * its own `files` entry — same trade the tldraw board made, for the same
 * reason: blob: URLs are private to the uploader's browser, so a shared image
 * that only lived in one client's memory was invisible to the class.
 */
import { API_URL } from '@/lib/api';
import { getRealtimeToken, clearRealtimeToken } from '@/lib/client-token';

/** Guard rails so a huge deck can't bloat the shared board or freeze a phone. */
export const PDF_MAX_PAGES = 30;
const PDF_TARGET_WIDTH = 1600; // px on the long edge — legible without being huge

// Keep board images light so they upload fast and, more importantly, load fast
// for every viewer. PDF pages rasterise to big lossless PNGs (1–3 MB each) and
// users drop full-res photos; capping the long edge and re-encoding to WebP
// shrinks them ~5–10x with no visible loss at board scale.
const ASSET_MAX_EDGE = 1600;
const ASSET_WEBP_QUALITY = 0.82;

/** The Yjs-synced description of one board file — deliberately tiny. */
export interface SharedBoardFile {
  id: string;
  url: string;
  mimeType: string;
  created: number;
}

// Lazily load pdf.js (heavy) and wire its module worker once, on first import.
// Kept out of the initial bundle — only pulled when someone imports a PDF.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
        { type: 'module' },
      );
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * Rasterise a PDF into one PNG File per page. Excalidraw has no native PDF
 * element, so a deck lands on the board as image elements that sync over the
 * same Yjs doc as any drawing.
 */
export async function pdfToImageFiles(file: File): Promise<File[]> {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const stem = file.name.replace(/\.pdf$/i, '') || 'document';
  const out: File[] = [];
  try {
    const count = Math.min(pdf.numPages, PDF_MAX_PAGES);
    for (let n = 1; n <= count; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, PDF_TARGET_WIDTH / base.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, 'image/png'),
      );
      if (blob) out.push(new File([blob], `${stem}-p${n}.png`, { type: 'image/png' }));
    }
  } finally {
    await pdf.cleanup().catch(() => {});
  }
  return out;
}

/** Shrink heavy raster images before they ever hit the wire. */
export async function compressImageFile(file: File): Promise<File> {
  // Leave vectors and non-images alone; only raster images benefit.
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, ASSET_MAX_EDGE / longest);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', ASSET_WEBP_QUALITY),
    );
    // Skip if the browser can't make WebP or the result isn't actually smaller
    // (already-tiny images) — re-encoding those would only lose quality.
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp' });
  } catch {
    // Any decode/encode failure -> upload the original; never block the import.
    return file;
  }
}

/**
 * Upload one file to the board-asset endpoint and return its shareable URL.
 * The realtime token is cached (see getRealtimeToken); if it was rejected
 * (expired/rotated) we drop it and retry once with a fresh one, so a stale
 * cache can never turn into a silently-failed upload.
 */
export async function uploadBoardAsset(
  sessionId: string,
  file: File,
): Promise<{ url: string; file: File }> {
  const light = await compressImageFile(file);
  const post = async () => {
    const token = await getRealtimeToken();
    const form = new FormData();
    form.append('file', light, light.name || 'asset.png');
    return fetch(`${API_URL}/sessions/${sessionId}/board-asset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token ?? ''}` },
      body: form,
    });
  };
  let res = await post();
  if (res.status === 401) {
    clearRealtimeToken();
    res = await post();
  }
  if (!res.ok) throw new Error(`board asset upload failed (${res.status})`);
  const { url } = (await res.json()) as { url: string };
  // Hand back the bytes that were actually sent. The caller needs a data URL
  // for the local scene, and re-fetching what we just uploaded is a pointless
  // round trip per page — slow enough on a class-sized deck to matter.
  return { url, file: light };
}

/** Turn a base64 data URL back into a File so it can be uploaded. */
export function dataURLToFile(dataURL: string, name: string): File {
  const [head, body] = dataURL.split(',');
  const mime = /:(.*?);/.exec(head)?.[1] ?? 'image/png';
  const binary = atob(body ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

/** Fetch a shared asset URL and read it back as a data URL for Excalidraw. */
export async function fetchAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`board asset fetch failed (${res.status})`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Read a local File as a data URL, for Excalidraw's in-memory files map. */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
