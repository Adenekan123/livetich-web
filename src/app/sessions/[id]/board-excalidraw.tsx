'use client';

import '@excalidraw/excalidraw/index.css';
import './board-excalidraw.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
  exportToBlob,
  getCommonBounds,
  getVisibleSceneBounds,
  reconcileElements,
  restoreElements,
  zoomToFitBounds,
} from '@excalidraw/excalidraw';
import type {
  BinaryFileData,
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from '@excalidraw/excalidraw/types';
import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import type { SceneBounds } from '@excalidraw/excalidraw/element/bounds';
import { io, type Socket } from 'socket.io-client';
import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import {
  PiArrowsClockwiseBold,
  PiArrowsInBold,
  PiArrowsOutBold,
  PiCrosshairBold,
  PiDownloadSimpleBold,
  PiLockBold,
  PiLockOpenBold,
  PiUploadSimpleBold,
} from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/ui';
import { getRealtimeToken, clearRealtimeToken } from '@/lib/client-token';
import type {
  BoardClientToServerEvents,
  BoardServerToClientEvents,
} from '@/lib/realtime-contract';
import {
  PDF_MAX_PAGES,
  dataURLToFile,
  fetchAsDataURL,
  pdfToImageFiles,
  uploadBoardAsset,
  type SharedBoardFile,
} from './board-excalidraw-assets';

// Serve Excalidraw's runtime handwriting fonts from our own origin rather than
// the public CDN it otherwise falls back to (see
// scripts/copy-excalidraw-assets.mjs). Must be set before the editor first
// renders text.
if (typeof window !== 'undefined') {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH =
    '/excalidraw-assets/';
}

type BoardSocket = Socket<BoardServerToClientEvents, BoardClientToServerEvents>;

/** Yjs transaction origin for edits made on this client (vs. remote/server). */
const LOCAL = 'local';
/** Shared doc keys. Elements and file descriptors are kept apart so a big
 *  image import never rewrites the drawing map. */
const ELEMENTS_KEY = 'excalidraw-elements';
const FILES_KEY = 'excalidraw-files';
/** Freehand drawing changes elements many times per second. Coalescing those
 *  mutations keeps the shared-board transport responsive on modest devices. */
const SYNC_INTERVAL_MS = 50;
/** The presenter's camera is broadcast less often than strokes — it only needs
 *  to feel attached, not be frame-accurate. */
const PRESENTER_INTERVAL_MS = 100;
/** Identifier for the presenter's laser in the collaborator overlay. It rides
 *  the presenter channel rather than awareness, so it needs a reserved slot. */
const PRESENTER_ID = 'presenter' as SocketId;

/**
 * Socket.IO normally reconstructs binary packets as ArrayBuffers in browsers,
 * but relayed packets can arrive as typed views, byte arrays, or Node's
 * JSON-shaped Buffer form. Normalize every supported transport shape before
 * handing it to Yjs so a valid remote update is never silently treated as empty.
 */
function boardBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (Array.isArray(data)) return Uint8Array.from(data as number[]);
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return Uint8Array.from((data as { data: number[] }).data);
  }
  return null;
}

/** A thin grey bar used to draw guide lines. Locked so a stray drag on the
 *  ruling doesn't move the whole template. */
const bar = (x: number, y: number, width: number, height: number) => ({
  type: 'rectangle' as const,
  x,
  y,
  width,
  height,
  strokeColor: 'transparent',
  backgroundColor: '#ced4da',
  fillStyle: 'solid' as const,
  roughness: 0,
  locked: true,
});

/** Subject board templates — inserted as ordinary synced elements. */
const TEMPLATES: Record<string, { label: string; make: () => ExcalidrawElement[] }> = {
  axes: {
    label: 'Axes',
    make: () =>
      convertToExcalidrawElements([bar(399, 100, 2, 600), bar(100, 399, 600, 2)]),
  },
  lined: {
    label: 'Lined',
    make: () =>
      convertToExcalidrawElements(
        Array.from({ length: 12 }, (_, i) => bar(80, 80 + i * 44, 640, 2)),
      ),
  },
};

/**
 * Only ever hand Excalidraw well-formed elements. The shared Y.Map is bytes on
 * the wire, so a buggy/older client (or a stray write) could leave a value with
 * no `id`/`type`; feeding that to the scene throws inside the observer, aborts
 * the merge, and leaves the board frozen. Filter at the boundary instead.
 */
