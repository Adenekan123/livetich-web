'use client';

import 'tldraw/tldraw.css';
import { useEffect, useRef, useState } from 'react';
import { Tldraw, createTLStore, type Editor, type TLRecord } from 'tldraw';
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
}: {
  sessionId: string;
  canDraw: boolean;
}) {
  const [store] = useState(() => createTLStore());
  // Presenter tools (camera-follow + shared laser). Refs bridge the socket
  // handlers in onMount to React state for the overlay + follow button.
  const editorRef = useRef<Editor | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const lastCameraRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const [following, setFollowing] = useState(true);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    followingRef.current = following;
  }, [following]);

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
      const yRecords = [...yStore.values()];
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

    socket.on('connect', () => socket.emit('board:join', { sessionId }));
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
          if (record) toPut.push(record);
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
        if (followingRef.current) editor.setCamera(p.camera);
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

  return (
    <div
      ref={wrapperRef}
      className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-neutral-300 bg-white"
    >
      <Tldraw store={store} onMount={handleMount} />

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
