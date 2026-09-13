'use client';

import '@excalidraw/excalidraw/index.css';
import 'katex/dist/katex.min.css';
import './board-excalidraw.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  ToolType,
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
  PiCaretDownBold,
  PiFunctionBold,
  PiXBold,
  PiLockBold,
  PiLinkSimpleBold,
  PiLockOpenBold,
  PiPencilSimpleBold,
  PiSlidersHorizontalBold,
  PiUploadSimpleBold,
} from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/ui';
import { getRealtimeToken, clearRealtimeToken } from '@/lib/client-token';
import type {
  BoardClientToServerEvents,
  BoardServerToClientEvents,
} from '@/lib/realtime-contract';
import { BoardDocEmbed } from './board-doc-embed';
import { googleEmbed } from './board-docs';
import { BoardVideoEmbed } from './board-video-embed';
import { youTubeIdOf, type VideoState } from './board-video';
import {
  MATH_CATEGORIES,
  MATH_ENTRIES,
  searchMath,
  type MathCategory,
  type MathEntry,
} from './board-math-palette';
import {
  mathError,
  renderMathHtml,
  renderMathToPng,
  type MathCustomData,
} from './board-math';
import {
  PDF_MAX_PAGES,
  dataURLToFile,
  fetchAsDataURL,
  fileToDataURL,
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
/**
 * One selected equation: the element to change, the LaTeX behind it, and where
 * it currently sits on screen so the Edit chip can follow it through pans and
 * zooms.
 */
interface SelectedMath {
  id: string;
  latex: string;
  x: number;
  y: number;
  height: number;
  /** Viewport pixels, relative to the board wrapper. */
  left: number;
  top: number;
}

/**
 * The one selected equation, or null.
 *
 * Only when exactly one is selected: "edit this" has no meaning over a
 * multi-select, and silently picking the first of several would change
 * something the teacher did not point at.
 */
function soleMathElement(
  elements: readonly ExcalidrawElement[],
  selectedIds: Readonly<Record<string, boolean>>,
  view: { scrollX: number; scrollY: number; zoom: number },
): SelectedMath | null {
  let found: SelectedMath | null = null;
  for (const el of elements) {
    if (el.isDeleted || !selectedIds[el.id]) continue;
    const latex = (el.customData as MathCustomData | undefined)?.livetichMath;
    if (typeof latex !== 'string') return null; // a non-equation is in the selection
    if (found) return null; // more than one
    found = {
      id: el.id,
      latex,
      x: el.x,
      y: el.y,
      height: el.height,
      left: Math.round((el.x + view.scrollX) * view.zoom),
      top: Math.round((el.y + view.scrollY) * view.zoom),
    };
  }
  return found;
}

/** The topmost equation under a point given in scene coordinates. */
function mathElementAt(
  elements: readonly ExcalidrawElement[],
  sx: number,
  sy: number,
): ExcalidrawElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.isDeleted) continue;
    if (typeof (el.customData as MathCustomData | undefined)?.livetichMath !== 'string') {
      continue;
    }
    if (sx >= el.x && sx <= el.x + el.width && sy >= el.y && sy <= el.y + el.height) {
      return el;
    }
  }
  return null;
}

/** Freehand drawing changes elements many times per second. Coalescing those
 *  mutations keeps the shared-board transport responsive on modest devices. */
const SYNC_INTERVAL_MS = 50;
/** The presenter's camera is broadcast less often than strokes — it only needs
 *  to feel attached, not be frame-accurate. */
const PRESENTER_INTERVAL_MS = 100;
/** Hydration retries per file, and the base of their exponential backoff. */
const MAX_FILE_RETRIES = 3;
const FILE_RETRY_BASE_MS = 500;
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
 * Extra shapes.
 *
 * Excalidraw's toolbar offers rectangle, diamond and ellipse only — there is no
 * triangle, and no way to register a new tool. These are inserted as closed
 * `line` elements instead, which is what Excalidraw's own diamond effectively
 * is: once placed they are ordinary elements, so they select, resize, restyle
 * and sync like anything else drawn by hand.
 */
type Point = [number, number];

/** A regular polygon inscribed in a size x size box, first vertex at the top. */
function polygonPoints(sides: number, size: number): Point[] {
  const r = size / 2;
  const pts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return pts;
}