function isSharedElement(value: unknown): value is ExcalidrawElement {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { type?: unknown }).type === 'string' &&
    typeof (value as { version?: unknown }).version === 'number'
  );
}

function isSharedFile(value: unknown): value is SharedBoardFile {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { url?: unknown }).url === 'string'
  );
}

/**
 * Excalidraw whiteboard bound to the /board Yjs namespace.
 *
 * The shared doc holds one entry per element, keyed by element id. Excalidraw
 * already versions every element (`version` + `versionNonce`) and ships the
 * last-write-wins merge it uses for its own multiplayer, so Yjs is used purely
 * as transport and server-side persistence: local edits are diffed by version
 * and written into the map, and remote entries are handed to
 * `reconcileElements`, which resolves z-order through the elements' fractional
 * indices and refuses to yank an element out from under whoever is mid-drag on
 * it.
 *
 * Instructors edit; students view read-only unless the instructor opens the
 * board (their board:update writes are also rejected server-side).
 */
export function BoardExcalidraw({
  sessionId,
  canDraw,
  teaching = false,
  templates = [],
}: {
  sessionId: string;
  canDraw: boolean;
  /** This user is an org admin presenting in teach-mode — tells the board
   *  gateway to authorize them as the writer (mirrors the room join). */
  teaching?: boolean;
  /** Subject template keys available for this org (gated per plugin). */
  templates?: string[];
}) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const socketRef = useRef<BoardSocket | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const elementsRef = useRef<Y.Map<ExcalidrawElement> | null>(null);
  const filesRef = useRef<Y.Map<SharedBoardFile> | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /** id -> the element version we know the shared doc already carries. Drives
   *  both the outbound diff and the loop-breaker on inbound updates. */
  const syncedVersionsRef = useRef(new Map<string, number>());
  /** Files already pushed to (or pulled from) the asset store, so an image is
   *  never uploaded or re-hydrated twice. */
  const syncedFilesRef = useRef(new Set<string>());
  /** Latest scene from onChange, flushed to Yjs on a timer. */
  const pendingRef = useRef<readonly OrderedExcalidrawElement[] | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPresenterRef = useRef(0);
  /** Trailing send for the presenter camera: without it, a pan that stops
   *  inside the throttle window never delivers its final position and every
   *  follower is left a beat behind. */
  const presenterTrailingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Read by the presenter emitter, which is deliberately identity-stable so
   *  its own trailing timer can call it without risking a stale closure. */
  const canDrawRef = useRef(canDraw);
  const sessionIdRef = useRef(sessionId);
  /** The last camera we applied for a follower. Excalidraw reports scroll
   *  changes asynchronously, so a timing flag can't tell our own programmatic
   *  move apart from the viewer panning — comparing against the values we set
   *  can. */
  const lastAppliedViewRef = useRef<{
    scrollX: number;
    scrollY: number;
    zoom: number;
  } | null>(null);
  const followingRef = useRef(true);
  /** Whether we have framed the board once for this mount. */
  const didInitialFitRef = useRef(false);
  const lastBoundsRef = useRef<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  /** Remote cursors, kept outside React state — they change on every pointer
   *  move and only ever feed Excalidraw's own collaborator rendering. */
  const collaboratorsRef = useRef(new Map<SocketId, Collaborator>());

  const [ready, setReady] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [following, setFollowing] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [boardMsg, setBoardMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = ready && (canDraw || boardOpen);

  const flash = useCallback((m: string) => {
    setBoardMsg(m);
    window.setTimeout(() => setBoardMsg(null), 2600);
  }, []);

  useEffect(() => {
    apiRef.current = api;
  }, [api]);
  useEffect(() => {
    followingRef.current = following;
  }, [following]);
  useEffect(() => {
    canDrawRef.current = canDraw;
    sessionIdRef.current = sessionId;
  }, [canDraw, sessionId]);

  // ---- Shared state -> local scene ----------------------------------------
  /**
   * Merge the given shared elements into the local scene. `reconcileElements`
   * is a union: anything only present locally survives, so passing just the
   * changed entries is both correct and cheap. Recording the incoming versions
   * *first* is what stops an applied remote change from bouncing straight back
   * out through the local diff — and if reconcile keeps the local element
   * instead (it is newer, or being dragged), the recorded version no longer
   * matches, so the next flush correctly re-asserts it.
   */
  const applyRemoteElements = useCallback((incoming: ExcalidrawElement[]) => {
    const editor = apiRef.current;
    if (!editor || incoming.length === 0) return;
    // restoreElements repairs bindings and drops anything malformed before it
    // can reach the scene.
    const remote = restoreElements(incoming, null, {
      refreshDimensions: false,
      repairBindings: true,
    }) as unknown as RemoteExcalidrawElement[];
    // Record the versions that actually reach the scene, not the ones that
    // arrived: if restore ever normalised one, the diff below would otherwise
    // see a mismatch and bounce the element straight back out again.
    for (const el of remote) syncedVersionsRef.current.set(el.id, el.version);
    const merged = reconcileElements(
      editor.getSceneElementsIncludingDeleted(),
      remote,
      editor.getAppState(),
    );
    editor.updateScene({
      elements: merged,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, []);

  /** Pull any shared image this client hasn't hydrated yet. */
  const hydrateFiles = useCallback(() => {
    const map = filesRef.current;
    if (!apiRef.current || !map) return;
    for (const value of map.values()) {
      if (!isSharedFile(value)) continue;
      if (syncedFilesRef.current.has(value.id)) continue;
      syncedFilesRef.current.add(value.id);
      void fetchAsDataURL(value.url)
        .then((dataURL) => {
          apiRef.current?.addFiles([
            {
              id: value.id as FileId,
              dataURL,
              mimeType: value.mimeType,
              created: value.created,
            } as BinaryFileData,
          ]);
        })
        .catch(() => {
          // Let a later change (or Resync) try again rather than wedging.
          syncedFilesRef.current.delete(value.id);
        });
    }
  }, []);

  /**
   * Fit the presenter's visible rectangle to *this* viewport rather than
   * copying their raw camera, so the same region fills a phone and a laptop
   * alike instead of leaving shared slides tiny or off-screen.
   */
  const applyPresenterView = useCallback(() => {
    const editor = apiRef.current;
    const bounds = lastBoundsRef.current;
    if (!editor || !bounds || bounds.w <= 0 || bounds.h <= 0) return;
    const appState = editor.getAppState();
    if (!appState.width || !appState.height) return;

    let { x, y, w, h } = bounds;
    // Drop the presenter's empty margin on whichever axis their viewport spills
    // past the content. For the common wide-desktop -> portrait-phone case that
    // is the horizontal slack that would otherwise strand a shared page at a
    // third of the screen width. Clamp that axis to the content's extent so the
    // page fills the follower's screen, while keeping the presenter's framing on
    // the other axis so their pan still tracks. Only clamp an axis where the
    // presenter overhangs the content on BOTH sides — never crop content they
    // have deliberately zoomed into.
    const elements = editor.getSceneElements();
    if (elements.length) {
      const [cx0, cy0, cx1, cy1] = getCommonBounds(elements);
      if (x < cx0 && x + w > cx1) {
        x = cx0;
        w = cx1 - cx0;
      }
      if (y < cy0 && y + h > cy1) {
        y = cy0;
        h = cy1 - cy0;
      }
      if (w <= 1 || h <= 1) ({ x, y, w, h } = bounds);
    }

    const { appState: fitted } = zoomToFitBounds({
      bounds: [x, y, x + w, y + h] as SceneBounds,
      appState,
      // Scale the presenter's region to whatever screen this is — the whole
      // point of following bounds rather than copying their raw camera.
      fitToViewport: true,
      viewportZoomFactor: 0.95,
      // Guard rails so a degenerate region can't leave a follower at 4000% or
      // at a zoom too small to read on a phone.
      minZoom: 0.1,
      maxZoom: 4,
    });
    lastAppliedViewRef.current = {
      scrollX: fitted.scrollX,
      scrollY: fitted.scrollY,
      zoom: fitted.zoom.value,
    };
    editor.updateScene({
      appState: {
        scrollX: fitted.scrollX,
        scrollY: fitted.scrollY,
        zoom: fitted.zoom,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, []);

  // ---- Shared document + socket -------------------------------------------
  useEffect(() => {
    const doc = new Y.Doc();
    const elements = doc.getMap<ExcalidrawElement>(ELEMENTS_KEY);
    const files = doc.getMap<SharedBoardFile>(FILES_KEY);
    const awareness = new Awareness(doc);
    // Captured for the cleanup below: these Maps outlive any single render, so
    // reading them at teardown time would trip the ref-in-cleanup lint rule.
    const syncedVersions = syncedVersionsRef.current;
    const syncedFiles = syncedFilesRef.current;
    docRef.current = doc;
    elementsRef.current = elements;
    filesRef.current = files;
    awarenessRef.current = awareness;

    const socket: BoardSocket = io(`${API_URL}/board`, {
      auth: (cb) =>
        void getRealtimeToken().then((token) => cb({ token: token ?? '' })),
      transports: ['websocket'],
    });
    socketRef.current = socket;

    let joined = false;
    let authRetries = 0;
    let joinTimer: ReturnType<typeof setTimeout> | undefined;
    const clearJoinTimer = () => {
      if (joinTimer) clearTimeout(joinTimer);
      joinTimer = undefined;
    };
    const join = () => {
      if (!socket.connected) return;
      socket.emit('board:join', {
        sessionId,
        ...(teaching ? { as: 'teach' as const } : {}),
      });
      clearJoinTimer();
      joinTimer = setTimeout(() => {
        if (!joined) join();
      }, 2_000);
    };

    const onElements = (event: Y.YMapEvent<ExcalidrawElement>) => {
      // Our own writes are already in the scene.
      if (event.transaction.origin === LOCAL) return;
      const changed: ExcalidrawElement[] = [];
      for (const id of event.keys.keys()) {
        const value = elements.get(id);
        if (isSharedElement(value)) changed.push(value);
      }
      applyRemoteElements(changed);
    };
    elements.observe(onElements);
    files.observe(hydrateFiles);

    // doc -> socket: forward only local edits (remote updates carry a different
    // origin and must not echo back).
    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === LOCAL && socket.connected) {
        socket.emit('board:update', { sessionId, update });
      }
    };
    doc.on('update', onDocUpdate);

    const onAwarenessUpdate = (
      {
        added,
        updated,
        removed,
      }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === 'remote' || !socket.connected) return;
      const changed = [...added, ...updated, ...removed];
      if (changed.length === 0) return;
      socket.emit('board:awareness', {
        sessionId,
        update: encodeAwarenessUpdate(awareness, changed),
      });
    };
    awareness.on('update', onAwarenessUpdate);

    /** Rebuild the collaborator overlay from awareness state. */
    const renderCollaborators = () => {
      const editor = apiRef.current;
      if (!editor) return;
      const next = new Map<SocketId, Collaborator>();
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const collab = (state as { collab?: Collaborator }).collab;
        if (collab?.pointer) next.set(String(clientId) as SocketId, collab);
      });
      // The presenter's laser rides the presenter channel, not awareness.
      const laser = collaboratorsRef.current.get(PRESENTER_ID);
      if (laser) next.set(PRESENTER_ID, laser);
      collaboratorsRef.current = next;
      editor.updateScene({ collaborators: next });
    };
    awareness.on('change', renderCollaborators);

    socket.on('connect', () => {
      joined = false;
      authRetries = 0;
      setReady(false);
      join();
    });
    socket.on('disconnect', () => {
      joined = false;
      clearJoinTimer();
      setReady(false);
    });
    socket.on('board:state', (packet) => {
      const update = boardBytes(packet.update);
      if (!update) return;
      Y.applyUpdate(doc, update, 'remote');
      joined = true;
      clearJoinTimer();
      // The editor may not have mounted yet; the api-ready effect below
      // replays the document once it has.
      applyRemoteElements([...elements.values()].filter(isSharedElement));
      hydrateFiles();
      setReady(true);
    });
    socket.on('board:update', (packet) => {
      const update = boardBytes(packet.update);
      if (update) Y.applyUpdate(doc, update, 'remote');
    });
    socket.on('board:awareness', (packet) => {
      const update = boardBytes(packet.update);
      if (update) applyAwarenessUpdate(awareness, update, 'remote');
    });
    socket.on('board:writable', (packet) => setBoardOpen(packet.open));
    socket.on('board:presenter', (packet) => {
      const editor = apiRef.current;
      if (!editor || canDraw) return;
      if (packet.bounds) lastBoundsRef.current = packet.bounds;
      // The presenter's pointer doubles as the shared laser.
      if (packet.cursor) {
        collaboratorsRef.current.set(PRESENTER_ID, {
          pointer: { ...packet.cursor, tool: 'laser' },
          username: 'Instructor',
          socketId: PRESENTER_ID,
        });
      } else {
        collaboratorsRef.current.delete(PRESENTER_ID);
      }
      editor.updateScene({ collaborators: new Map(collaboratorsRef.current) });
      if (followingRef.current) applyPresenterView();
    });
    socket.on('error', (error) => {
      if (error.code !== 'UNAUTHORIZED' || authRetries >= 2) return;
      authRetries += 1;
      clearRealtimeToken();
      window.setTimeout(() => {
        if (socketRef.current === socket) socket.connect();
      }, 600);
    });

    return () => {
      clearJoinTimer();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      elements.unobserve(onElements);
      files.unobserve(hydrateFiles);
      doc.off('update', onDocUpdate);
      awareness.off('update', onAwarenessUpdate);
      awareness.off('change', renderCollaborators);
      socket.emit('board:leave', { sessionId });
      socket.disconnect();
      awareness.destroy();
      doc.destroy();
      docRef.current = null;
      elementsRef.current = null;
      filesRef.current = null;
      awarenessRef.current = null;
      socketRef.current = null;
      syncedVersions.clear();
      syncedFiles.clear();
    };
  }, [
    sessionId,
    teaching,
    canDraw,
    applyRemoteElements,
    hydrateFiles,
    applyPresenterView,
  ]);

  // The socket handshake can beat the editor's mount, in which case the state
  // packet had nowhere to land. Replay the shared document as soon as the
  // editor exists so a joiner never starts on a blank board.
  useEffect(() => {
    if (!api) return;
    const map = elementsRef.current;
    if (!map) return;
    applyRemoteElements([...map.values()].filter(isSharedElement));
    hydrateFiles();
  }, [api, applyRemoteElements, hydrateFiles]);

  /**
   * Frame whatever is already on the board, once, when this client is ready.
   * A late joiner otherwise lands on Excalidraw's default camera at 100% — which
   * on a board whose content sits elsewhere is an empty screen, and on a phone
   * is a corner of a page. Skipped once the presenter has sent a view (that is
   * better than any guess we could make) or once the user has taken over.
   */
  useEffect(() => {
    if (!ready || !api || didInitialFitRef.current) return;
    if (lastBoundsRef.current) return;
    const elements = api.getSceneElements();
    if (!elements.length) return;
    const appState = api.getAppState();
    if (!appState.width || !appState.height) return;
    didInitialFitRef.current = true;
    api.scrollToContent(elements, {
      fitToContent: true,
      // Leave a margin so strokes at the very edge aren't flush to the bezel.
      viewportZoomFactor: 0.9,
      animate: false,
    });
  }, [ready, api]);

  // Re-frame a following viewer when their own viewport changes size (rotating
  // a phone, opening the side panel) — the presenter won't re-announce.
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || canDraw) return;
    const observer = new ResizeObserver(() => {
      if (followingRef.current) applyPresenterView();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [canDraw, applyPresenterView]);

  // ---- Local edits -> shared doc ------------------------------------------
  /** Write every element whose version the shared doc hasn't seen yet. */
  const flushLocal = useCallback(() => {
    flushTimerRef.current = null;
    const scene = pendingRef.current;
    const map = elementsRef.current;
    const doc = docRef.current;
    pendingRef.current = null;
    if (!scene || !map || !doc) return;
    const seen = syncedVersionsRef.current;
    const changed = scene.filter((el) => seen.get(el.id) !== el.version);
    if (changed.length === 0) return;
    doc.transact(() => {
      for (const el of changed) {
        seen.set(el.id, el.version);
        map.set(el.id, el);
      }
    }, LOCAL);
  }, []);

  /** Upload any image the local user just added, and share only its URL. */
  const shareNewFiles = useCallback(
    (fileIds: string[]) => {
      const editor = apiRef.current;
      const map = filesRef.current;
      const doc = docRef.current;
      if (!editor || !map || !doc) return;
      const local = editor.getFiles();
      for (const id of fileIds) {
        if (syncedFilesRef.current.has(id)) continue;
        const file = local[id];
        if (!file?.dataURL) continue;
        syncedFilesRef.current.add(id);
        void uploadBoardAsset(sessionId, dataURLToFile(file.dataURL, `${id}.png`))
          .then((url) => {
            doc.transact(() => {
              map.set(id, {
                id,
                url,
                mimeType: file.mimeType,
                created: file.created ?? Date.now(),
              });
            }, LOCAL);
          })
          .catch(() => {
            syncedFilesRef.current.delete(id);
            flash('An image failed to upload — students may not see it.');
          });
      }
    },
    [sessionId, flash],
  );

  /**
   * Send the presenter's camera now. `bounds` is the visible scene rectangle;
   * followers fit that to their own viewport, which is what carries pan AND
   * zoom across to every screen size.
   */
  const sendPresenter = useCallback(
    (cursor: { x: number; y: number } | null) => {
      const editor = apiRef.current;
      if (!editor || !canDrawRef.current) return;
      const appState = editor.getAppState();
      if (!appState.width || !appState.height) return;
      lastPresenterRef.current = Date.now();
      const [x1, y1, x2, y2] = getVisibleSceneBounds(appState);
      socketRef.current?.emit('board:presenter', {
        sessionId: sessionIdRef.current,
        camera: {
          x: appState.scrollX,
          y: appState.scrollY,
          z: appState.zoom.value,
        },
        cursor,
        bounds: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 },
      });
    },
    [],
  );

  /**
   * Throttled wrapper. The camera only needs to feel attached, not be
   * frame-accurate — but the *last* position of a gesture always matters, so a
   * throttled call schedules a trailing send rather than dropping it. Without
   * that, a pan or zoom that ends inside the throttle window leaves every
   * follower a beat behind the instructor.
   */
  const emitPresenter = useCallback(
    (cursor: { x: number; y: number } | null) => {
      if (Date.now() - lastPresenterRef.current < PRESENTER_INTERVAL_MS) {
        if (!presenterTrailingRef.current) {
          presenterTrailingRef.current = setTimeout(() => {
            presenterTrailingRef.current = null;
            sendPresenter(cursor);
          }, PRESENTER_INTERVAL_MS);
        }
        return;
      }
      if (presenterTrailingRef.current) {
        clearTimeout(presenterTrailingRef.current);
        presenterTrailingRef.current = null;
      }
      sendPresenter(cursor);
    },
    [sendPresenter],
  );

  useEffect(
    () => () => {
      if (presenterTrailingRef.current) clearTimeout(presenterTrailingRef.current);
    },
    [],
  );

  const onChange = useCallback(
    (scene: readonly OrderedExcalidrawElement[]) => {
      const editor = apiRef.current;
      if (!editor) return;

      if (canEdit) {
        pendingRef.current = scene;
        if (!flushTimerRef.current) {
          flushTimerRef.current = setTimeout(flushLocal, SYNC_INTERVAL_MS);
        }
        const unshared = Object.keys(editor.getFiles()).filter(
          (id) => !syncedFilesRef.current.has(id),
        );
        if (unshared.length) shareNewFiles(unshared);
      }

      emitPresenter(null);
    },
    [canEdit, flushLocal, shareNewFiles, emitPresenter],
  );

  /** Broadcast this user's pointer; the instructor's also drives the laser. */
  const onPointerUpdate = useCallback(
    (payload: {
      pointer: { x: number; y: number; tool: 'pointer' | 'laser' };
      button: 'down' | 'up';
    }) => {
      awarenessRef.current?.setLocalStateField('collab', {
        pointer: payload.pointer,
        button: payload.button,
        username: canDraw ? 'Instructor' : 'Student',
      });
      if (!canDraw) return;
      emitPresenter(
        payload.pointer.tool === 'laser'
          ? { x: payload.pointer.x, y: payload.pointer.y }
          : null,
      );
    },
    [canDraw, emitPresenter],
  );

  /**
   * The presenter's pan/zoom is broadcast from here — scrolling and zooming
   * change no elements, so onChange alone was never a reliable signal for it.
   * On a viewer, this is the "did they take over the view" test: a scroll that
   * matches the camera we just applied is our own follow move, not a gesture.
   */
  const onScrollChange = useCallback(
    (scrollX: number, scrollY: number, zoom: { value: number }) => {
      if (canDraw) {
        emitPresenter(null);
        return;
      }
      if (!followingRef.current) return;
      // Excalidraw normalises the zoom it actually applies, so compare with a
      // tolerance — still an order of magnitude tighter than any real gesture,
      // where one wheel step is ~10%.
      const applied = lastAppliedViewRef.current;
      const isOurs =
        applied !== null &&
        Math.abs(applied.scrollX - scrollX) < 0.5 &&
        Math.abs(applied.scrollY - scrollY) < 0.5 &&
        Math.abs(applied.zoom - zoom.value) < 0.01;
      if (!isOurs) setFollowing(false);
    },
    [canDraw, emitPresenter],
  );

  // ---- Board controls ------------------------------------------------------
  const toggleBoardOpen = useCallback(() => {
    const open = !boardOpen;
    setBoardOpen(open);
    socketRef.current?.emit('board:writable', { sessionId, open });
  }, [boardOpen, sessionId]);

  const addTemplate = useCallback((key: string) => {
    const editor = apiRef.current;
    const template = TEMPLATES[key];
    if (!editor || !template) return;
    editor.updateScene({
      elements: [...editor.getSceneElementsIncludingDeleted(), ...template.make()],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, []);

  const resync = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    setResyncing(true);
    // Forget what we think the server has, then ask for the full document
    // again — a wedged board recovers in one tap instead of a page reload.
    syncedVersionsRef.current.clear();
    syncedFilesRef.current.clear();
    socket.emit('board:join', {
      sessionId,
      ...(teaching ? { as: 'teach' as const } : {}),
    });
    window.setTimeout(() => setResyncing(false), 900);
  }, [sessionId, teaching]);

  const importFiles = useCallback(
    async (list: FileList | null) => {
      const editor = apiRef.current;
      const map = filesRef.current;
      const doc = docRef.current;
      if (!editor || !map || !doc || !list?.length) return;
      setImporting(true);
      try {
        const images: File[] = [];
        for (const file of Array.from(list)) {
          if (file.type === 'application/pdf') {
            const pages = await pdfToImageFiles(file);
            if (pages.length === PDF_MAX_PAGES) {
              flash(`Only the first ${PDF_MAX_PAGES} pages were imported.`);
            }
            images.push(...pages);
          } else if (file.type.startsWith('image/')) {
            images.push(file);
          }
        }
        if (!images.length) {
          flash('Nothing to import — pick an image or a PDF.');
          return;
        }
        // Lay pages out in a column so a deck reads top to bottom.
        let y = 0;
        const added: ExcalidrawElement[] = [];
        for (const image of images) {
          const bitmap = await createImageBitmap(image);
          const width = Math.min(900, bitmap.width);
          const height = (bitmap.height / bitmap.width) * width;
          bitmap.close?.();
          const fileId = crypto.randomUUID();
          const url = await uploadBoardAsset(sessionId, image);
          const dataURL = await fetchAsDataURL(url);
          const created = Date.now();
          editor.addFiles([
            { id: fileId as FileId, dataURL, mimeType: image.type, created } as BinaryFileData,
          ]);
          // Marked shared before the element lands, so onChange's upload pass
          // skips it — these bytes are already in the asset store.
          syncedFilesRef.current.add(fileId);
          doc.transact(() => {
            map.set(fileId, { id: fileId, url, mimeType: image.type, created });
          }, LOCAL);
          added.push(
            ...convertToExcalidrawElements([
              { type: 'image', x: 0, y, width, height, fileId: fileId as FileId },
            ]),
          );
          y += height + 24;
        }
        editor.updateScene({
          elements: [...editor.getSceneElementsIncludingDeleted(), ...added],
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        editor.scrollToContent(added, { fitToContent: true });
      } catch {
        flash('Import failed — please try again.');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [sessionId, flash],
  );

  const exportPng = useCallback(async () => {
    const editor = apiRef.current;
    if (!editor) return;
    setExporting(true);
    try {
      const blob = await exportToBlob({
        elements: editor.getSceneElements(),
        appState: { ...editor.getAppState(), exportBackground: true },
        files: editor.getFiles(),
        mimeType: 'image/png',
        exportPadding: 24,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `board-${sessionId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      flash('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  }, [sessionId, flash]);

  // Full-screen board mode (all users). A CSS overlay rather than the native
  // Fullscreen API, so the editor's menus and the classroom controls keep
  // working; Escape exits.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // Excalidraw measures itself on mount; a size change needs an explicit nudge.
  useEffect(() => {
    api?.refresh();
  }, [api, fullscreen]);

  // Test hook. Excalidraw draws to a canvas rather than to DOM nodes, so the
  // end-to-end specs have nothing to query for "what is on the board"; they
  // read the scene through this instead.
  useEffect(() => {
    if (!api) return;
    const w = window as unknown as {
      __livetichBoard?: ExcalidrawImperativeAPI | null;
    };
    w.__livetichBoard = api;
    return () => {
      w.__livetichBoard = null;
    };
  }, [api]);

  const pill =
    'rounded-full px-3 py-1.5 text-xs font-semibold shadow ring-1 ring-neutral-200 transition';

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'livetich-board',
        fullscreen
          ? 'fixed inset-0 z-[500] isolate overflow-hidden bg-white'
          : 'relative isolate h-full min-h-[320px] overflow-hidden rounded-xl border border-neutral-300 bg-white',
      )}
    >
      <Excalidraw
        excalidrawAPI={setApi}
        viewModeEnabled={!canEdit}
        isCollaborating
        theme="light"
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        onScrollChange={onScrollChange}
        // The library panel is an excalidraw.com feature (and its own brand
        // surface); a classroom board has no use for it.
        renderTopRightUI={() => null}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            saveAsImage: false,
            toggleTheme: false,
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>

      {!ready && (
        <div className="absolute inset-0 z-[450] flex flex-col items-center justify-center gap-3 bg-white/94 px-6 text-center backdrop-blur-sm">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
          <p className="text-sm font-semibold text-neutral-700">
            Connecting to the board…
          </p>
        </div>
      )}

      {/* Round utility buttons, clear of the editor's own bottom-bar UI. */}
      <button
        type="button"
        onClick={resync}
        disabled={resyncing}
        title="Resync the board"
        className="pointer-events-auto absolute bottom-16 right-14 z-[402] grid h-9 w-9 place-items-center rounded-lg bg-white/90 text-neutral-700 shadow ring-1 ring-neutral-200 backdrop-blur transition hover:bg-white hover:text-neutral-900 disabled:opacity-60"
      >
        <PiArrowsClockwiseBold className={resyncing ? 'animate-spin' : ''} />
      </button>
      <button
        type="button"
        onClick={() => setFullscreen((v) => !v)}
        title={fullscreen ? 'Exit full screen' : 'Full screen'}
        className="pointer-events-auto absolute bottom-16 right-3 z-[402] grid h-9 w-9 place-items-center rounded-lg bg-white/90 text-neutral-700 shadow ring-1 ring-neutral-200 backdrop-blur transition hover:bg-white hover:text-neutral-900"
      >
        {fullscreen ? <PiArrowsInBold /> : <PiArrowsOutBold />}
      </button>

      {/* Instructor controls / viewer follow, above the editor's top bar. */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-[401] flex max-w-[calc(100%-6rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5">
        {canDraw ? (
          <>
            <button
              type="button"
              onClick={toggleBoardOpen}
              className={`pointer-events-auto ${pill} ${
                boardOpen
                  ? 'bg-emerald-600 text-white ring-emerald-600'
                  : 'bg-white text-neutral-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {boardOpen ? <PiLockOpenBold /> : <PiLockBold />}
                {boardOpen ? 'Students can draw' : 'Board locked'}
              </span>
            </button>
            {templates
              .filter((key) => TEMPLATES[key])
              .map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => addTemplate(key)}
                  className={`pointer-events-auto ${pill} bg-white text-neutral-800`}
                >
                  {TEMPLATES[key].label}
                </button>
              ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className={`pointer-events-auto ${pill} bg-white text-neutral-800 disabled:opacity-50`}
            >
              <span className="flex items-center gap-1.5">
                <PiUploadSimpleBold />
                {importing ? 'Importing…' : 'Import'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void exportPng()}
              disabled={exporting}
              className={`pointer-events-auto ${pill} bg-white text-neutral-800 disabled:opacity-50`}
            >
              <span className="flex items-center gap-1.5">
                <PiDownloadSimpleBold />
                {exporting ? 'Exporting…' : 'Export'}
              </span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setFollowing(true);
              applyPresenterView();
            }}
            className={`pointer-events-auto ${pill} ${
              following
                ? 'bg-white text-neutral-500'
                : 'animate-pulse bg-neutral-900 text-white ring-neutral-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <PiCrosshairBold />
              {following ? 'Following instructor' : "Back to instructor's view"}
            </span>
          </button>
        )}
      </div>

      {boardMsg && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-[402] -translate-x-1/2 rounded-full bg-neutral-900/90 px-3 py-1.5 text-xs font-semibold text-white shadow">
          {boardMsg}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        hidden
        onChange={(e) => void importFiles(e.target.files)}
      />
    </div>
  );
}
