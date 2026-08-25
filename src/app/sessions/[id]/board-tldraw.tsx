'use client';

import 'tldraw/tldraw.css';
import { useEffect, useRef, useState } from 'react';
import {
  Tldraw,
  createTLStore,
  type Editor,
  type TLRecord,
  type TLShapePartial,
} from 'tldraw';
import { io, type Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import type {
  BoardClientToServerEvents,
  BoardServerToClientEvents,
} from '@/lib/realtime-contract';

type BoardSocket = Socket<BoardServerToClientEvents, BoardClientToServerEvents>;

// Yjs transaction origin for edits made on this client (vs. remote/server).
const LOCAL = 'local';

/** A thin grey bar used to draw guide lines (stable geo-rectangle shape). */
const bar = (x: number, y: number, w: number, h: number): TLShapePartial =>
  ({
    type: 'geo',
    x,
    y,
    props: { geo: 'rectangle', w, h, color: 'grey', fill: 'solid', dash: 'solid', size: 's' },
  }) as TLShapePartial;

/** Subject board templates — inserted as synced shapes. Gated per plugin. */
const TEMPLATES: Record<string, { label: string; make: () => TLShapePartial[] }> = {
  axes: {
    label: 'Axes',
    make: () => [bar(399, 100, 2, 600), bar(100, 399, 600, 2)],
  },
  lined: {
    label: 'Lined',
    make: () => Array.from({ length: 12 }, (_, i) => bar(80, 80 + i * 44, 640, 2)),
  },
};

/**
 * tldraw's document-scoped record types. Only these are shared; session and
 * presence records (camera, selection, etc.) stay local to each client.
 */
function isDocumentRecord(r: TLRecord): boolean {
  return (
    r.typeName === 'document' ||
    r.typeName === 'page' ||
    r.typeName === 'shape' ||
    r.typeName === 'asset' ||
    r.typeName === 'binding'
  );
}

/**
 * Only ever hand tldraw's store well-formed document records. The shared Y.Map
 * is bytes on the wire, so a buggy/older client (or a stray write) could leave
 * a value with no `typeName`; putting that into the store throws "Missing
 * definition for record type undefined" and kills the whole board. Filter here.
 */
function isSharedRecord(r: unknown): r is TLRecord {
  return (
    !!r &&
    typeof r === 'object' &&
    typeof (r as { typeName?: unknown }).typeName === 'string' &&
    isDocumentRecord(r as TLRecord)
  );
}

/**
 * tldraw whiteboard bound to the /board Yjs namespace. tldraw's document
 * records live in a Y.Map so the server keeps authority and snapshots; the
 * socket gateway relays doc updates. Instructor edits; students view
 * read-only (their board:update writes are also rejected server-side).
 *
 * The binding is set up in onMount so tldraw's initial document (its default
 * page) already exists before we reconcile with the shared Y.Doc — otherwise
 * synced shapes would reference a page that never got shared.
 */
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

// Guard rails so a huge deck can't bloat the shared board (each page becomes a
// synced PNG asset) or freeze a low-end device mid-class.
const PDF_MAX_PAGES = 30;
const PDF_TARGET_WIDTH = 1600; // px on the long edge — legible without being huge

/**
 * Rasterise a PDF into one PNG File per page, so document/slide imports land on
 * the board as image shapes and sync to students over the same Yjs doc as any
 * drawing (tldraw has no native PDF shape).
 */
async function pdfToImageFiles(file: File): Promise<File[]> {
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
      if (blob) {
        out.push(
          new File([blob], `${stem}-p${n}.png`, { type: 'image/png' }),
        );
      }
    }
  } finally {
    await pdf.cleanup().catch(() => {});
  }
  return out;
}