/** A star, alternating between the outer and inner radius. */
function starPoints(spikes: number, size: number): Point[] {
  const r = size / 2;
  const inner = r * 0.4;
  const pts: Point[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    pts.push([r + rad * Math.cos(a), r + rad * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return pts;
}

const SHAPE_SIZE = 160;

/**
 * The shape menu. Excalidraw's own square/diamond/circle are *tools* — pick one
 * and the next drag draws it. The rest have no tool to select, so they are
 * dropped straight onto the board as closed line elements. One menu presents
 * both; the distinction is an implementation detail, not something to make the
 * instructor think about mid-lesson.
 */
/**
 * Every shape, in one menu. Square, diamond and circle are Excalidraw tools, so
 * picking them arms that tool; the rest have no tool and are drawn by arming a
 * rectangle for the drag and swapping the polygon in on pointer up. Their three
 * toolbar buttons are hidden (see board-excalidraw.css) so each shape has
 * exactly one home.
 */
type ShapeEntry =
  | { key: string; label: string; tool: ToolType; icon: string }
  | { key: string; label: string; points: Point[]; icon: string };

const SHAPES: ShapeEntry[] = [
  { key: 'rectangle', label: 'Square', tool: 'rectangle', icon: 'M4 4h16v16H4z' },
  { key: 'diamond', label: 'Diamond', tool: 'diamond', icon: 'M12 2l10 10-10 10L2 12z' },
  {
    key: 'ellipse',
    label: 'Circle',
    tool: 'ellipse',
    icon: 'M12 2a10 10 0 110 20 10 10 0 010-20z',
  },
  {
    key: 'triangle',
    label: 'Triangle',
    points: polygonPoints(3, SHAPE_SIZE),
    icon: 'M12 3l9 18H3z',
  },
  {
    key: 'right-triangle',
    label: 'Right triangle',
    points: [
      [0, 0],
      [0, SHAPE_SIZE],
      [SHAPE_SIZE, SHAPE_SIZE],
      [0, 0],
    ],
    icon: 'M4 3v18h17z',
  },
  {
    key: 'pentagon',
    label: 'Pentagon',
    points: polygonPoints(5, SHAPE_SIZE),
    icon: 'M12 2l10 7.3-3.8 11.7H5.8L2 9.3z',
  },
  {
    key: 'hexagon',
    label: 'Hexagon',
    points: polygonPoints(6, SHAPE_SIZE),
    icon: 'M7 3h10l5 9-5 9H7l-5-9z',
  },
  {
    key: 'octagon',
    label: 'Octagon',
    points: polygonPoints(8, SHAPE_SIZE),
    icon: 'M8 2h8l6 6v8l-6 6H8l-6-6V8z',
  },
  {
    key: 'star',
    label: 'Star',
    points: starPoints(5, SHAPE_SIZE),
    icon: 'M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.8 5.5 21l2-7.5L2 9h7z',
  },
];

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
 * One palette button. Entries with a character show it directly; the rest are
 * rendered as maths, so a structure button looks like the thing it inserts
 * rather than like its source.
 */
function MathButton({
  entry,
  onPick,
}: {
  entry: MathEntry;
  onPick: (entry: MathEntry) => void;
}) {
  const wide = entry.category === 'Equations';
  return (
    <button
      type="button"
      title={`${entry.label}${entry.keywords ? ` — ${entry.keywords}` : ''}`}
      aria-label={entry.label}
      onClick={() => onPick(entry)}
      className={
        // A whole equation needs a row of its own; a glyph does not.
        wide
          ? 'flex w-full items-center gap-3 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-left ring-1 ring-neutral-200 transition hover:bg-neutral-100'
          : 'grid h-8 min-w-[2rem] place-items-center rounded-lg bg-neutral-50 px-1.5 text-sm text-neutral-800 ring-1 ring-neutral-200 transition hover:bg-neutral-100'
      }
    >
      {entry.char ? (
        <span className="pointer-events-none leading-none">{entry.char}</span>
      ) : (
        <span
          className={
            wide
              ? 'pointer-events-none min-w-0 flex-1 overflow-x-auto text-[13px] leading-none text-neutral-900'
              : 'pointer-events-none text-[13px] leading-none'
          }
          // KaTeX rendering of a fixed palette entry, not user input.
          dangerouslySetInnerHTML={{ __html: renderMathHtml(entry.preview ?? entry.latex, false) }}
        />
      )}
      {wide && (
        <span className="pointer-events-none shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
          {entry.label}
        </span>
      )}
    </button>
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
  /** Failed hydration attempts per file id. A fetch failure must not simply
   *  clear the synced marker: hydration is driven by the shared files map, so
   *  an immediate retry is re-triggered by the next map change, and one
   *  rate-limited response turns into a request storm against the API. Retries
   *  are capped and backed off instead. */
  const fileRetriesRef = useRef(new Map<string, number>());
  const retryTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
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
  const [shapesOpen, setShapesOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSource, setLinkSource] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [mathOpen, setMathOpen] = useState(false);
  const [mathSource, setMathSource] = useState('');
  const [mathBusy, setMathBusy] = useState(false);
  /** On a phone the classroom controls collapse behind one button: Excalidraw
   *  gives its own toolbar the full width of the top, and the pills sat on top
   *  of it. */
  const [toolsOpen, setToolsOpen] = useState(false);
  /** The instructor's playback position for a shared video. Ephemeral, so it
   *  rides awareness alongside the cursors rather than the persisted doc. */
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  /** The single selected equation, when exactly one is selected. An equation
   *  is a picture of its LaTeX, so without this its source is unreachable and
   *  the only way to change a value is to retype the whole formula. */
  const [selectedMath, setSelectedMath] = useState<SelectedMath | null>(null);
  const selectedMathRef = useRef<SelectedMath | null>(null);
  /** Set while the panel is editing an existing equation rather than composing
   *  a new one. */
  const [editingMath, setEditingMath] = useState<SelectedMath | null>(null);
  const mathInputRef = useRef<HTMLTextAreaElement>(null);
  const [mathQuery, setMathQuery] = useState('');
  const [mathTab, setMathTab] = useState<MathCategory | 'Recent'>('Equations');
  /** What this instructor actually reaches for, which after a lesson or two
   *  covers most of what they need. Per-browser; losing it costs nothing. */
  const [mathRecent, setMathRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('livetich:math-recent');
      if (raw) setMathRecent(JSON.parse(raw) as string[]);
    } catch {
      // A blocked or full store is not worth failing the board over.
    }
  }, []);
  /** Excalidraw's tool-rail container, so the shapes button can live inside it
   *  rather than float alongside and drift out of alignment. */
  const [railNode, setRailNode] = useState<HTMLElement | null>(null);
  const shapesTriggerRef = useRef<HTMLButtonElement>(null);
  /** Where to draw the shapes menu, in board coordinates. It cannot live inside
   *  the toolbar: that row scrolls on a phone, and a dropdown inside a
   *  scrolling container gets clipped by it. */
  const [shapesMenuAt, setShapesMenuAt] = useState<{ top: number; left: number } | null>(
    null,
  );
  /** The shape the rail button displays — the last one picked, so the control
   *  reads like Excalidraw's own tools rather than a fixed icon. */
  /** null until the instructor picks one — the button then shows a group of
   *  shapes rather than a lone square, which is what made three tools
   *  collapsing into one read as "the shapes are gone". */
  const [activeShape, setActiveShape] = useState<string | null>(null);
  /** A polygon waiting for a drag. Excalidraw cannot register new tools, so the
   *  rectangle tool is armed for the drag (giving a live rubber-band preview
   *  and exact bounds) and whatever it draws is swapped for the polygon on
   *  pointer up. */
  const armedShapeRef = useRef<string | null>(null);
  /** Element ids present when the shape was armed, so the rectangle drawn by
   *  the drag can be told apart from everything already on the board. */
  const armedBaselineRef = useRef<Set<string>>(new Set());
  /** The placeholder rectangle is drawn at zero opacity so the drag shows the
   *  real shape instead of a box; this is the opacity to give the finished
   *  polygon, and to hand back when the shape is disarmed. */
  const armedOpacityRef = useRef(100);
  /** Set once the armed tool has actually taken effect, so a disarm can never
   *  fire on the render between picking a shape and the tool switching. */
  const armedActiveRef = useRef(false);
  /** Live drag box in viewport pixels, for the preview overlay. Mirrored in a
   *  ref so onChange can tell a real change from a repeat without taking the
   *  state as a dependency — Excalidraw calls onChange on every update, so a
   *  fresh object each time is an infinite render loop. */
  type PreviewBox = { x: number; y: number; w: number; h: number; key: string };
  const [preview, setPreview] = useState<PreviewBox | null>(null);
  const previewRef = useRef<PreviewBox | null>(null);
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
  const hydrateFiles = useCallback(function hydrate() {
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
          // Back off, and give up after a few tries — Resync is the escape
          // hatch for a file that never arrives.
          const attempts = (fileRetriesRef.current.get(value.id) ?? 0) + 1;
          fileRetriesRef.current.set(value.id, attempts);
          if (attempts > MAX_FILE_RETRIES) return;
          const timer = setTimeout(
            () => {
              retryTimersRef.current.delete(timer);
              syncedFilesRef.current.delete(value.id);
              hydrate();
            },
            FILE_RETRY_BASE_MS * 2 ** attempts,
          );
          retryTimersRef.current.add(timer);
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
    // Follow the part of the presenter's view that actually has something in
    // it, by intersecting their visible rectangle with the content bounds.
    //
    // Fitting their raw viewport is what leaves a shared page tiny on a phone:
    // a wide desktop viewport is mostly empty margin around a portrait page, and
    // scaling all that emptiness to a narrow screen shrinks the page itself. The
    // intersection handles every case with one rule — zoomed into part of a
    // page, it is their view; viewport larger than the content, it is the
    // content; panned off to one side, it is whatever overlaps. Only when they
    // are looking at genuinely empty canvas is there nothing to intersect, and
    // then their framing is the best signal we have.
    const elements = editor.getSceneElements();
    if (elements.length) {
      const [cx0, cy0, cx1, cy1] = getCommonBounds(elements);
      const ix0 = Math.max(x, cx0);
      const iy0 = Math.max(y, cy0);
      const ix1 = Math.min(x + w, cx1);
      const iy1 = Math.min(y + h, cy1);
      if (ix1 - ix0 > 1 && iy1 - iy0 > 1) {
        x = ix0;
        y = iy0;
        w = ix1 - ix0;
        h = iy1 - iy0;
      }
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
    const retryTimers = retryTimersRef.current;
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
      let video: VideoState | null = null;
      awareness.getStates().forEach((state, clientId) => {
        // A viewer takes the video clock from whoever is presenting, which is
        // never themselves.
        const shared = (state as { video?: VideoState }).video;
        if (shared && clientId !== awareness.clientID) video = shared;
        if (clientId === awareness.clientID) return;
        const collab = (state as { collab?: Collaborator }).collab;
        if (collab?.pointer) next.set(String(clientId) as SocketId, collab);
      });
      setVideoState(video);
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
      for (const t of retryTimers) clearTimeout(t);
      retryTimers.clear();
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
    const changed = scene.filter((el) => {
      if (seen.get(el.id) === el.version) return false;
      // Hold an embed back until it has its URL. Excalidraw decides whether an
      // embeddable is valid the first time it sees one and caches that per
      // instance, never rechecking — so a student who receives the element
      // while the instructor is still typing the link caches it as invalid and
      // is left with a dead box showing the URL as text, even once the link
      // arrives. Publishing it only when complete means their first sight of it
      // is the finished embed.
      if (el.type === 'embeddable' && !el.link) return false;
      return true;
    });
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
          .then(({ url }) => {
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
            // Same trap as hydration, but hotter: this runs from onChange,
            // which fires on every pointer move, so clearing the marker
            // outright retries the upload on the next stroke — and one
            // rate-limited response becomes a request storm. Back off, and stop
            // after a few tries.
            const attempts = (fileRetriesRef.current.get(id) ?? 0) + 1;
            fileRetriesRef.current.set(id, attempts);
            if (attempts > MAX_FILE_RETRIES) {
              flash('An image failed to upload — students may not see it.');
              return;
            }
            const timer = setTimeout(
              () => {
                retryTimersRef.current.delete(timer);
                syncedFilesRef.current.delete(id);
              },
              FILE_RETRY_BASE_MS * 2 ** attempts,
            );
            retryTimersRef.current.add(timer);
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

      const state = editor.getAppState();
      const armedKey = armedShapeRef.current;

      // Track the in-flight drag so the overlay can draw the real shape over
      // the invisible placeholder. Scene coords -> viewport pixels.
      if (armedKey && state.newElement) {
        const z = state.zoom.value;
        const next: PreviewBox = {
          x: (state.newElement.x + state.scrollX) * z,
          y: (state.newElement.y + state.scrollY) * z,
          w: state.newElement.width * z,
          h: state.newElement.height * z,
          key: armedKey,
        };
        const cur = previewRef.current;
        if (
          !cur ||
          cur.x !== next.x ||
          cur.y !== next.y ||
          cur.w !== next.w ||
          cur.h !== next.h ||
          cur.key !== next.key
        ) {
          previewRef.current = next;
          setPreview(next);
        }
      } else if (previewRef.current) {
        previewRef.current = null;
        setPreview(null);
      }

      // A polygon is armed and the drag has finished (`newElement` is only set
      // while one is being drawn): swap the rectangle it drew for the polygon,
      // scaled to exactly that box. This rides onChange rather than the pointer
      // callbacks because the scene is guaranteed to be committed here.
      if (armedKey && !state.newElement) {
        const entry = SHAPES.find((x) => x.key === armedKey);
        const shape = entry && !('tool' in entry) ? entry : undefined;
        const box = shape
          ? scene.find(
              (el) =>
                el.type === 'rectangle' &&
                !el.isDeleted &&
                !armedBaselineRef.current.has(el.id),
            )
          : undefined;
        if (shape && box) {
          const w = Math.max(8, box.width);
          const h = Math.max(8, box.height);
          const polygon = convertToExcalidrawElements([
            {
              type: 'line',
              x: box.x,
              y: box.y,
              width: w,
              height: h,
              points: shape.points.map(
                ([px, py]) =>
                  [(px / SHAPE_SIZE) * w, (py / SHAPE_SIZE) * h] as Point,
              ),
              strokeColor: box.strokeColor,
              backgroundColor: box.backgroundColor,
              fillStyle: box.fillStyle,
              strokeWidth: box.strokeWidth,
              strokeStyle: box.strokeStyle,
              roughness: box.roughness,
              opacity: armedOpacityRef.current,
            },
          ]);
          // Cleared first: updateScene re-enters onChange, and a second pass
          // must not try to convert the polygon it just created.
          armedShapeRef.current = null;
          editor.updateScene({
            elements: [...scene.filter((el) => el.id !== box.id), ...polygon],
            // Hand back the opacity borrowed to hide the placeholder, or the
            // instructor's next shape would come out invisible.
            appState: { currentItemOpacity: armedOpacityRef.current },
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
          editor.setActiveTool({ type: 'selection' });
          return;
        }
      }

      const tool = state.activeTool.type;

      // Abandoning an armed shape — switching tool, or a drag that produced
      // nothing — must hand back the borrowed opacity, or the next shape the
      // instructor draws comes out invisible.
      if (armedKey) {
        if (tool === 'rectangle') {
          armedActiveRef.current = true;
        } else if (armedActiveRef.current && !state.newElement) {
          armedShapeRef.current = null;
          armedActiveRef.current = false;
          previewRef.current = null;
          setPreview(null);
          editor.updateScene({
            appState: { currentItemOpacity: armedOpacityRef.current },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
      }

      // Which equation is selected, if any. Compared against a ref so this
      // only ever sets state on a real change — the handler runs on every
      // pointer move over the canvas.
      const picked = soleMathElement(scene, state.selectedElementIds, {
        scrollX: state.scrollX,
        scrollY: state.scrollY,
        zoom: state.zoom.value,
      });
      const held = selectedMathRef.current;
      if (
        picked?.id !== held?.id ||
        picked?.latex !== held?.latex ||
        picked?.left !== held?.left ||
        picked?.top !== held?.top
      ) {
        selectedMathRef.current = picked;
        setSelectedMath(picked);
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
      // A viewer who cannot draw has no reason to put a cursor on everyone
      // else's board — it is just a pointer wandering over the lesson. Only
      // broadcast while this user can actually act on the board.
      if (canEdit) {
        awarenessRef.current?.setLocalStateField('collab', {
          pointer: payload.pointer,
          button: payload.button,
          username: canDraw ? 'Instructor' : 'Student',
        });
      }
      if (!canDraw) return;
      emitPresenter(
        payload.pointer.tool === 'laser'
          ? { x: payload.pointer.x, y: payload.pointer.y }
          : null,
      );
    },
    [canDraw, canEdit, emitPresenter],
  );

  // Withdraw this client's cursor as soon as it loses the right to draw, so a
  // locked board doesn't leave a stale pointer sitting on everyone's screen.
  useEffect(() => {
    if (canEdit) return;
    awarenessRef.current?.setLocalStateField('collab', null);
  }, [canEdit]);

  /**
   * The presenter's pan/zoom is broadcast from here — scrolling and zooming
   * change no elements, so onChange alone was never a reliable signal for it.
   * On a viewer, this is the "did they take over the view" test: a scroll that
   * matches the camera we just applied is our own follow move, not a gesture.
   */
  /** Put the instructor's playhead on the wire for every follower. */
  const broadcastVideo = useCallback((next: VideoState) => {
    awarenessRef.current?.setLocalStateField('video', next);
  }, []);

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

  /**
   * Pick a shape: arm it, then drag on the board to draw it. Square, diamond
   * and circle arm Excalidraw's own tool; the rest arm the rectangle tool to
   * capture the drag, and what it draws is swapped for the polygon on pointer
   * up (see above).
   */
  const addShape = useCallback((key: string) => {
    const editor = apiRef.current;
    const shape = SHAPES.find((x) => x.key === key);
    if (!editor || !shape) return;
    setShapesOpen(false);
    setActiveShape(key);

    // Is a polygon already armed — that is, is currentItemOpacity currently the
    // borrowed 0 rather than the instructor's real setting?
    //
    // Both branches below used to get this wrong, and both left the board
    // drawing in fully transparent ink for the rest of the lesson:
    //
    //   - picking a second polygon re-captured the baseline, so the borrowed 0
    //     became the "real" opacity to hand back, and
    //   - picking a square, diamond or circle returned early without handing
    //     anything back at all.
    //
    // Either way every later shape, and every line of text, was created at
    // opacity 0: drawn, synced, selectable, and completely invisible. Nothing
    // errors, so it reads as the chalkboard having simply stopped working, and
    // it never recovers on its own.
    const armed = armedShapeRef.current !== null;
    const restoreOpacity = () => {
      if (!armed) return;
      editor.updateScene({
        appState: { currentItemOpacity: armedOpacityRef.current },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    };

    if ('tool' in shape) {
      // A real Excalidraw tool — no placeholder, no conversion.
      armedShapeRef.current = null;
      armedActiveRef.current = false;
      previewRef.current = null;
      setPreview(null);
      restoreOpacity();
      editor.setActiveTool({ type: shape.tool });
      return;
    }
    armedShapeRef.current = key;
    armedBaselineRef.current = new Set(
      editor.getSceneElementsIncludingDeleted().map((el) => el.id),
    );
    // Draw the placeholder invisibly — the overlay shows the real shape while
    // the drag is in flight, so the instructor never sees a box.
    // Only read the opacity when it is actually the instructor's; re-reading it
    // while borrowed is what poisoned the baseline.
    if (!armed) {
      armedOpacityRef.current = editor.getAppState().currentItemOpacity;
    }
    armedActiveRef.current = false;
    editor.updateScene({
      appState: { currentItemOpacity: 0 },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    editor.setActiveTool({ type: 'rectangle' });
  }, []);

  /**
   * Drop LaTeX in at the cursor and select the blank inside it, so the next
   * keystroke replaces the placeholder rather than landing after it. This is
   * what lets the palette be used without reading the LaTeX it inserts.
   */
  const insertMath = useCallback(
    (latex: string, select?: [number, number]) => {
      const box = mathInputRef.current;
      const start = box?.selectionStart ?? mathSource.length;
      const end = box?.selectionEnd ?? start;
      setMathSource(mathSource.slice(0, start) + latex + mathSource.slice(end));
      const caret = start + (select ? select[0] : latex.length);
      const length = select ? select[1] : 0;
      // After the controlled value has been applied, not before.
      requestAnimationFrame(() => {
        const el = mathInputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(caret, caret + length);
      });
    },
    [mathSource],
  );

  /** Insert a palette entry and remember it as recently used. */
  const pickMath = useCallback(
    (entry: MathEntry) => {
      insertMath(entry.latex, entry.select);
      setMathRecent((prev) => {
        const next = [entry.latex, ...prev.filter((l) => l !== entry.latex)].slice(0, 12);
        try {
          localStorage.setItem('livetich:math-recent', JSON.stringify(next));
        } catch {
          // Not worth failing the insert over.
        }
        return next;
      });
    },
    [insertMath],
  );

  /**
   * Rasterise the formula and place it on the board. The PNG rides the same
   * asset pipeline as an imported page — uploaded once, shared by URL — and the
   * LaTeX source is kept on the element so it can be edited later rather than
   * being frozen into a picture.
   */
  /** Open the formula panel on an equation that is already on the board. */
  const openMathEditor = useCallback((target: SelectedMath) => {
    setEditingMath(target);
    setMathSource(target.latex);
    setMathOpen(true);
  }, []);

  /** Close the formula panel and forget what it was working on. */
  const closeMath = useCallback(() => {
    setMathOpen(false);
    setMathSource('');
    setEditingMath(null);
  }, []);

  /**
   * Render LaTeX to a PNG, upload it, and register it with the board.
   *
   * Shared by adding and replacing: an equation is stored as a picture plus the
   * source that made it, so both paths need exactly this and differ only in
   * where the result lands.
   */
  const renderMathFile = useCallback(
    async (
      latex: string,
      editor: ExcalidrawImperativeAPI,
      map: Y.Map<SharedBoardFile>,
      doc: Y.Doc,
    ) => {
      const { file, width, height } = await renderMathToPng(
        latex,
        editor.getAppState().currentItemStrokeColor,
      );
      const fileId = crypto.randomUUID();
      const { url, file: uploaded } = await uploadBoardAsset(sessionId, file);
      const dataURL = await fileToDataURL(uploaded);
      const created = Date.now();
      editor.addFiles([
        { id: fileId as FileId, dataURL, mimeType: 'image/png', created } as BinaryFileData,
      ]);
      syncedFilesRef.current.add(fileId);
      doc.transact(() => {
        map.set(fileId, { id: fileId, url, mimeType: 'image/png', created });
      }, LOCAL);
      return { fileId, width, height };
    },
    [sessionId],
  );

  const addMathToBoard = useCallback(async () => {
    const editor = apiRef.current;
    const map = filesRef.current;
    const doc = docRef.current;
    const latex = mathSource.trim();
    if (!editor || !map || !doc || !latex) return;
    setMathBusy(true);
    try {
      const state = editor.getAppState();
      const { fileId, width, height } = await renderMathFile(latex, editor, map, doc);

      // Editing? Stack the new step directly under the one it came from, which
      // is how the working reads down the board. Otherwise centre it in view.
      const from = editingMath;
      const [x1, y1, x2, y2] = getVisibleSceneBounds(state);
      const added = convertToExcalidrawElements([
        {
          type: 'image',
          x: from ? from.x : (x1 + x2) / 2 - width / 2,
          y: from ? from.y + from.height + 24 : (y1 + y2) / 2 - height / 2,
          width,
          height,
          fileId: fileId as FileId,
          customData: { livetichMath: latex } satisfies MathCustomData,
        },
      ]);
      editor.updateScene({
        elements: [...editor.getSceneElementsIncludingDeleted(), ...added],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      closeMath();
    } catch {
      flash('That formula could not be added — check the LaTeX.');
    } finally {
      setMathBusy(false);
    }
  }, [mathSource, editingMath, renderMathFile, closeMath, flash]);

  /**
   * Rewrite the selected equation in place.
   *
   * The element keeps its position and identity, so anything drawn around it
   * stays where the teacher put it — only the picture and the LaTeX behind it
   * change. Use this for a correction; "Add as a new line" is for working
   * through the steps.
   */
  const replaceMathOnBoard = useCallback(async () => {
    const editor = apiRef.current;
    const map = filesRef.current;
    const doc = docRef.current;
    const latex = mathSource.trim();
    const target = editingMath;
    if (!editor || !map || !doc || !latex || !target) return;
    setMathBusy(true);
    try {
      const { fileId, width, height } = await renderMathFile(latex, editor, map, doc);
      editor.updateScene({
        elements: editor.getSceneElementsIncludingDeleted().map((el) =>
          el.id === target.id
            ? {
                ...el,
                fileId: fileId as FileId,
                width,
                height,
                customData: { livetichMath: latex } satisfies MathCustomData,
                version: el.version + 1,
                versionNonce: Math.floor(Math.random() * 2 ** 31),
              }
            : el,
        ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      closeMath();
    } catch {
      flash('That formula could not be added — check the LaTeX.');
    } finally {
      setMathBusy(false);
    }
  }, [mathSource, editingMath, renderMathFile, closeMath, flash]);

  const resync = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    setResyncing(true);
    // Forget what we think the server has, then ask for the full document
    // again — a wedged board recovers in one tap instead of a page reload.
    syncedVersionsRef.current.clear();
    syncedFilesRef.current.clear();
    fileRetriesRef.current.clear();
    socket.emit('board:join', {
      sessionId,
      ...(teaching ? { as: 'teach' as const } : {}),
    });
    window.setTimeout(() => setResyncing(false), 900);
  }, [sessionId, teaching]);

  /**
   * Put a link on the board.
   *
   * Pasting one onto the canvas has always worked, but nothing said so — a
   * gesture with no affordance is a feature only its author knows about. This
   * is the same path with a door on it.
   */
  const addLinkToBoard = useCallback((raw: string) => {
    const editor = apiRef.current;
    const url = raw.trim();
    if (!editor || !url) return;

    const doc = googleEmbed(url);
    const video = youTubeIdOf(url);
    if (!doc && !video) {
      setLinkError(
        'That link cannot be opened on the board. Use a Google Doc, Sheet, Slides, Form or Drive file, or a YouTube video.',
      );
      return;
    }

    // A document is read down, a video and a deck across — so they do not get
    // the same box.
    const [w, h] = video
      ? [560, 315]
      : doc!.kind === 'presentation'
        ? [640, 400]
        : doc!.kind === 'spreadsheet'
          ? [700, 440]
          : [560, 720];

    const state = editor.getAppState();
    const [x1, y1, x2, y2] = getVisibleSceneBounds(state);
    // convertToExcalidrawElements has no skeleton for embeddables, so the
    // element is built outright — the same shape pasting a link produces.
    const seed = () => Math.floor(Math.random() * 2 ** 31);
    const element = {
      id: crypto.randomUUID(),
      type: 'embeddable',
      x: (x1 + x2) / 2 - w / 2,
      y: (y1 + y2) / 2 - h / 2,
      width: w,
      height: h,
      angle: 0,
      strokeColor: 'transparent',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      strokeWidth: 1,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: seed(),
      version: 1,
      versionNonce: seed(),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: url,
      locked: false,
      customData: undefined,
      index: null,
    } as unknown as ExcalidrawElement;

    editor.updateScene({
      elements: [...editor.getSceneElementsIncludingDeleted(), element],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    editor.scrollToContent(element, { fitToContent: true, animate: false });
    setLinkOpen(false);
    setLinkSource('');
    setLinkError(null);
  }, []);

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
          const { url, file: uploaded } = await uploadBoardAsset(sessionId, image);
          // Same bytes the other clients will fetch, without fetching them back.
          const dataURL = await fileToDataURL(uploaded);
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
        // Frame the FIRST page, not the whole deck. Fitting every imported
        // page at once zooms the instructor out far enough that each page is a
        // thumbnail — and because followers fit whatever the presenter is
        // looking at, that shrinks the page on every student's screen too,
        // which is unreadable on a phone. Presenting starts at page one; the
        // instructor scrolls from there and students follow.
        editor.scrollToContent(added[0] ?? added, {
          fitToContent: true,
          viewportZoomFactor: 0.9,
          animate: false,
        });
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

  // Find the tool rail so the shapes button can be portalled into it. The rail
  // only exists once the editor has rendered in edit mode, and there is no
  // callback for that, so look on each frame until it appears.
  useEffect(() => {
    if (!api || !canEdit) {
      setRailNode(null);
      return;
    }
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // The row holding the shape tools — CSS `order` puts our button right
    // after the selection tool (see board-excalidraw.css).
    const sync = () => {
      const node = wrapper.querySelector<HTMLElement>(
        '.App-toolbar .Stack_horizontal',
      );
      // Re-point at the live node whenever the one we hold has been taken out
      // of the document. Excalidraw swaps the whole toolbar when it crosses its
      // mobile breakpoint, and the board is resized by anything that changes
      // the top bar — starting a recording, for one. The old code looked once,
      // stopped at the first hit, and kept portalling into whatever node it
      // found; when Excalidraw replaced that node the shapes button rendered
      // into a detached element and simply vanished, with no error and no way
      // back short of reloading the page.
      setRailNode((held) => (held?.isConnected ? held : (node ?? null)));
    };

    sync();
    // Cheaper and more reliable than polling every frame: react to the toolbar
    // actually changing.
    const mo = new MutationObserver(sync);
    mo.observe(wrapper, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [api, canEdit]);

  // Close the shapes flyout on a click anywhere else, or on Escape.
  useEffect(() => {
    if (!shapesOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest('[data-board-shapes]')) setShapesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShapesOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [shapesOpen]);

  /**
   * Double-click an equation to edit it.
   *
   * The quick path: an equation is a picture, so Excalidraw has nothing to open
   * on it and the gesture is otherwise wasted. Captured before Excalidraw sees
   * it, and only when the point is actually inside an equation — every other
   * double-click on the canvas is left alone.
   */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !canDraw) return;
    const onDoubleClick = (e: MouseEvent) => {
      const editor = apiRef.current;
      if (!editor) return;
      const rect = wrapper.getBoundingClientRect();
      const state = editor.getAppState();
      const z = state.zoom.value;
      const sx = (e.clientX - rect.left) / z - state.scrollX;
      const sy = (e.clientY - rect.top) / z - state.scrollY;
      const hit = mathElementAt(editor.getSceneElements(), sx, sy);
      if (!hit) return;
      const latex = (hit.customData as MathCustomData).livetichMath;
      e.preventDefault();
      e.stopPropagation();
      openMathEditor({
        id: hit.id,
        latex,
        x: hit.x,
        y: hit.y,
        height: hit.height,
        left: Math.round((hit.x + state.scrollX) * z),
        top: Math.round((hit.y + state.scrollY) * z),
      });
    };
    wrapper.addEventListener('dblclick', onDoubleClick, true);
    return () => wrapper.removeEventListener('dblclick', onDoubleClick, true);
  }, [canDraw, openMathEditor]);

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
  const recentEntries = mathRecent
    .map((latex) => MATH_ENTRIES.find((e) => e.latex === latex))
    .filter((e): e is MathEntry => !!e)
    .slice(0, 18);
  // Recent only earns a place once there is something in it.
  const mathTabs: (MathCategory | 'Recent')[] = recentEntries.length
    ? ['Recent', ...MATH_CATEGORIES]
    : MATH_CATEGORIES;
  const visibleMath =
    mathQuery.trim() !== ''
      ? searchMath(MATH_ENTRIES, mathQuery)
      : mathTab === 'Recent'
        ? recentEntries
        : MATH_ENTRIES.filter((e) => e.category === mathTab);
  const mathIssue = mathSource.trim() === '' ? null : mathError(mathSource);
  const mathPreview =
    mathSource.trim() === '' || mathIssue ? '' : renderMathHtml(mathSource);
  const current = activeShape
    ? (SHAPES.find((x) => x.key === activeShape) ?? null)
    : null;
  const previewEntry = preview
    ? SHAPES.find((x) => x.key === preview.key)
    : undefined;
  const previewShape =
    previewEntry && !('tool' in previewEntry) ? previewEntry : undefined;
  const armed =
    api?.getAppState().activeTool.type === 'rectangle' ||
    api?.getAppState().activeTool.type === 'diamond' ||
    api?.getAppState().activeTool.type === 'ellipse';

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
        // Excalidraw defaults to its "bold" width; a classroom board is mostly
        // handwriting, which reads better thinner.
        initialData={{ appState: { currentItemStrokeWidth: 1 } }}
        viewModeEnabled={!canEdit}
        isCollaborating
        theme="light"
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        onScrollChange={onScrollChange}
        // The library panel is an excalidraw.com feature (and its own brand
        // surface); a classroom board has no use for it.
        renderTopRightUI={() => null}
        // Excalidraw's own iframe cannot be controlled from outside it, so a
        // YouTube embed gets a player we own and can hold in step across the
        // room. Anything else keeps Excalidraw's rendering.
        renderEmbeddable={(element, appState) => {
          const videoId = youTubeIdOf(element.link);
          if (videoId) {
            return (
              <BoardVideoEmbed
                elementId={element.id}
                videoId={videoId}
                canControl={canDraw}
                state={videoState}
                onBroadcast={broadcastVideo}
              />
            );
          }
          // A Google link has to be rewritten to its read-only viewer before it
          // will frame at all, and it is rendered here rather than handed back
          // to Excalidraw so the element keeps the URL the instructor pasted.
          const doc = googleEmbed(element.link);
          if (doc) {
            return (
              <BoardDocEmbed
                embed={doc}
                link={element.link!}
                zoom={appState.zoom.value}
              />
            );
          }
          return null;
        }}
        // Excalidraw does not recognise youtu.be short links on its own, and
        // has no idea about Google files at all.
        validateEmbeddable={(link) =>
          youTubeIdOf(link) || googleEmbed(link) ? true : undefined
        }
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

      {/* One shapes control in the rail, standing in for Excalidraw's separate
          square/diamond/circle buttons (hidden in CSS) and carrying the extra
          shapes it has no tool for. Portalled into the rail so it sits in the
          stack instead of floating beside it. */}
      {railNode &&
        createPortal(
          <div data-board-shapes className="relative">
            <button
              type="button"
              title={current ? `${current.label} — click to change` : 'Shapes'}
              aria-haspopup="menu"
              aria-expanded={shapesOpen}
              ref={shapesTriggerRef}
              onClick={() => {
                const next = !shapesOpen;
                setShapesOpen(next);
                if (!next) return;
                const btn = shapesTriggerRef.current?.getBoundingClientRect();
                const board = wrapperRef.current?.getBoundingClientRect();
                if (!btn || !board) return;
                const W = 160;
                const H = 272;
                const GAP = 8;
                // Beside the rail when it fits, otherwise below — and never
                // past the edge of the board.
                const besideFits = btn.right + GAP + W <= board.right;
                const left = besideFits
                  ? btn.right + GAP - board.left
                  : Math.min(btn.left - board.left, board.width - W - GAP);
                const top = besideFits
                  ? Math.min(btn.top - board.top, board.height - H - GAP)
                  : btn.bottom + GAP - board.top;
                setShapesMenuAt({ top: Math.max(GAP, top), left: Math.max(GAP, left) });
              }}
              className={`relative grid h-9 w-9 place-items-center rounded-lg transition ${
                shapesOpen
                  ? 'bg-neutral-900 text-white'
                  : armed
                    ? 'bg-[#e0dfff] text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              {/* Before a choice: a group of shapes, so the button says what
                  is inside it. After one: that shape, at the same weight as
                  the tools either side — drawn lighter it read as a disabled
                  slot. */}
              <svg
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
                aria-hidden
              >
                {current ? (
                  <path d={current.icon} />
                ) : (
                  <>
                    <path d="M8 2.5 L12.5 9.5 L3.5 9.5 Z" />
                    <circle cx="17.5" cy="6" r="3.75" />
                    <rect x="4" y="13" width="11" height="8" rx="1" />
                  </>
                )}
              </svg>
              {/* This replaced three separate buttons, so it has to say out
                  loud that the other shapes are still in here. A 6px hairline
                  caret did not: it read as "the shapes are gone". */}
              <svg
                viewBox="0 0 10 10"
                className="absolute bottom-0 right-0 h-2.5 w-2.5"
                aria-hidden
              >
                <path d="M0 10 L10 10 L10 0 Z" className="fill-current opacity-30" />
                <path
                  d="M3.5 7.5 L8 7.5 L8 3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>,
          railNode,
        )}

      {/* Live preview of the armed polygon. Excalidraw is drawing a rectangle
          underneath at zero opacity — this is what the instructor actually
          sees follow the drag. */}
      {/* Edit, on the equation itself.
          Double-click does the same thing and is faster, but nothing on a
          board advertises a double-click — this is what tells the teacher the
          equation is still editable, and it rides along on pans and zooms
          because its position is recomputed with the selection. */}
      {selectedMath && canDraw && !mathOpen && (
        <button
          type="button"
          data-math-edit
          onClick={() => openMathEditor(selectedMath)}
          style={{
            left: selectedMath.left,
            top: Math.max(4, selectedMath.top - 34),
          }}
          className="pointer-events-auto absolute z-[401] inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-neutral-800"
        >
          <PiPencilSimpleBold className="h-3.5 w-3.5" />
          Edit
        </button>
      )}

      {preview && previewShape && (
        <svg
          data-shape-preview
          className="pointer-events-none absolute inset-0 z-[399] h-full w-full"
          aria-hidden
        >
          <polyline
            points={previewShape.points
              .map(
                ([px, py]) =>
                  `${preview.x + (px / SHAPE_SIZE) * preview.w},${
                    preview.y + (py / SHAPE_SIZE) * preview.h
                  }`,
              )
              .join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            className="text-neutral-500"
          />
        </svg>
      )}

      {/* Rendered against the board, not the toolbar, so neither the phone's
          scrolling tool row nor Excalidraw's own clipping can cut it off. */}
      {shapesOpen && shapesMenuAt && railNode && (
        <div
          data-board-shapes
          role="menu"
          style={{ top: shapesMenuAt.top, left: shapesMenuAt.left }}
          className="pointer-events-auto absolute z-[404] w-40 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-neutral-200"
        >
          {SHAPES.map((shape) => (
            <button
              key={shape.key}
              type="button"
              role="menuitem"
              onClick={() => addShape(shape.key)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                <path
                  d={shape.icon}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                />
              </svg>
              {shape.label}
            </button>
          ))}
        </div>
      )}

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
      {/* Phones only: Excalidraw's toolbar owns the full width of the top on a
          small screen, so the classroom controls move behind one button placed
          clear of it rather than overlapping it. */}
      {canDraw && (
        <button
          type="button"
          onClick={() => setToolsOpen((v) => !v)}
          aria-expanded={toolsOpen}
          aria-controls="board-classroom-tools"
          className={cn(
            // Left, not right: Excalidraw keeps its own vertical strip down the
            // right edge on a phone, and this sat on top of it. The inset lines
            // its left edge up with the toolbar island above it rather than
            // hugging the board's rounded corner, and the top leaves real space
            // under that toolbar instead of the 4px it had.
            'pointer-events-auto absolute left-6 top-20 z-[402] min-[730px]:hidden',
            'flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold shadow-md ring-1 transition',
            toolsOpen
              ? 'bg-neutral-900 text-white ring-neutral-900'
              : 'bg-white text-neutral-800 ring-neutral-200',
          )}
        >
          <PiSlidersHorizontalBold className="h-3.5 w-3.5" aria-hidden />
          Tools
          {/* The label alone gave no sign this opens anything. A caret that
              turns is the plainest way to say "there is more under here". */}
          <PiCaretDownBold
            className={cn(
              'h-3 w-3 transition-transform duration-200',
              toolsOpen && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      )}

      <div
        id="board-classroom-tools"
        className={cn(
          'pointer-events-none absolute z-[401] flex flex-wrap items-center gap-1.5',
          // Desktop: centred across the top, where the tool rail no longer is.
          'min-[730px]:left-1/2 min-[730px]:top-3 min-[730px]:max-w-[calc(100%-6rem)] min-[730px]:-translate-x-1/2 min-[730px]:justify-center',
          // Phone: a panel under the toolbar, opened from the Tools button.
          'max-[729px]:left-6 max-[729px]:w-[min(15rem,calc(100%-4.5rem))] max-[729px]:justify-start',
          // A viewer has no Tools button to open — their single follow pill
          // sits where that button would be, and is never collapsed.
          canDraw ? 'max-[729px]:top-32' : 'max-[729px]:top-20',
          canDraw && !toolsOpen && 'max-[729px]:hidden',
        )}
      >
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
              onClick={() => {
                setEditingMath(null);
                setMathSource('');
                setMathOpen((v) => !v);
              }}
              className={`pointer-events-auto ${pill} ${
                mathOpen
                  ? 'bg-neutral-900 text-white ring-neutral-900'
                  : 'bg-white text-neutral-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <PiFunctionBold />
                Math
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkError(null);
                setLinkOpen((v) => !v);
                setTimeout(() => linkInputRef.current?.focus(), 0);
              }}
              className={`pointer-events-auto ${pill} ${
                linkOpen
                  ? 'bg-neutral-900 text-white ring-neutral-900'
                  : 'bg-white text-neutral-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <PiLinkSimpleBold />
                Link
              </span>
            </button>
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

      {/* The formula being built comes first and stays visible: what it will
          look like, then what it is made of, then the tools. The palette used
          to sit above both, so the thing you were making was buried in the
          middle of the thing you were making it with. */}
      {linkOpen && canDraw && (
        <div className="pointer-events-auto absolute left-1/2 top-14 z-[403] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl bg-white p-3 shadow-xl ring-1 ring-neutral-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addLinkToBoard(linkSource);
            }}
          >
            <label
              htmlFor="board-link-input"
              className="block text-xs font-semibold text-neutral-700"
            >
              Paste a link
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="board-link-input"
                ref={linkInputRef}
                value={linkSource}
                onChange={(e) => {
                  setLinkSource(e.target.value);
                  setLinkError(null);
                }}
                placeholder="https://docs.google.com/document/d/…"
                className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-900/10"
              />
              <button
                type="submit"
                disabled={linkSource.trim() === ''}
                className={`${pill} shrink-0 bg-neutral-900 text-white ring-neutral-900 disabled:opacity-40`}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkOpen(false);
                  setLinkSource('');
                  setLinkError(null);
                }}
                className={`${pill} shrink-0 bg-white text-neutral-700`}
              >
                Cancel
              </button>
            </div>
            {linkError ? (
              <p className="mt-2 text-xs font-medium text-red-600">{linkError}</p>
            ) : (
              <p className="mt-2 text-xs text-neutral-500">
                Google Docs, Sheets, Slides, Forms and Drive files, or a YouTube
                video. Google files open read-only, and must be shared with
                &ldquo;anyone with the link&rdquo; for the class to see them.
              </p>
            )}
          </form>
        </div>
      )}

      {mathOpen && canDraw && (
        <div className="pointer-events-auto absolute left-1/2 top-14 z-[403] flex max-h-[calc(100%-5rem)] w-[min(41rem,calc(100%-2rem))] -translate-x-1/2 flex-col rounded-xl bg-white shadow-xl ring-1 ring-neutral-200">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
              {editingMath ? 'Edit formula' : 'Formula'}
            </p>
            <button
              type="button"
              onClick={closeMath}
              aria-label="Close"
              className="grid h-6 w-6 place-items-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <PiXBold className="h-3 w-3" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {/* Live preview — the answer to "what am I making", full width and
                first, so clicking a palette entry has a visible result. */}
            <div className="mt-3 grid min-h-[4.5rem] place-items-center overflow-x-auto rounded-lg bg-neutral-50 px-3 py-3 text-neutral-900">
              {mathSource.trim() === '' ? (
                <p className="text-xs text-neutral-400">
                  Pick an equation or a symbol below — it appears here as you build it.
                </p>
              ) : mathIssue ? (
                <p className="text-center text-xs font-semibold text-red-600">
                  {mathIssue}
                </p>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: mathPreview }} />
              )}
            </div>

            <label htmlFor="board-math-input" className="sr-only">
              Formula source
            </label>
            <textarea
              id="board-math-input"
              ref={mathInputRef}
              value={mathSource}
              onChange={(e) => setMathSource(e.target.value)}
              rows={2}
              spellCheck={false}
              placeholder="Pick from below, or type LaTeX directly"
              className="mt-2 w-full resize-y rounded-lg border border-neutral-300 px-2.5 py-1.5 font-mono text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />

            <input
              type="search"
              value={mathQuery}
              onChange={(e) => setMathQuery(e.target.value)}
              placeholder="Search — integral, orthogonal, quadratic…"
              aria-label="Search math symbols"
              className="mt-2 w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-500"
            />

            {/* Categories run down the side rather than wrapping across the
                top: eleven of them wrapped to two cramped rows, and the grid
                they controlled was clipped mid-glyph. */}
            <div className="mt-2 flex min-h-[13rem] gap-2">
              {/* The category column sizes to its contents and scrolls with
                  the panel body. An independent scroller here cut the last
                  category in half, which reads as broken rather than
                  scrollable. */}
              {mathQuery.trim() === '' && (
                <div className="w-28 shrink-0 space-y-0.5">
                  {mathTabs.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMathTab(cat)}
                      className={cn(
                        'block w-full rounded-lg px-2 py-1 text-left text-[11px] font-semibold transition',
                        mathTab === cat
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-600 hover:bg-neutral-100',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div
                className={cn(
                  'flex min-w-0 flex-1 gap-1 overflow-y-auto rounded-lg bg-neutral-50/60 p-1.5',
                  mathTab === 'Equations' && mathQuery.trim() === ''
                    ? 'flex-col'
                    : 'flex-wrap content-start',
                )}
              >
                {visibleMath.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-neutral-400">
                    Nothing matches “{mathQuery.trim()}”.
                  </p>
                ) : (
                  visibleMath.map((e) => (
                    <MathButton key={e.latex} entry={e} onPick={pickMath} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-3 py-2">
            <p className="truncate text-[11px] text-neutral-400">
              {mathSource.trim() === ''
                ? 'Nothing to add yet'
                : mathIssue
                  ? 'Fix the formula to add it'
                  : editingMath
                    ? 'Replace it, or add the next line underneath'
                    : 'Lands in the middle of your view'}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={closeMath}
                className={`${pill} bg-white text-neutral-700`}
              >
                Cancel
              </button>
              {editingMath && (
                <button
                  type="button"
                  onClick={() => void replaceMathOnBoard()}
                  disabled={mathBusy || !!mathIssue || mathSource.trim() === ''}
                  className={`${pill} bg-white text-neutral-800 disabled:opacity-40`}
                >
                  {mathBusy ? 'Working…' : 'Replace'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void addMathToBoard()}
                disabled={mathBusy || !!mathIssue || mathSource.trim() === ''}
                className={`${pill} bg-neutral-900 text-white ring-neutral-900 disabled:opacity-40`}
              >
                {mathBusy
                  ? 'Adding…'
                  : editingMath
                    ? 'Add as a new line'
                    : 'Add to board'}
              </button>
            </div>
          </div>
        </div>
      )}

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
