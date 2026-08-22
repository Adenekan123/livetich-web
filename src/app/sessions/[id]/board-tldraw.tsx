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
  ruling: {
    label: 'Arabic ruling',
    make: () => Array.from({ length: 8 }, (_, i) => bar(80, 100 + i * 56, 640, 2)),
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
export function BoardTldraw({
  sessionId,
  canDraw,
  templates = [],
}: {
  sessionId: string;
  canDraw: boolean;
  /** Subject template keys available for this org (gated per plugin). */
  templates?: string[];
}) {
  const [store] = useState(() => createTLStore());
  // Presenter tools (camera-follow + shared laser). Refs bridge the socket
  // handlers in onMount to React state for the overlay + follow button.
  const editorRef = useRef<Editor | null>(null);
  const socketRef = useRef<BoardSocket | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const lastCameraRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const [following, setFollowing] = useState(true);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  // Whether the instructor has opened the board for students to draw.
  const [boardOpen, setBoardOpen] = useState(false);
  // Importing a document/PDF onto the board (rasterising can take a moment).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
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

    // One-time reconcile once the server's initial doc has been merged in:
    // seed the shared doc from our fresh store, or adopt the existing one.
    const reconcile = () => {
      if (initialized) return;
      initialized = true;
      const yRecords = [...yStore.values()].filter(isSharedRecord);
      if (yRecords.length === 0) {
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
    socket.on('connect', () => socket.emit('board:join', { sessionId }));
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
        if (followingRef.current) {
          // Flip to the presenter's page first (if it has synced), then match view.
          if (p.page && editor.getPage(p.page as Parameters<typeof editor.getPage>[0]))
            editor.setCurrentPage(p.page as Parameters<typeof editor.setCurrentPage>[0]);
          editor.setCamera(p.camera);
        }
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

  // Import images onto the board — they drop in as image shapes/assets and sync
  // to students over the same Yjs doc as any drawing. (Slides/PDF: export to
  // images for now; native PDF rasterisation lands with the pdfjs dependency.)
  const importFiles = async (list: FileList | null) => {
    const editor = editorRef.current;
    if (!editor || !list || list.length === 0) return;
    setImporting(true);
    try {
      const center = editor.getViewportPageBounds().center;
      let y = center.y;
      for (const file of Array.from(list)) {
        if (!file.type.startsWith('image/')) continue;
        await editor.putExternalContent({
          type: 'files',
          files: [file],
          point: { x: center.x, y },
        });
        y += 620;
      }
    } catch {
      // Best-effort — a bad or oversized file simply doesn't land; the board
      // (and everyone's connection) stays intact.
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportPng = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const ids = editor.getCurrentPageShapeIds();
    if (ids.size === 0) return;
    const { blob } = await editor.toImage([...ids], { format: 'png', background: true });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `board-${sessionId}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pill =
    'rounded-full px-3 py-1.5 text-xs font-semibold shadow ring-1 ring-neutral-200 transition';

  return (
    <div
      ref={wrapperRef}
      className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-neutral-300 bg-white"
    >
      <Tldraw store={store} onMount={handleMount} />

      {/* Instructor board controls (top-center, clear of tldraw's menus). */}
      {canDraw && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[400] flex -translate-x-1/2 flex-wrap items-center justify-center gap-1.5">
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
            title="Import images onto the board (export slides or PDF pages as images)"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void importFiles(e.currentTarget.files)}
          />
          <button
            onClick={exportPng}
            className={`pointer-events-auto ${pill} bg-white text-neutral-800`}
          >
            Export
          </button>
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
            if (lastCameraRef.current) editorRef.current?.setCamera(lastCameraRef.current);
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