export function BoardTldraw({
  sessionId,
  canDraw,
  teaching = false,
  templates = [],
  licenseKey,
}: {
  sessionId: string;
  canDraw: boolean;
  /** This user is an org admin presenting in teach-mode — tells the board
   *  gateway to authorize them as the writer (mirrors the room join). */
  teaching?: boolean;
  /** Subject template keys available for this org (gated per plugin). */
  templates?: string[];
  /** tldraw commercial license key (removes the watermark). Threaded from the
   *  server page so it stays a runtime value, not a build-time inline. */
  licenseKey?: string;
}) {
  const [store] = useState(() => createTLStore());
  // Presenter tools (camera-follow + shared laser). Refs bridge the socket
  // handlers in onMount to React state for the overlay + follow button.
  const editorRef = useRef<Editor | null>(null);
  const socketRef = useRef<BoardSocket | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const lastCameraRef = useRef<{ x: number; y: number; z: number } | null>(null);
  // The presenter's current page id, remembered so a following viewer can flip
  // to it the instant that page syncs in — the presenter only announces a page
  // change once, so a viewer must re-try rather than wait for another announce.
  const presenterPageRef = useRef<string | null>(null);
  const [following, setFollowing] = useState(true);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  // Whether the instructor has opened the board for students to draw.
  const [boardOpen, setBoardOpen] = useState(false);
  // Importing a document/PDF onto the board (rasterising can take a moment).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  // Export menu (PNG image / PDF document) + a brief board-level status line.
  const [exportOpen, setExportOpen] = useState(false);
  // On phones the instructor controls collapse into a single "Tools" menu so
  // they don't crowd tldraw's own top bar.
  const [toolsOpen, setToolsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [boardMsg, setBoardMsg] = useState<string | null>(null);
  const flash = (m: string) => {
    setBoardMsg(m);
    window.setTimeout(() => setBoardMsg(null), 2600);
  };
  useEffect(() => {
    followingRef.current = following;
  }, [following]);
  // Students gain/lose drawing when the board opens/closes; opening also
  // releases follow so they can work without the view snapping around.
  useEffect(() => {
    if (canDraw) return;
    editorRef.current?.updateInstanceState({ isReadonly: !boardOpen });
    if (boardOpen) setFollowing(false);
  }, [boardOpen, canDraw]);

  const handleMount = (editor: Editor) => {
    if (!canDraw) editor.updateInstanceState({ isReadonly: true });
    editorRef.current = editor;

    const doc = new Y.Doc();
    const yStore = doc.getMap<TLRecord>('tldraw');
    let initialized = false;

    const socket: BoardSocket = io(`${API_URL}/board`, {
      // Async auth: the httpOnly cookie is fetched from a same-origin route.
      auth: (cb) =>
        void getRealtimeToken().then((token) => cb({ token: token ?? '' })),
      transports: ['websocket'],
    });
    const applyRemote = (u: ArrayBuffer | Uint8Array) =>
      Y.applyUpdate(
        doc,
        u instanceof Uint8Array ? u : new Uint8Array(u),
        'remote',
      );

    // Non-presenters must always sit on a page that exists in the shared doc.
    // tldraw gives every fresh store a *random* default page id, so a viewer
    // left on its own local page would never see shapes the instructor draws on
    // theirs — a blank board. Switch to the shared page whenever the current one
    // isn't part of the shared doc.
    const followSharedPage = () => {
      if (canDraw) return;
      const current = editor.getCurrentPageId();
      const pages = [...yStore.values()].filter(
        (r): r is TLRecord => isSharedRecord(r) && r.typeName === 'page',
      );
      if (pages.length && !pages.some((p) => p.id === current)) {
        editor.setCurrentPage(
          pages[0].id as Parameters<typeof editor.setCurrentPage>[0],
        );
      }
    };

    // Mirror the presenter's page + camera onto a following viewer. Called both
    // when a presenter packet arrives AND whenever board records sync in — so a
    // page switch or PDF import that raced ahead of its records (the presenter
    // announces a change only once) still lands the moment the content exists
    // locally, instead of stranding the viewer on the old page/scroll position.
    const applyPresenterView = () => {
      if (canDraw || !followingRef.current) return;
      const page = presenterPageRef.current as
        | Parameters<typeof editor.getPage>[0]
        | null;
      if (page && editor.getPage(page) && editor.getCurrentPageId() !== page) {
        editor.setCurrentPage(page);
      }
      if (lastCameraRef.current) editor.setCamera(lastCameraRef.current);
    };

    // One-time reconcile once the server's initial doc has been merged in: the
    // presenter seeds the shared doc from its store; everyone else adopts it.
    const reconcile = () => {
      if (initialized) return;
      initialized = true;
      const yRecords = [...yStore.values()].filter(isSharedRecord);
      if (yRecords.length === 0) {
        // Only the presenter seeds an empty board. If a student seeded its own
        // default page, that page would win locally and the instructor's shapes
        // (drawn on a *different* page id) would land on a page the student
        // never views — the "students see a blank board" bug. Students wait and
        // adopt the presenter's page via onYChange + followSharedPage instead.
        if (!canDraw) return;
        doc.transact(() => {
          for (const record of editor.store.allRecords()) {
            if (isDocumentRecord(record)) yStore.set(record.id, record);
          }
        }, LOCAL);
      } else {
        const yIds = new Set(yRecords.map((r) => r.id));
        editor.store.mergeRemoteChanges(() => {
          const staleIds = editor.store
            .allRecords()
            .filter((r) => isDocumentRecord(r) && !yIds.has(r.id))
            .map((r) => r.id);
          if (staleIds.length) editor.store.remove(staleIds);
          editor.store.put(yRecords);
        });
        const page = yRecords.find((r) => r.typeName === 'page');
        if (page) editor.setCurrentPage(page.id as Parameters<typeof editor.setCurrentPage>[0]);
      }
    };

    socketRef.current = socket;
    // Re-emitted on reconnect too (socket.io fires 'connect' again), so a
    // dropped student re-syncs board state via the board:state that follows.
    socket.on('connect', () =>
      socket.emit('board:join', {
        sessionId,
        ...(teaching ? { as: 'teach' as const } : {}),
      }),
    );
    socket.on('board:writable', (p) => setBoardOpen(p.open));
    socket.on('board:state', (p) => {
      applyRemote(p.update);
      reconcile();
    });
    socket.on('board:update', (p) => applyRemote(p.update));
    // Brand-new rooms still need to seed even if state arrives empty/slow.
    const initTimer = setTimeout(reconcile, 1500);

    // doc -> socket: forward only edits that originated on this client.
    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === LOCAL) socket.emit('board:update', { sessionId, update });
    };
    doc.on('update', onDocUpdate);

    // yjs -> tldraw: apply remote record changes into the local store.
    const onYChange = (event: Y.YMapEvent<TLRecord>, tx: Y.Transaction) => {
      if (!initialized || tx.origin === LOCAL) return;
      const toPut: TLRecord[] = [];
      const toRemove: TLRecord['id'][] = [];
      event.changes.keys.forEach((change, key) => {
        if (change.action === 'delete') {
          toRemove.push(key as TLRecord['id']);
        } else {
          const record = yStore.get(key);
          if (isSharedRecord(record)) toPut.push(record);
        }
      });
      editor.store.mergeRemoteChanges(() => {
        if (toRemove.length) editor.store.remove(toRemove);
        if (toPut.length) editor.store.put(toPut);
      });
      // A viewer that hadn't seen the presenter's page yet (joined before any
      // content existed) lands on it as soon as it arrives here.
      followSharedPage();
      // And a following viewer flips to a just-created page / re-scrolls to a
      // just-imported PDF the instant those records land — closing the race
      // where the presenter announced the change before the records synced.
      applyPresenterView();
    };
    yStore.observe(onYChange);

    // tldraw -> yjs: mirror the user's document changes into the Y.Map.
    const unlisten = editor.store.listen(
      (entry) => {
        const { added, updated, removed } = entry.changes;
        doc.transact(() => {
          for (const record of Object.values(added)) {
            yStore.set(record.id, record);
          }
          for (const [, to] of Object.values(updated)) {
            yStore.set(to.id, to);
          }
          for (const record of Object.values(removed)) {
            yStore.delete(record.id);
          }
        }, LOCAL);
      },
      { source: 'user', scope: 'document' },
    );

    // ---- Presenter tools: camera-follow + shared laser (ephemeral) ----
    let presenterTimer: ReturnType<typeof setInterval> | undefined;
    let pointerInside = true;
    const el = wrapperRef.current;
    const onEnter = () => {
      pointerInside = true;
    };
    const onLeave = () => {
      pointerInside = false;
    };
    // A student panning/zooming means they want to explore — release follow.
    const onInteract = () => {
      if (followingRef.current) setFollowing(false);
    };

    if (canDraw) {
      // Instructor broadcasts camera + pointer ~10×/s, only when it changed.
      el?.addEventListener('pointerenter', onEnter);
      el?.addEventListener('pointerleave', onLeave);
      let last = '';
      presenterTimer = setInterval(() => {
        if (!socket.connected) return;
        const cam = editor.getCamera();
        const pt = editor.inputs.currentPagePoint;
        const payload = {
          camera: { x: cam.x, y: cam.y, z: cam.z },
          cursor: pointerInside ? { x: pt.x, y: pt.y } : null,
          page: editor.getCurrentPageId(),
        };
        const key = JSON.stringify(payload);
        if (key === last) return;
        last = key;
        socket.emit('board:presenter', { sessionId, ...payload });
      }, 100);
    } else {
      // Students match the presenter's view (while following) + show the laser.
      socket.on('board:presenter', (p) => {
        lastCameraRef.current = p.camera;
        presenterPageRef.current = p.page ?? null;
        // Flip to the presenter's page (once it has synced) and match the view.
        // If the page hasn't arrived yet, onYChange retries this when it does.
        applyPresenterView();
        if (p.cursor) {
          const s = editor.pageToScreen(p.cursor);
          setLaser({ x: s.x, y: s.y });
        } else {
          setLaser(null);
        }
      });
      el?.addEventListener('wheel', onInteract, { passive: true });
      el?.addEventListener('pointerdown', onInteract);
    }

    return () => {
      clearTimeout(initTimer);
      if (presenterTimer) clearInterval(presenterTimer);
      el?.removeEventListener('pointerenter', onEnter);
      el?.removeEventListener('pointerleave', onLeave);
      el?.removeEventListener('wheel', onInteract);
      el?.removeEventListener('pointerdown', onInteract);
      unlisten();
      yStore.unobserve(onYChange);
      doc.off('update', onDocUpdate);
      socket.disconnect();
      doc.destroy();
    };
  };

  const toggleWritable = () =>
    socketRef.current?.emit('board:writable', { sessionId, open: !boardOpen });

  const insertTemplate = (key: string) => {
    const t = TEMPLATES[key];
    if (t) editorRef.current?.createShapes(t.make());
  };

  // Import a PDF/document (or images) onto the board. PDFs are rasterised to one
  // image per page; images drop straight in. Everything lands as image shapes/
  // assets and syncs to students over the same Yjs doc as any drawing.
  //
  // Pages are stacked top-to-bottom without overlap: we can't know a page's
  // on-board height until tldraw has placed it (it scales large images down),
  // so after each drop we measure the new shape's real bounds and re-align it —
  // top edge to the running cursor, centred on the column — then advance the
  // cursor past it. A fixed y-step would overlap tall pages onto short ones.
  const GAP = 48; // board units of breathing room between stacked pages
  const importFiles = async (list: FileList | null) => {
    const editor = editorRef.current;
    if (!editor || !list || list.length === 0) return;
    setImporting(true);
    try {
      const cx = editor.getViewportPageBounds().center.x;
      let top = editor.getViewportPageBounds().center.y;
      let firstCenter: { x: number; y: number } | null = null;
      for (const file of Array.from(list)) {
        const isPdf =
          file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        // A PDF fans out into one image per page; an image is itself.
        const images = isPdf
          ? await pdfToImageFiles(file)
          : file.type.startsWith('image/')
            ? [file]
            : [];
        for (const img of images) {
          const before = new Set(editor.getCurrentPageShapeIds());
          await editor.putExternalContent({
            type: 'files',
            files: [img],
            point: { x: cx, y: top },
          });
          const newIds = [...editor.getCurrentPageShapeIds()].filter(
            (id) => !before.has(id),
          );
          if (newIds.length === 0) continue;
          // Union bounds of whatever tldraw just created for this page.
          let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
          for (const id of newIds) {
            const b = editor.getShapePageBounds(id);
            if (!b) continue;
            minX = Math.min(minX, b.minX);
            minY = Math.min(minY, b.minY);
            maxX = Math.max(maxX, b.maxX);
            maxY = Math.max(maxY, b.maxY);
          }
          if (!Number.isFinite(minY)) continue;
          // Re-align: top edge to `top`, centred horizontally on the column.
          const dx = cx - (minX + maxX) / 2;
          const dy = top - minY;
          if (dx !== 0 || dy !== 0) {
            editor.updateShapes(
              newIds.map((id) => {
                const s = editor.getShape(id)!;
                return { id, type: s.type, x: s.x + dx, y: s.y + dy };
              }),
            );
          }
          const height = maxY - minY;
          if (!firstCenter)
            firstCenter = { x: cx, y: top + height / 2 };
          top += height + GAP;
        }
      }
      // Bring the first imported page into view for the presenter.
      if (firstCenter)
        editor.centerOnPoint(firstCenter, { animation: { duration: 200 } });
    } catch {
      // Best-effort — a bad or oversized file simply doesn't land; the board
      // (and everyone's connection) stays intact.
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Export the current board — as a PNG image, or wrapped into a one-page PDF
  // sized to the board. Empty boards say so rather than silently doing nothing.
  const exportBoard = async (format: 'png' | 'pdf') => {
    const editor = editorRef.current;
    setExportOpen(false);
    if (!editor) return;
    const ids = editor.getCurrentPageShapeIds();
    if (ids.size === 0) {
      flash('Nothing on the board to export yet.');
      return;
    }
    setExporting(true);
    try {
      const { blob, width, height } = await editor.toImage([...ids], {
        format: 'png',
        background: true,
      });
      if (format === 'png') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `board-${sessionId}.png`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const { jsPDF } = await import('jspdf');
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = () => rej(r.error);
          r.readAsDataURL(blob);
        });
        const doc = new jsPDF({
          orientation: width >= height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height],
          hotfixes: ['px_scaling'],
        });
        doc.addImage(dataUrl, 'PNG', 0, 0, width, height);
        doc.save(`board-${sessionId}.pdf`);
      }
    } catch {
      flash('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  };

  const pill =
    'rounded-full px-3 py-1.5 text-xs font-semibold shadow ring-1 ring-neutral-200 transition';

  return (
    // `isolate` keeps tldraw's internal z-index layers (its toolbar sits at 300,
    // menus/header climb to 999) contained to this box, so they can't paint over
    // the classroom's own overlays — the bottom-bar "More" sheet and the mobile
    // chat panel — that stack above the board.
    <div
      ref={wrapperRef}
      className="relative isolate h-full min-h-[320px] overflow-hidden rounded-xl border border-neutral-300 bg-white"
    >
      <Tldraw store={store} onMount={handleMount} licenseKey={licenseKey} />

      {/* Instructor board controls. Desktop lays them out inline (top-centre);
          phones collapse them into a single "Tools" menu so they don't crowd
          tldraw's own page/menu bar. */}
      {canDraw && (
        <>
          {/* Desktop: inline row. */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-[400] hidden -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 md:flex">
            <button
              onClick={toggleWritable}
              className={`pointer-events-auto ${pill} ${
                boardOpen ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-neutral-800'
              }`}
            >
              {boardOpen ? 'Students drawing ✓' : 'Let students draw'}
            </button>
            {templates
              .filter((k) => TEMPLATES[k])
              .map((k) => (
                <button
                  key={k}
                  onClick={() => insertTemplate(k)}
                  className={`pointer-events-auto ${pill} bg-white text-neutral-800`}
                >
                  {TEMPLATES[k].label}
                </button>
              ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className={`pointer-events-auto ${pill} bg-white text-neutral-800 disabled:opacity-50`}
              title="Import a PDF or document onto the board — each page drops in as a slide (images work too)"
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
            <div className="pointer-events-auto relative">
              <button
                onClick={() => setExportOpen((o) => !o)}
                disabled={exporting}
                aria-haspopup="menu"
                aria-expanded={exportOpen}
                className={`${pill} bg-white text-neutral-800 disabled:opacity-50`}
              >
                {exporting ? 'Exporting…' : 'Export ▾'}
              </button>
              {exportOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[400]"
                    onClick={() => setExportOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-[401] mt-1.5 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-neutral-200"
                  >
                    <button
                      role="menuitem"
                      onClick={() => void exportBoard('pdf')}
                      className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      PDF document
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => void exportBoard('png')}
                      className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      PNG image
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile: one "Tools" menu, centred up top and clear of tldraw's own
              page/menu controls. */}
          <div className="pointer-events-auto absolute left-1/2 top-3 z-[400] -translate-x-1/2 md:hidden">
            <button
              onClick={() => setToolsOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={toolsOpen}
              className={`${pill} ${
                toolsOpen ? 'bg-neutral-900 text-white ring-neutral-900' : 'bg-white text-neutral-800'
              }`}
            >
              Tools ▾
            </button>
            {toolsOpen && (
              <>
                <div
                  className="fixed inset-0 z-[400]"
                  onClick={() => setToolsOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute left-1/2 top-full z-[401] mt-1.5 w-56 -translate-x-1/2 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-neutral-200"
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      toggleWritable();
                      setToolsOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                  >
                    Let students draw
                    {boardOpen && <span className="text-emerald-600">✓</span>}
                  </button>
                  {templates
                    .filter((k) => TEMPLATES[k])
                    .map((k) => (
                      <button
                        key={k}
                        role="menuitem"
                        onClick={() => {
                          insertTemplate(k);
                          setToolsOpen(false);
                        }}
                        className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                      >
                        {TEMPLATES[k].label} template
                      </button>
                    ))}
                  <button
                    role="menuitem"
                    disabled={importing}
                    onClick={() => {
                      fileInputRef.current?.click();
                      setToolsOpen(false);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : 'Import PDF / document'}
                  </button>
                  <div className="my-1 border-t border-neutral-100" />
                  <button
                    role="menuitem"
                    disabled={exporting}
                    onClick={() => {
                      void exportBoard('pdf');
                      setToolsOpen(false);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Export as PDF
                  </button>
                  <button
                    role="menuitem"
                    disabled={exporting}
                    onClick={() => {
                      void exportBoard('png');
                      setToolsOpen(false);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Export as PNG
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Shared hidden file input, used by both the desktop and mobile
              import controls. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => void importFiles(e.currentTarget.files)}
          />
        </>
      )}

      {/* Brief board-level status (export feedback), bottom-center. */}
      {boardMsg && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[401] -translate-x-1/2 rounded-full bg-neutral-900/90 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg">
          {boardMsg}
        </div>
      )}

      {/* Shared laser — the presenter's pointer, shown to students. */}
      {!canDraw && laser && (
        <div
          className="pointer-events-none absolute z-[400] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/70 ring-2 ring-red-300/60 shadow-[0_0_10px_3px_rgba(239,68,68,0.45)]"
          style={{ left: laser.x, top: laser.y }}
        />
      )}

      {/* Follow toggle — students only. Releases automatically when they pan. */}
      {!canDraw && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (following) {
              setFollowing(false);
              return;
            }
            setFollowing(true);
            const ed = editorRef.current;
            const page = presenterPageRef.current as
              | Parameters<NonNullable<typeof ed>['getPage']>[0]
              | null;
            if (ed) {
              if (page && ed.getPage(page)) ed.setCurrentPage(page);
              if (lastCameraRef.current) ed.setCamera(lastCameraRef.current);
            }
          }}
          className={`absolute left-1/2 top-3 z-[400] -translate-x-1/2 rounded-full px-3 py-1.5 text-xs font-semibold shadow transition ${
            following
              ? 'bg-neutral-900/90 text-white'
              : 'animate-pulse bg-white text-neutral-900 ring-1 ring-neutral-300'
          }`}
        >
          {following ? '● Following presenter' : 'Follow presenter'}
        </button>
      )}
    </div>
  );
}
