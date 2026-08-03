'use client';

import 'tldraw/tldraw.css';
import { useState } from 'react';
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

  const handleMount = (editor: Editor) => {
    if (!canDraw) editor.updateInstanceState({ isReadonly: true });

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

    return () => {
      clearTimeout(initTimer);
      unlisten();
      yStore.unobserve(onYChange);
      doc.off('update', onDocUpdate);
      socket.disconnect();
      doc.destroy();
    };
  };

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-neutral-300 bg-white">
      <Tldraw store={store} onMount={handleMount} />
    </div>
  );
}
