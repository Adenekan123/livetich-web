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
  PiBookOpenTextBold,
  PiArrowsInBold,
  PiArrowsOutBold,
  PiCheckBold,
  PiCrosshairBold,
  PiDownloadSimpleBold,
  PiCaretDownBold,
  PiFilesBold,
  PiFunctionBold,
  PiImageBold,
  PiPlusBold,
  PiXBold,
  PiLockBold,
  PiLinkSimpleBold,
  PiLockOpenBold,
  PiMathOperationsBold,
  PiPencilSimpleBold,
  PiSelectionAllBold,
  PiSlidersHorizontalBold,
  PiTrashBold,
  PiUploadSimpleBold,
} from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { cn, inputClass } from '@/lib/ui';
import { getRealtimeToken, clearRealtimeToken } from '@/lib/client-token';
import type {
  BoardClientToServerEvents,
  BoardServerToClientEvents,
} from '@/lib/realtime-contract';
import { BoardDocEmbed } from './board-doc-embed';
import {
  BoardQuranBlock,
  parseQuranBlock,
  QURAN_BLOCK_MAX_AYAHS,
  quranBlockLink,
} from './board-quran-block';
import type { TajweedApi } from './use-tajweed';
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

type InsertStudioTab = 'math' | 'quran' | 'docs' | 'files';

const MATH_PRESETS = [
  { label: 'Quadratic', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { label: 'Integral', latex: '\\int_{a}^{b} f(x) \\, dx' },
  { label: 'Summation', latex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
  { label: 'Euler Identity', latex: 'e^{i\\pi} + 1 = 0' },
  { label: 'Maxwell', latex: '\\nabla \\times \\mathbf{B} = \\mu_0\\mathbf{J}' },
  { label: '2×2 Matrix', latex: 'A = \\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}' },
];

const SURAH_SNIPPETS: Record<string, string> = {
  '1': 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
  '2': 'الم ۝ ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ',
  '3': 'الم ۝ ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ',
  '18': 'ٱلْحَمْدُ لِلَّهِ ٱلَّذِىٓ أَنزَلَ عَلَىٰ عَبْدِهِ ٱلْكِتَـٰبَ',
  '36': 'يسٓ ۝ وَٱلْقُرْءَانِ ٱلْحَكِيمِ',
  '55': 'ٱلرَّحْمَـٰنُ ۝ عَلَّمَ ٱلْقُرْءَانَ',
  '67': 'تَبَـٰرَكَ ٱلَّذِى بِيَدِهِ ٱلْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَىْءٍ قَدِيرٌ',
  '112': 'قُلْ هُوَ ٱللَّهُ أَحَدٌ ۝ ٱللَّهُ ٱلصَّمَدُ',
  '113': 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ',
  '114': 'قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ',
};

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

/**
 * What an imported page carries on its element, so the pages of one import can
 * be found again — for "select all" and for deleting them — long after the
 * import itself has finished. It rides in customData, so it syncs with the page.
 */
interface ImportCustomData {
  livetichImport?: { id: string; name: string; page: number; pages: number };
}

/** The imported pages in the current selection, and where to put their actions. */
interface SelectedImport {
  id: string;
  name: string;
  /** The selected pages of this import. */
  selectedIds: string[];
  /** Every page of this import still on the board. */
  allIds: string[];
  /** The page number when exactly one page is selected, otherwise null. */
  page: number | null;
  /** Viewport pixels, relative to the board wrapper: the selection's top-left. */
  left: number;
  top: number;
}

/**
 * The imported pages in the selection, or null.
 *
 * Only when the selection is nothing but pages of one import: a page selected
 * together with a drawing is not "these pages", and delete must never take
 * something the teacher did not point at.
 */
function selectedImportOf(
  elements: readonly ExcalidrawElement[],
  selectedIds: Readonly<Record<string, boolean>>,
  view: { scrollX: number; scrollY: number; zoom: number },
): SelectedImport | null {
  let meta: NonNullable<ImportCustomData['livetichImport']> | null = null;
  const picked: ExcalidrawElement[] = [];
  for (const el of elements) {
    if (el.isDeleted || !selectedIds[el.id]) continue;
    const m = (el.customData as ImportCustomData | undefined)?.livetichImport;
    if (!m) return null; // something that is not an imported page
    if (meta && meta.id !== m.id) return null; // pages of two different imports
    meta = m;
    picked.push(el);
  }
  if (!meta) return null;
  const id = meta.id;
  const allIds = elements
    .filter(
      (el) =>
        !el.isDeleted &&
        (el.customData as ImportCustomData | undefined)?.livetichImport?.id === id,
    )
    .map((el) => el.id);
  const minX = Math.min(...picked.map((el) => el.x));
  const minY = Math.min(...picked.map((el) => el.y));
  return {
    id,
    name: meta.name,
    selectedIds: picked.map((el) => el.id),
    allIds,
    page:
      picked.length === 1
        ? ((picked[0].customData as ImportCustomData).livetichImport?.page ?? null)
        : null,
    left: Math.round((minX + view.scrollX) * view.zoom),
    top: Math.round((minY + view.scrollY) * view.zoom),
  };
}

/** Freehand drawing changes elements many times per second. Coalescing those
 *  mutations keeps the shared-board transport responsive on modest devices. */
const SYNC_INTERVAL_MS = 50;
/** The presenter's camera is broadcast less often than strokes — it only needs
 *  to feel attached, not be frame-accurate. */
const PRESENTER_INTERVAL_MS = 100;
/** Clearance the tool rail keeps above it (the menu button — matches `top` on
 *  .shapes-section in board-excalidraw.css) and below it (the zoom bar). */
const RAIL_TOP_REM = 3.5;
const RAIL_BOTTOM_REM = 4.5;
/** The least of the presenter's own screen-share the writing may take up on a
 *  follower's screen before mirroring is abandoned for framing the writing
 *  itself. Half means "at worst, half as prominent as they see it". */
const MIRROR_FLOOR = 0.5;
/** Hydration retries per file, and the base of their exponential backoff. */
const MAX_FILE_RETRIES = 3;
const FILE_RETRY_BASE_MS = 500;
/**
 * How long a viewer keeps their own view after moving it.
 *
 * Long enough to read the thing they went to look at; short enough that the
 * instructor's next move brings them back. Only a viewer who is still moving
 * the board is treated as navigating — stillness means they are done.
 */
const REFOLLOW_GRACE_MS = 6000;

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
/**
 * Put an embeddable on the board, centred in view and framed.
 *
 * convertToExcalidrawElements has no skeleton for embeddables, so the element
 * is built outright — the same shape pasting a link produces.
 */
function putEmbeddable(editor: ExcalidrawImperativeAPI, link: string, w: number, h: number) {
  const state = editor.getAppState();
  const [x1, y1, x2, y2] = getVisibleSceneBounds(state);
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
    link,
    locked: false,
    customData: undefined,
    index: null,
  } as unknown as ExcalidrawElement;

  editor.updateScene({
    elements: [...editor.getSceneElementsIncludingDeleted(), element],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  editor.scrollToContent(element, { fitToContent: true, animate: false });
}

export function BoardExcalidraw({
  sessionId,
  canDraw,
  teaching = false,
  quran = null,
  maths = false,
}: {
  sessionId: string;
  canDraw: boolean;
  /** This user is an org admin presenting in teach-mode — tells the board
   *  gateway to authorize them as the writer (mirrors the room join). */
  teaching?: boolean;
  /** Islamic Education pack on: Qur'an blocks can be put on the board, and
   *  draw the class's Tajweed marks. Null = no Qur'an blocks. */
  quran?: { tajweed: TajweedApi | null } | null;
  /** Maths & Sciences pack on: the formula tool is available. Off, the button,
   *  the panel and both ways into the editor are simply not there — and since
   *  KaTeX renders in this browser with no route behind it, not rendering them
   *  is the whole gate. Equations already on a board stay visible either way:
   *  they are images, and a pack going away must not blank a lesson. */
  maths?: boolean;
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
  /** When this viewer last moved the board themselves. A student who nudged the
   *  wheel is not navigating; a student still moving is. */
  const lastSelfMoveRef = useRef(0);
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
  // What the import overlay shows. Null when nothing is importing.
  const [importProgress, setImportProgress] = useState<{
    title: string;
    /** What is happening now, in words: "Reading page 3 of 12". */
    stage: string;
    /** 0–100, or null while the size is not known yet. */
    percent: number | null;
  } | null>(null);
  const importing = importProgress !== null;
  const [exporting, setExporting] = useState(false);
  /** Which page is being rendered, so a slow export says what it is doing
   *  rather than leaving the instructor looking at a dead button. */
  const [exportPage, setExportPage] = useState<{ page: number; of: number } | null>(null);
  const [shapesOpen, setShapesOpen] = useState(false);
  /** Clearing wipes the board for the whole class and cannot be undone by
   *  anyone else, so it asks first. */
  const [clearOpen, setClearOpen] = useState(false);
  const clearTriggerRef = useRef<HTMLButtonElement>(null);
  /** Where to draw the confirm, in board coordinates — for the same reason the
   *  shapes menu is measured: the tool row scrolls on a phone, and a panel
   *  inside a scrolling container is clipped by it. */
  const [clearMenuAt, setClearMenuAt] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [quranOpen, setQuranOpen] = useState(false);
  const [quranForm, setQuranForm] = useState({ surah: '1', from: '1', to: '7' });
  const [quranError, setQuranError] = useState<string | null>(null);
  const [linkSource, setLinkSource] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const importFilesRef = useRef<
    ((list: readonly File[]) => Promise<void>) | null
  >(null);
  const [mathOpen, setMathOpen] = useState(false);
  const [mathSource, setMathSource] = useState('');
  const [mathBusy, setMathBusy] = useState(false);
  /** On a phone the classroom controls collapse behind one button: Excalidraw
   *  gives its own toolbar the full width of the top, and the pills sat on top
   *  of it. */
  const [toolsOpen, setToolsOpen] = useState(false);
  const [insertStudioOpen, setInsertStudioOpen] = useState(false);
  const [insertStudioTab, setInsertStudioTab] = useState<InsertStudioTab>('math');
  const [collabSheetOpen, setCollabSheetOpen] = useState(false);
  const [activeToolState, setActiveToolState] = useState<
    'select' | 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'text' | 'laser'
  >('pen');
  const [activeColor, setActiveColor] = useState('#10b981');
  const [activeWeight, setActiveWeight] = useState(4);
  const [propertiesPopoverOpen, setPropertiesPopoverOpen] = useState(false);
  const [boardTitle, setBoardTitle] = useState('System Architecture');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(3);

  const openInsertStudio = useCallback((tab?: InsertStudioTab) => {
    if (tab) setInsertStudioTab(tab);
    setInsertStudioOpen(true);
    setCollabSheetOpen(false);
    setPropertiesPopoverOpen(false);
  }, []);

  const closeInsertStudio = useCallback(() => {
    setInsertStudioOpen(false);
    setEditingMath(null);
    setLinkError(null);
    setQuranError(null);
  }, []);

  const selectTool = useCallback(
    (tool: 'select' | 'pen' | 'highlighter' | 'eraser' | 'rectangle' | 'text' | 'laser') => {
      setActiveToolState(tool);
      const editor = apiRef.current;
      if (!editor) return;
      if (tool === 'select') {
        editor.setActiveTool({ type: 'selection' });
      } else if (tool === 'pen') {
        editor.setActiveTool({ type: 'freedraw', locked: true });
        editor.updateScene({
          appState: {
            currentItemOpacity: 100,
            currentItemStrokeWidth: activeWeight,
            currentItemStrokeColor: activeColor,
          },
        });
      } else if (tool === 'highlighter') {
        editor.setActiveTool({ type: 'freedraw', locked: true });
        editor.updateScene({
          appState: {
            currentItemOpacity: 35,
            currentItemStrokeWidth: activeWeight * 3,
            currentItemStrokeColor: activeColor,
          },
        });
      } else if (tool === 'eraser') {
        editor.setActiveTool({ type: 'eraser', locked: true });
      } else if (tool === 'rectangle') {
        editor.setActiveTool({ type: 'rectangle', locked: true });
        editor.updateScene({
          appState: {
            currentItemStrokeColor: activeColor,
            currentItemStrokeWidth: activeWeight,
            currentItemBackgroundColor: 'transparent',
            currentItemFillStyle: 'solid',
          },
        });
      } else if (tool === 'text') {
        editor.setActiveTool({ type: 'text', locked: true });
        editor.updateScene({
          appState: {
            currentItemStrokeColor: activeColor,
          },
        });
      } else if (tool === 'laser') {
        editor.setActiveTool({ type: 'laser', locked: true });
      }
      setPropertiesPopoverOpen(false);
    },
    [activeWeight, activeColor],
  );

  const setStrokeColor = useCallback(
    (color: string) => {
      setActiveColor(color);
      const editor = apiRef.current;
      if (!editor) return;
      const elements = editor.getSceneElements();
      const appState = editor.getAppState();
      const selectedIds = appState.selectedElementIds;
      if (selectedIds && Object.keys(selectedIds).some((id) => selectedIds[id])) {
        const next = elements.map((el) =>
          selectedIds[el.id] ? { ...el, strokeColor: color, version: el.version + 1 } : el,
        );
        editor.updateScene({ elements: next, appState: { currentItemStrokeColor: color } });
      } else {
        editor.updateScene({ appState: { currentItemStrokeColor: color } });
      }
      if (activeToolState === 'eraser') selectTool('pen');
    },
    [activeToolState, selectTool],
  );

  const setStrokeWeight = useCallback((weight: number) => {
    setActiveWeight(weight);
    const editor = apiRef.current;
    if (!editor) return;
    const elements = editor.getSceneElements();
    const appState = editor.getAppState();
    const selectedIds = appState.selectedElementIds;
    if (selectedIds && Object.keys(selectedIds).some((id) => selectedIds[id])) {
      const next = elements.map((el) =>
        selectedIds[el.id] ? { ...el, strokeWidth: weight, version: el.version + 1 } : el,
      );
      editor.updateScene({ elements: next, appState: { currentItemStrokeWidth: weight } });
    } else {
      editor.updateScene({ appState: { currentItemStrokeWidth: weight } });
    }
  }, []);

  const handleUndo = useCallback(() => {
    const btn = wrapperRef.current?.querySelector<HTMLButtonElement>(
      '[data-testid="undo"], [aria-label*="Undo"], .undo-button-container button:first-child',
    );
    if (btn) btn.click();
    else {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true }),
      );
    }
  }, []);

  const handleRedo = useCallback(() => {
    const btn = wrapperRef.current?.querySelector<HTMLButtonElement>(
      '[data-testid="redo"], [aria-label*="Redo"], .undo-button-container button:last-child',
    );
    if (btn) btn.click();
    else {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'y', code: 'KeyY', ctrlKey: true, bubbles: true }),
      );
    }
  }, []);

  const [boardMsg, setBoardMsg] = useState<string | null>(null);

  const flash = useCallback((m: string) => {
    setBoardMsg(m);
    window.setTimeout(() => setBoardMsg(null), 2600);
  }, []);

  const prevPage = useCallback(() => setCurrentPage((p) => Math.max(1, p - 1)), []);
  const nextPage = useCallback(
    () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
    [totalPages],
  );
  const addPage = useCallback(() => {
    setTotalPages((t) => {
      const next = t + 1;
      setCurrentPage(next);
      return next;
    });
    flash('Added page');
  }, [flash]);
  /** The instructor's playback position for a shared video. Ephemeral, so it
   *  rides awareness alongside the cursors rather than the persisted doc. */
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  /** The single selected equation, when exactly one is selected. An equation
   *  is a picture of its LaTeX, so without this its source is unreachable and
   *  the only way to change a value is to retype the whole formula. */
  const [selectedMath, setSelectedMath] = useState<SelectedMath | null>(null);
  const selectedMathRef = useRef<SelectedMath | null>(null);
  const [selectedImport, setSelectedImport] = useState<SelectedImport | null>(null);
  const selectedImportRef = useRef<SelectedImport | null>(null);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = canDraw || (ready && boardOpen);

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

    const { x, y, w, h } = bounds;

    /** Fit one scene rectangle to this viewport. Both candidates below go
     *  through it, so each carries a camera that frames the rectangle it was
     *  measured from — zoom and position always describing the same region. */
    const fit = (rect: { x: number; y: number; w: number; h: number }) =>
      zoomToFitBounds({
        bounds: [
          rect.x,
          rect.y,
          rect.x + rect.w,
          rect.y + rect.h,
        ] as SceneBounds,
        appState,
        fitToViewport: true,
        viewportZoomFactor: 0.95,
        // Guard rails so a degenerate region can't leave a follower at 4000%
        // or at a zoom too small to read on a phone.
        minZoom: 0.1,
        maxZoom: 4,
      }).appState;

    // Candidate 1: their whole visible rectangle. On a screen the same shape
    // as theirs this reproduces their framing, which is what following is
    // supposed to mean.
    const mirror = fit(bounds);

    // Candidate 2: the part of their view that actually has something in it.
    // A viewport that is mostly empty margin around the writing scales that
    // emptiness along with it, so where mirroring wastes the screen this
    // frames the writing alone instead.
    let content: typeof mirror | null = null;
    let region: { w: number; h: number } | null = null;
    const elements = editor.getSceneElements();
    if (elements.length) {
      const [cx0, cy0, cx1, cy1] = getCommonBounds(elements);
      const ix0 = Math.max(x, cx0);
      const iy0 = Math.max(y, cy0);
      const ix1 = Math.min(x + w, cx1);
      const iy1 = Math.min(y + h, cy1);
      if (ix1 - ix0 > 1 && iy1 - iy0 > 1) {
        region = { w: ix1 - ix0, h: iy1 - iy0 };
        content = fit({ x: ix0, y: iy0, w: region.w, h: region.h });
      }
    }

    // Mirror them unless mirroring would not actually reproduce what they see.
    //
    // Zooming to the content on *every* screen is what cut the board up. The
    // content region is smaller than their viewport almost whenever they are
    // writing in a corner, so a desktop follower was magnified ~2.8x past the
    // instructor; and because the old code took the zoom from that region but
    // the centre from the unclipped one, it then pointed that magnified view
    // at the middle of their viewport rather than at the writing. Anything the
    // instructor did not happen to write dead centre fell off the screen —
    // measured at 2% of the strokes still visible, 0% once they panned.
    //
    // So the test is not "is my screen smaller than theirs", which is one-way
    // and says nothing when the *instructor* is the one on a phone. It is:
    // does the writing end up taking about as much of my screen as it does of
    // theirs? Both shares are computable from the packet alone — their
    // viewport and the region are both scene rectangles, so their share is
    // just the ratio of the two areas, no pixel sizes needed.
    //
    // That catches the case a zoom comparison misses. Fitting a portrait phone
    // viewport onto a landscape laptop matches on height and leaves the width
    // as empty board: the writing is still legible, at ~105% of the size the
    // instructor sees, but it falls from a third of their screen to a
    // twelfth of the follower's. Framing the region is the better answer
    // there, and on identical screens the two shares agree and we mirror.
    //
    // The region cancels out of that comparison — it reduces to the two
    // viewports and the mirror zoom — so which branch we take cannot change
    // while somebody is drawing. It moves only when a viewport or a zoom does,
    // which is what keeps the choice from flickering mid-stroke.
    const theirShare = region ? (region.w * region.h) / (w * h) : 0;
    const ourShare =
      region && appState.width && appState.height
        ? (region.w * mirror.zoom.value * region.h * mirror.zoom.value) /
          (appState.width * appState.height)
        : 0;
    const mirrorWastesTheScreen =
      content !== null && ourShare < theirShare * MIRROR_FLOOR;
    const view = mirrorWastesTheScreen && content ? content : mirror;

    lastAppliedViewRef.current = {
      scrollX: view.scrollX,
      scrollY: view.scrollY,
      zoom: view.zoom.value,
    };
    editor.updateScene({
      appState: {
        scrollX: view.scrollX,
        scrollY: view.scrollY,
        zoom: view.zoom,
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
      if (followingRef.current) {
        applyPresenterView();
      } else if (Date.now() - lastSelfMoveRef.current > REFOLLOW_GRACE_MS) {
        // Rejoin the lesson. Scrolling used to detach a viewer for good, so one
        // nudge of a wheel left a student stranded while the class moved on —
        // and the only way back was noticing a small pill. The instructor
        // moving is the signal that the lesson has gone somewhere new, so
        // anyone who has stopped navigating comes along.
        setFollowing(true);
        applyPresenterView();
      }
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

      // Same for imported pages: which ones are selected, and where their
      // actions go. Keyed on everything the bar shows, and nothing more.
      const pages = selectedImportOf(scene, state.selectedElementIds, {
        scrollX: state.scrollX,
        scrollY: state.scrollY,
        zoom: state.zoom.value,
      });
      const had = selectedImportRef.current;
      if (
        pages?.id !== had?.id ||
        pages?.selectedIds.join() !== had?.selectedIds.join() ||
        pages?.allIds.length !== had?.allIds.length ||
        pages?.page !== had?.page ||
        pages?.left !== had?.left ||
        pages?.top !== had?.top
      ) {
        selectedImportRef.current = pages;
        setSelectedImport(pages);
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
      const applied = lastAppliedViewRef.current;
      // Nothing to have drifted from yet. Until the instructor's first camera
      // arrives, every scroll here is Excalidraw moving itself — mounting the
      // canvas, fitting the scene, a container resize — and counting that as
      // the viewer opting out unfollowed every student a second after they
      // opened the board, before the instructor had done anything at all.
      if (applied === null) return;
      // Excalidraw normalises the zoom it actually applies, so compare with a
      // tolerance — still an order of magnitude tighter than any real gesture,
      // where one wheel step is ~10%.
      const isOurs =
        Math.abs(applied.scrollX - scrollX) < 0.5 &&
        Math.abs(applied.scrollY - scrollY) < 0.5 &&
        Math.abs(applied.zoom - zoom.value) < 0.01;
      if (!isOurs) {
        lastSelfMoveRef.current = Date.now();
        setFollowing(false);
      }
    },
    [canDraw, emitPresenter],
  );

  // ---- Board controls ------------------------------------------------------
  /** Select every page of one import, so it moves or goes as one. */
  const selectImportPages = useCallback((ids: string[]) => {
    const editor = apiRef.current;
    if (!editor || !ids.length) return;
    editor.updateScene({
      appState: {
        selectedElementIds: Object.fromEntries(ids.map((id) => [id, true])) as Record<
          string,
          true
        >,
        selectedGroupIds: {},
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, []);

  /**
   * Delete imported pages.
   *
   * The version bump is what carries it to the class: local edits are diffed by
   * version, so an element marked deleted at the same version would stay on
   * every other screen. Recorded as one undo step, so Undo brings the pages
   * back if the wrong ones went.
   */
  const deleteImportPages = useCallback(
    (ids: string[]) => {
      const editor = apiRef.current;
      if (!editor || !ids.length) return;
      const doomed = new Set(ids);
      editor.updateScene({
        elements: editor.getSceneElementsIncludingDeleted().map((el) =>
          doomed.has(el.id)
            ? {
                ...el,
                isDeleted: true,
                version: el.version + 1,
                versionNonce: Math.floor(Math.random() * 2 ** 31),
                updated: Date.now(),
              }
            : el,
        ),
        appState: { selectedElementIds: {} },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      flash(
        ids.length === 1
          ? 'Page deleted. Undo brings it back.'
          : `${ids.length} pages deleted. Undo brings them back.`,
      );
    },
    [flash],
  );

  const toggleBoardOpen = useCallback(() => {
    const open = !boardOpen;
    setBoardOpen(open);
    socketRef.current?.emit('board:writable', { sessionId, open });
  }, [boardOpen, sessionId]);

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
    setInsertStudioTab('math');
    setInsertStudioOpen(true);
  }, []);

  /** Close the formula panel and forget what it was working on. */
  const closeMath = useCallback(() => {
    closeInsertStudio();
    setMathSource('');
    setEditingMath(null);
  }, [closeInsertStudio]);

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

    putEmbeddable(editor, url, w, h);
    closeInsertStudio();
    setLinkSource('');
    setLinkError(null);
  }, [closeInsertStudio]);

  /**
   * Put a block of ayahs on the board. It travels like any embeddable; what it
   * draws on the text comes from the mushaf's Tajweed marks as they are made.
   */
  const addQuranBlock = useCallback(() => {
    const editor = apiRef.current;
    if (!editor) return;
    const link = quranBlockLink(
      Number(quranForm.surah),
      Number(quranForm.from),
      Number(quranForm.to),
    );
    if (!parseQuranBlock(link)) {
      setQuranError(
        `Choose a surah from 1 to 114 and a range of up to ${QURAN_BLOCK_MAX_AYAHS} ayahs.`,
      );
      return;
    }
    putEmbeddable(editor, link, 640, 360);
    closeInsertStudio();
    setQuranError(null);
  }, [quranForm, closeInsertStudio]);

  /**
   * Put a Google file on the board as pages.
   *
   * The embed is live but sealed: it cannot be scrolled in step for the class,
   * and cannot be drawn on. Pages can — they are ordinary board content, so the
   * follow mechanism already carries them and the instructor can write over
   * them. The trade is that they are a snapshot: later edits in Google do not
   * appear until it is imported again.
   *
   * The PDF is fetched by the API, because Google sends no CORS headers and the
   * browser is refused before it starts.
   */
  const importGoogleAsPages = useCallback(
    async (raw: string) => {
      const url = raw.trim();
      if (!url) return;
      // Google gives no size up front, so this stretch is indeterminate; the
      // importer takes over with real numbers once the PDF is here.
      setImportProgress({ title: 'Google file', stage: 'Fetching from Google…', percent: null });
      try {
        const token = await getRealtimeToken();
        const res = await fetch(
          `${API_URL}/sessions/${sessionId}/board-google-import`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token ?? ''}`,
            },
            body: JSON.stringify({ url }),
          },
        );
        if (!res.ok) {
          const detail = await res
            .json()
            .then((b: { message?: string }) => b?.message)
            .catch(() => null);
          setLinkError(detail ?? 'That file could not be imported.');
          return;
        }
        const blob = await res.blob();
        // The name is what the overlay titles the import with.
        const file = new File([blob], 'Google file.pdf', { type: 'application/pdf' });
        closeInsertStudio();
        setLinkSource('');
        setLinkError(null);
        await importFilesRef.current?.([file]);
      } catch {
        setLinkError('That file could not be imported.');
      } finally {
        setImportProgress(null);
      }
    },
    [sessionId],
  );

  const importFiles = useCallback(
    async (list: readonly File[] | FileList | null) => {
      const editor = apiRef.current;
      const map = filesRef.current;
      const doc = docRef.current;
      if (!editor || !map || !doc || !list?.length) return;
      const files = Array.from(list as ArrayLike<File>);
      const title = files.length === 1 ? files[0].name : `${files.length} files`;
      // Reading PDF pages is the first half of the bar and putting them on the
      // board the second; a batch of plain images only has the second.
      const hasPdf = files.some((f) => f.type === 'application/pdf');
      setImportProgress({ title, stage: 'Opening…', percent: null });
      try {
        const images: File[] = [];
        for (const file of files) {
          if (file.type === 'application/pdf') {
            const pages = await pdfToImageFiles(file, (done, count) =>
              setImportProgress({
                title,
                stage: `Reading page ${Math.min(done + 1, count)} of ${count}`,
                percent: Math.round((done / count) * 50),
              }),
            );
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
        const base = hasPdf ? 50 : 0;
        // One id for the whole import, so its pages can be selected or deleted
        // together later.
        const importId = crypto.randomUUID();
        for (const [i, image] of images.entries()) {
          setImportProgress({
            title,
            stage:
              images.length === 1
                ? 'Adding to the board'
                : `Adding ${i + 1} of ${images.length} to the board`,
            percent: base + Math.round((i / images.length) * (100 - base)),
          });
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
          const livetichImport = {
            id: importId,
            name: title,
            page: i + 1,
            pages: images.length,
          };
          added.push(
            ...convertToExcalidrawElements([
              { type: 'image', x: 0, y, width, height, fileId: fileId as FileId },
            ]).map((el) => ({
              ...el,
              customData: { livetichImport } satisfies ImportCustomData,
            })),
          );
          y += height + 24;
        }
        setImportProgress({ title, stage: 'Finishing up', percent: 100 });
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
        setImportProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [sessionId, flash],
  );

  // importGoogleAsPages is declared above importFiles, so it reaches the
  // importer through a ref rather than forcing a reorder of the file.
  importFilesRef.current = importFiles;

  /**
   * Take everything off the board — drawings, imported pages, embeds, the lot.
   *
   * Elements are marked deleted and re-versioned rather than dropped from the
   * array: that is what the local diff writes into the shared doc, and it is
   * how the removal reaches every student. Filtering the list instead would
   * clear the instructor's screen and leave the class looking at the old board.
   */
  const clearBoard = useCallback(() => {
    const editor = apiRef.current;
    if (!editor) return;
    const nonce = () => Math.floor(Math.random() * 2 ** 31);
    const cleared = editor.getSceneElementsIncludingDeleted().map((el) =>
      el.isDeleted
        ? el
        : { ...el, isDeleted: true, version: el.version + 1, versionNonce: nonce() },
    );
    editor.updateScene({
      elements: cleared,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    setClearOpen(false);
  }, []);

  /**
   * The board as a PDF, one page at a time.
   *
   * The board is a canvas, not a document: it has no pages, and whatever was
   * drawn sits wherever it was drawn. Rendering the lot to one image and
   * slicing it into page-sized strips is what saws a diagram in half, so the
   * pages are worked out from the elements instead — anything that overlaps
   * vertically travels together, and a break can then only ever land in the
   * blank space between things.
   */
  const exportPdf = useCallback(async () => {
    const editor = apiRef.current;
    if (!editor) return;
    const scene = editor.getSceneElements().filter((el) => !el.isDeleted);
    if (!scene.length) {
      flash('Nothing on the board to export yet.');
      return;
    }

    setExporting(true);
    setExportPage(null);
    try {
      const { jsPDF } = await import('jspdf');

      // A4 landscape: a board is wider than it is tall, and so is a classroom
      // screen. Margins in points, which is what jsPDF measures in.
      const margin = 24;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth() - margin * 2;
      const pageH = doc.internal.pageSize.getHeight() - margin * 2;

      // Each element with its own box, top to bottom.
      const boxed = scene
        .map((el) => {
          const [x1, y1, x2, y2] = getCommonBounds([el]);
          return { el, top: y1, bottom: y2, left: x1, right: x2 };
        })
        .sort((a, b) => a.top - b.top || a.left - b.left);

      // Bands: elements that overlap vertically cannot be separated without
      // cutting one of them, so they belong to the same page.
      const bands: { top: number; bottom: number; els: typeof scene }[] = [];
      for (const item of boxed) {
        const band = bands[bands.length - 1];
        if (band && item.top <= band.bottom) {
          band.bottom = Math.max(band.bottom, item.bottom);
          band.els.push(item.el);
        } else {
          bands.push({ top: item.top, bottom: item.bottom, els: [item.el] });
        }
      }

      // The whole board's width decides the scale, so every page is rendered at
      // the same size and the drawing does not grow and shrink page to page.
      const [boardLeft, , boardRight] = getCommonBounds(scene);
      const boardW = Math.max(1, boardRight - boardLeft);
      const scale = pageW / boardW;
      const pageBoardH = pageH / scale;

      // Bands into pages, while they fit. A band taller than a page is a page
      // of its own and is scaled down to fit — never cut.
      const pages: (typeof scene)[] = [];
      let current: typeof scene = [];
      let currentTop = 0;
      for (const band of bands) {
        // Taller than a page on its own: it gets a page to itself and is
        // scaled down to fit. Whatever had gathered above it goes first, or it
        // would be dragged onto this page and shrunk along with it.
        if (band.bottom - band.top > pageBoardH) {
          if (current.length) pages.push(current);
          pages.push([...band.els]);
          current = [];
          continue;
        }
        if (!current.length) {
          current = [...band.els];
          currentTop = band.top;
        } else if (band.bottom - currentTop <= pageBoardH) {
          current.push(...band.els);
        } else {
          pages.push(current);
          current = [...band.els];
          currentTop = band.top;
        }
      }
      if (current.length) pages.push(current);

      const appState = { ...editor.getAppState(), exportBackground: true };
      const files = editor.getFiles();

      for (let i = 0; i < pages.length; i++) {
        setExportPage({ page: i + 1, of: pages.length });
        // Exporting only this page's elements crops to exactly them, which is
        // what keeps a shape whole instead of trimming it at a page edge.
        const blob = await exportToBlob({
          elements: pages[i],
          appState,
          files,
          mimeType: 'image/png',
          exportPadding: 16,
        });
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Could not read the page image'));
          reader.readAsDataURL(blob);
        });
        const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error('Could not measure the page image'));
          img.src = dataUrl;
        });

        // Fit inside the page, keeping the aspect: scaled down if it is too
        // tall, never stretched up beyond its own size.
        const fit = Math.min(pageW / size.w, pageH / size.h, 1);
        const w = size.w * fit;
        const h = size.h * fit;
        if (i > 0) doc.addPage();
        doc.addImage(dataUrl, 'PNG', margin + (pageW - w) / 2, margin, w, h);
      }

      doc.save(`board-${sessionId}.pdf`);
    } catch {
      flash('Export failed — please try again.');
    } finally {
      setExporting(false);
      setExportPage(null);
    }
  }, [sessionId, flash]);

  const exportPng = useCallback(async () => {
    const editor = apiRef.current;
    if (!editor) return;
    try {
      setExporting(true);
      const elements = editor.getSceneElements();
      const appState = { ...editor.getAppState(), exportBackground: true };
      const files = editor.getFiles();
      const blob = await exportToBlob({
        elements,
        appState,
        files,
        mimeType: 'image/png',
        exportPadding: 24,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chalkboard-${sessionId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      flash('Board snapshot downloaded');
    } catch {
      flash('Could not export snapshot');
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

  // Fit the tool rail between the menu button above it and the zoom bar below.
  // It is taller than an inline (not full-screen) board has room for, and it
  // used to be centred, so it ran up over the menu button and its last tool —
  // the laser — sank under the zoom bar. It shrinks instead, to --rail-scale,
  // which board-excalidraw.css applies. Scaling rather than scrolling keeps the
  // menus that hang off the rail from being clipped.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const rail = railNode?.closest<HTMLElement>('.shapes-section');
    if (!wrapper || !rail) return;
    const fit = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      // Keep in step with the rail's top and bottom clearance in the CSS.
      const room = wrapper.clientHeight - RAIL_TOP_REM * rem - RAIL_BOTTOM_REM * rem;
      const scale = Math.min(1, Math.max(0.5, room / rail.offsetHeight));
      wrapper.style.setProperty('--rail-scale', scale.toFixed(3));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrapper);
    ro.observe(rail);
    return () => ro.disconnect();
  }, [railNode]);

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
    if (!wrapper || !canDraw || !maths) return;
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
  }, [canDraw, maths, openMathEditor]);

  // Test hook. Excalidraw draws to a canvas rather than to DOM nodes, so the
  // end-to-end specs have nothing to query for "what is on the board"; they
  // read the scene through this instead.
  useEffect(() => {
    if (!api) return;
    const w = window as unknown as {
      __livetichBoard?: ExcalidrawImperativeAPI | null;
    };
    w.__livetichBoard = api;
    // Force Excalidraw to dark chalkboard canvas matching Google Chalkboard UX prototype
    api.updateScene({
      appState: {
        theme: 'dark',
        viewBackgroundColor: '#10131c',
        currentItemStrokeColor: activeColor,
        currentItemStrokeWidth: activeWeight,
      },
    });
    if (canDraw) {
      api.setActiveTool({ type: 'freedraw' });
    }
    return () => {
      w.__livetichBoard = null;
    };
  }, [api, activeColor, activeWeight, canDraw]);

  const pill =
    'rounded-full px-3 py-1.5 text-xs font-semibold shadow ring-1 ring-neutral-200 transition';
  // The classroom toolbar island: teal is the brand, so idle tools carry it in
  // their icons and hover, and an open panel's tool is solid teal.
  const toolClass =
    'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 disabled:opacity-50';
  const toolIdle =
    'text-neutral-700 hover:bg-signal-50 hover:text-signal-800 [&>svg]:text-signal-600';
  const toolActive = 'bg-signal-700 text-white shadow-sm shadow-signal-800/25';
  const dividerClass =
    'mx-1 h-5 w-px shrink-0 bg-signal-100 max-[729px]:mx-2 max-[729px]:my-0.5 max-[729px]:h-px max-[729px]:w-auto';
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
          ? 'fixed inset-0 z-[500] isolate overflow-hidden bg-[#10131c]'
          : 'relative isolate h-full min-h-[320px] overflow-hidden rounded-xl border border-white/10 bg-[#10131c]',
      )}
    >
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{
          appState: {
            theme: 'dark',
            viewBackgroundColor: '#10131c',
            currentItemStrokeWidth: activeWeight,
            currentItemStrokeColor: activeColor,
          },
        }}
        viewModeEnabled={!canEdit}
        isCollaborating
        theme="dark"
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
          const block = parseQuranBlock(element.link);
          if (block) {
            return (
              <BoardQuranBlock
                surah={block.surah}
                from={block.from}
                to={block.to}
                tajweed={quran?.tajweed ?? null}
              />
            );
          }
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
        validateEmbeddable={(link) =>
          youTubeIdOf(link) || googleEmbed(link) || parseQuranBlock(link) ? true : undefined
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

      {/* Live preview of the armed polygon. Excalidraw is drawing a rectangle
          underneath at zero opacity — this is what the instructor actually
          sees follow the drag. */}
      {/* Edit, on the equation itself.
          Double-click does the same thing and is faster, but nothing on a
          board advertises a double-click — this is what tells the teacher the
          equation is still editable, and it rides along on pans and zooms
          because its position is recomputed with the selection. */}
      {selectedMath && canDraw && maths && !insertStudioOpen && (
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

      {/* Imported pages: select the rest of the import, or delete what is
          selected. Only while a page is selected, so nothing sits over the
          lesson while it is being taught from. */}
      {selectedImport && canDraw && (
        <div
          data-import-actions
          role="toolbar"
          aria-label="Imported pages"
          style={{
            left: Math.max(8, selectedImport.left),
            top: Math.max(4, selectedImport.top - 46),
          }}
          className="pointer-events-auto absolute z-[401] flex items-center gap-0.5 rounded-xl bg-white p-1 text-xs shadow-lg shadow-signal-900/10 ring-1 ring-signal-100"
        >
          <span className="flex max-w-[13rem] items-center gap-1.5 px-2 font-semibold text-neutral-700">
            <PiFilesBold className="shrink-0 text-signal-600" aria-hidden />
            <span className="truncate">
              {selectedImport.allIds.length === 1
                ? selectedImport.name
                : selectedImport.page !== null
                  ? `Page ${selectedImport.page} · ${selectedImport.name}`
                  : selectedImport.selectedIds.length === selectedImport.allIds.length
                    ? `All ${selectedImport.allIds.length} pages`
                    : `${selectedImport.selectedIds.length} of ${selectedImport.allIds.length} pages`}
            </span>
          </span>
          <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-signal-100" />
          {selectedImport.selectedIds.length < selectedImport.allIds.length && (
            <button
              type="button"
              onClick={() => selectImportPages(selectedImport.allIds)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-semibold text-signal-800 transition hover:bg-signal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
            >
              <PiSelectionAllBold className="text-signal-600" aria-hidden />
              Select all {selectedImport.allIds.length}
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteImportPages(selectedImport.selectedIds)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <PiTrashBold aria-hidden />
            {selectedImport.allIds.length === 1
              ? 'Delete'
              : selectedImport.selectedIds.length === 1
                ? 'Delete page'
                : selectedImport.selectedIds.length === selectedImport.allIds.length
                  ? `Delete all ${selectedImport.allIds.length}`
                  : `Delete ${selectedImport.selectedIds.length} pages`}
          </button>
        </div>
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

      {/* Against the board for the same reason as the shapes menu below: the
          tool row scrolls, and this must not be clipped by it — least of all a
          confirm for something this final. */}
      {clearOpen && (
        <div
          data-clear-board-panel
          role="dialog"
          aria-label="Clear the board"
          className="fixed inset-0 z-[550] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setClearOpen(false)}
        >
          <div
            className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#141724] p-4 text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-white">Clear the board?</p>
            <p className="mt-1.5 text-xs text-slate-300">
              Everything goes — drawings, imported pages and embedded files — for you and for every student. They cannot undo it from their side.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearOpen(false)}
                className="rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setClearOpen(false);
                  clearBoard();
                }}
                className="flex items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-rose-500"
              >
                <PiTrashBold aria-hidden />
                <span>Clear everything</span>
              </button>
            </div>
          </div>
        </div>
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

      {/* =========================================================================
          LAYER 2: AMBIENT FLOATING HUD (Top Bar across the board)
          ========================================================================= */}
      <header className="chalkboard-header-hud">
        {/* Left: Document Title + Multi-Page Navigation */}
        <div className="hud-left">
          <div className="hud-chip">
            <PiPencilSimpleBold className="h-3.5 w-3.5 text-emerald-400" />
            <input
              type="text"
              className="doc-title-input"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              title="Click to rename board"
            />
            <div className="page-stepper">
              <button
                type="button"
                className="page-nav-btn"
                onClick={prevPage}
                title="Previous page"
              >
                ‹
              </button>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  minWidth: 32,
                  textAlign: 'center',
                }}
              >
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="page-nav-btn"
                onClick={nextPage}
                title="Next page"
              >
                ›
              </button>
              {canDraw && (
                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={addPage}
                  title="Add blank page"
                  style={{ color: 'var(--accent)', fontWeight: 800 }}
                >
                  +
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Center: Student Follow Status (Visible for Student) */}
        {!canDraw && (
          <div className="hud-center">
            <div
              className="student-follow-chip"
              onClick={() => {
                setFollowing(true);
                applyPresenterView();
              }}
            >
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              <span>{following ? "Following Instructor's View" : "Back to Instructor's View"}</span>
            </div>
          </div>
        )}

        {/* Right: Permissions & Board Settings */}
        <div className="hud-right">
          {canDraw && (
            <>
              <div
                className={cn('collab-pill', boardOpen ? 'open' : 'locked')}
                onClick={() => setCollabSheetOpen((v) => !v)}
                title="Manage room drawing permissions"
              >
                <span className={cn('live-dot', !boardOpen && 'locked')} />
                <span className="desktop-only-text">
                  {boardOpen ? 'Students Can Draw (18)' : 'Board Locked'}
                </span>
                <span className="mobile-only-text">
                  {boardOpen ? 'Can Draw' : 'Locked'}
                </span>
                <PiCaretDownBold
                  className={cn('h-3 w-3 transition-transform', collabSheetOpen && 'rotate-180')}
                />
              </div>

              <button
                type="button"
                className="hud-chip desktop-only-btn cursor-pointer"
                onClick={() => setClearOpen(true)}
                title="Clear drawing canvas"
              >
                <PiTrashBold className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Collaboration & Export Flyout Sheet */}
      {collabSheetOpen && canDraw && (
        <div className="collab-sheet" onClick={(e) => e.stopPropagation()}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
            }}
          >
            Room Collaboration
          </div>

          {/* Student Draw Switch */}
          <div className="collab-toggle-row">
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>Student Drawing</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Let cohort write on board</div>
            </div>
            <div
              className={cn('switch-ui', boardOpen && 'on')}
              onClick={toggleBoardOpen}
            >
              <div className="switch-handle" />
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
              letterSpacing: '0.06em',
            }}
          >
            Export &amp; Sharing
          </div>

          <div
            className="collab-action-row"
            onClick={() => {
              setCollabSheetOpen(false);
              void exportPdf();
            }}
          >
            <PiDownloadSimpleBold className="h-4 w-4 text-emerald-400" />
            <span>Export Multi-Page PDF</span>
          </div>

          <div
            className="collab-action-row"
            onClick={() => {
              setCollabSheetOpen(false);
              void exportPng();
            }}
          >
            <PiImageBold className="h-4 w-4 text-sky-400" />
            <span>Export Snapshot PNG</span>
          </div>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          <div
            className="collab-action-row danger"
            onClick={() => {
              setCollabSheetOpen(false);
              setClearOpen(true);
            }}
          >
            <PiTrashBold className="h-4 w-4" />
            <span>Wipe Entire Chalkboard</span>
          </div>
        </div>
      )}

      {/* =====================================================================
          LAYER 3: UNIFIED MINIMALIST TOOL DOCK (Google Floating Island)
          ===================================================================== */}
      {canDraw && (
        <div className="dock-wrapper">
          {/* Contextual Tool Property Flyout (Colors, Sizes, Styles) */}
          {propertiesPopoverOpen && (
            <div className="properties-popover" onClick={(e) => e.stopPropagation()}>
              <div className="pop-row-label">
                <span>Color Palette</span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--accent)' }}>
                  {activeColor.toUpperCase()}
                </span>
              </div>
              <div className="palette-grid">
                {['#10b981', '#38bdf8', '#fbbf24', '#f43f5e', '#a855f7', '#ffffff', '#27272a'].map((col) => (
                  <div
                    key={col}
                    className={cn('color-dot', activeColor.toLowerCase() === col.toLowerCase() && 'active')}
                    style={{ background: col }}
                    onClick={() => setStrokeColor(col)}
                  />
                ))}
              </div>

              <div className="pop-row-label">
                <span>Stroke Thickness</span>
                <span>{activeWeight}px</span>
              </div>
              <div className="stroke-size-selector">
                {[
                  { weight: 2, height: 2 },
                  { weight: 4, height: 4 },
                  { weight: 8, height: 8 },
                  { weight: 16, height: 16 },
                ].map(({ weight, height }) => (
                  <button
                    key={weight}
                    type="button"
                    className={cn('stroke-btn', activeWeight === weight && 'active')}
                    onClick={() => setStrokeWeight(weight)}
                  >
                    <div style={{ width: 14, height, background: 'currentColor', borderRadius: 2 }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* The Floating Island Dock */}
          <div className="floating-island">
            {/* Tool 1: Select Arrow */}
            <button
              type="button"
              className={cn('tool-icon-btn', activeToolState === 'select' && 'active')}
              onClick={() => selectTool('select')}
              title="Selection Pointer (V)"
            >
              <svg className="icon" viewBox="0 0 24 24"><path d="M3 3l7 18 3-7 7-3L3 3z"/></svg>
            </button>

            {/* Tool 2: Smooth Pen */}
            <button
              type="button"
              className={cn('tool-icon-btn', activeToolState === 'pen' && 'active')}
              onClick={() => selectTool('pen')}
              title="Chalkboard Pen (P)"
            >
              <svg className="icon" viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
            </button>

            {/* Tool 3: Highlighter */}
            <button
              type="button"
              className={cn('tool-icon-btn', activeToolState === 'highlighter' && 'active')}
              onClick={() => selectTool('highlighter')}
              title="Highlighter Marker (H)"
            >
              <svg className="icon" viewBox="0 0 24 24"><path d="M14 2l4 4L7 17H3v-4L14 2z"/><line x1="3" y1="22" x2="21" y2="22"/></svg>
            </button>

            {/* Tool 4: Eraser */}
            <button
              type="button"
              className={cn('tool-icon-btn', activeToolState === 'eraser' && 'active')}
              onClick={() => selectTool('eraser')}
              title="Stroke Eraser (E)"
            >
              <svg className="icon" viewBox="0 0 24 24"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L18 15L20 20Z"/></svg>
            </button>

            {/* Tool 5: Shapes */}
            <button
              type="button"
              className={cn('tool-icon-btn', activeToolState === 'rectangle' && 'active')}
              onClick={() => selectTool('rectangle')}
              title="Geometric Shapes (R)"
            >
              <svg className="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
            </button>

            {/* Tool 6: Text */}
            <button
              type="button"
              className={cn('tool-icon-btn desktop-only-tool', activeToolState === 'text' && 'active')}
              onClick={() => selectTool('text')}
              title="Text Typography (T)"
            >
              <svg className="icon" viewBox="0 0 24 24"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
            </button>

            {/* Tool 7: Laser Pointer */}
            <button
              type="button"
              className={cn('tool-icon-btn desktop-only-tool', activeToolState === 'laser' && 'active')}
              onClick={() => selectTool('laser')}
              title="Presentation Laser Pointer (L)"
            >
              <svg className="icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>

            <div className="divider-v" />

            {/* Active Color Swatch (Tap toggles properties popover) */}
            <div
              className="color-swatch-trigger"
              style={{ background: activeColor }}
              onClick={() => setPropertiesPopoverOpen((v) => !v)}
              title="Change color & stroke size"
            />

            <div className="divider-v" />

            {/* Pedagogical Insert Hero Capsule */}
            <button
              type="button"
              className="btn-insert-hero"
              onClick={() => openInsertStudio()}
              title="Insert Math Formula, Qur'an Ayah, Google Docs or Media"
            >
              <PiPlusBold className="h-3.5 w-3.5" />
              <span>Insert</span>
            </button>

            <div className="divider-v" />

            {/* Undo / Redo */}
            <button
              type="button"
              className="tool-icon-btn"
              onClick={handleUndo}
              title="Undo (Ctrl+Z)"
            >
              <svg className="icon icon-sm" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
            <button
              type="button"
              className="tool-icon-btn desktop-only-tool"
              onClick={handleRedo}
              title="Redo (Ctrl+Y)"
            >
              <svg className="icon icon-sm" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* The formula being built comes first and stays visible: what it will
          look like, then what it is made of, then the tools. The palette used
          to sit above both, so the thing you were making was buried in the
          middle of the thing you were making it with. */}
      {/* Import progress, centred over the board. It covers the board on
          purpose: drawing or importing again mid-import would land under or
          between pages that are still arriving. */}
      {importProgress && (
        <div className="pointer-events-auto absolute inset-0 z-[404] grid place-items-center bg-white/60 p-4 backdrop-blur-[2px]">
          <div
            role="status"
            aria-live="polite"
            className="w-[min(22rem,100%)] rounded-2xl bg-white p-5 shadow-xl shadow-signal-900/10 ring-1 ring-signal-100"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-signal-50"
              >
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-signal-200 border-t-signal-700" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  Importing {importProgress.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-500">
                  {importProgress.stage}
                </p>
              </div>
              {importProgress.percent !== null && (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-signal-700">
                  {importProgress.percent}%
                </span>
              )}
            </div>
            <div
              role="progressbar"
              aria-label="Import progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={importProgress.percent ?? undefined}
              className="relative mt-4 h-2 overflow-hidden rounded-full bg-signal-100"
            >
              {importProgress.percent === null ? (
                <span className="board-import-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-signal-600" />
              ) : (
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-signal-600 transition-[width] duration-300 ease-out"
                  style={{ width: `${importProgress.percent}%` }}
                />
              )}
            </div>
            <p className="mt-3 text-[11px] text-neutral-400">
              Keep this tab open until it finishes.
            </p>
          </div>
        </div>
      )}



      {insertStudioOpen && canDraw && (
        <div
          data-insert-studio-scrim
          className="pointer-events-auto fixed inset-0 z-[520] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-md transition-opacity"
          onClick={closeInsertStudio}
        >
          <div
            data-insert-studio-card
            className="studio-bottom-sheet relative flex max-h-[92vh] sm:max-h-[85vh] w-full max-w-full sm:max-w-2xl flex-col overflow-hidden rounded-t-[28px] sm:rounded-2xl border border-white/10 bg-[#141722] text-neutral-100 shadow-2xl shadow-black/80"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-white/20 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 sm:py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-signal-500/15 text-signal-400">
                  <PiPlusBold className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingMath ? 'Edit Formula' : 'Insert into Chalkboard'}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    {editingMath
                      ? 'Update formula or add a new line below'
                      : 'Add interactive mathematical formulas, Qur’anic ayahs, or Google docs'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeInsertStudio}
                aria-label="Close dialog"
                className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
              >
                <PiXBold className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Studio Navigation Tabs (Mobile horizontally scrollable, single row) */}
            <div className="studio-scroll-hidden flex border-b border-white/10 bg-black/20 px-3 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setInsertStudioTab('math')}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors',
                  insertStudioTab === 'math'
                    ? 'text-signal-400 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-signal-400'
                    : 'text-neutral-400 hover:text-white',
                )}
              >
                <PiMathOperationsBold className="h-4 w-4" />
                <span>Math &amp; Science</span>
              </button>
              <button
                type="button"
                onClick={() => setInsertStudioTab('quran')}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors',
                  insertStudioTab === 'quran'
                    ? 'text-signal-400 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-signal-400'
                    : 'text-neutral-400 hover:text-white',
                )}
              >
                <PiBookOpenTextBold className="h-4 w-4" />
                <span>Qur’an Block</span>
              </button>
              <button
                type="button"
                onClick={() => setInsertStudioTab('docs')}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors',
                  insertStudioTab === 'docs'
                    ? 'text-signal-400 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-signal-400'
                    : 'text-neutral-400 hover:text-white',
                )}
              >
                <PiFilesBold className="h-4 w-4" />
                <span>Docs &amp; Video</span>
              </button>
              <button
                type="button"
                onClick={() => setInsertStudioTab('files')}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors',
                  insertStudioTab === 'files'
                    ? 'text-signal-400 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-signal-400'
                    : 'text-neutral-400 hover:text-white',
                )}
              >
                <PiUploadSimpleBold className="h-4 w-4" />
                <span>Import File</span>
              </button>
            </div>

            {/* Studio Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {/* TAB 1: MATH & SCIENCE */}
              {insertStudioTab === 'math' && (
                <div className="space-y-4">
                  {/* KaTeX Live Preview Plate */}
                  <div className="grid min-h-[5rem] place-items-center overflow-x-auto rounded-xl border border-white/10 bg-[#090a0f] p-4 text-[#38bdf8]">
                    {mathSource.trim() === '' ? (
                      <p className="text-xs text-neutral-400">
                        Pick an equation or symbol below — it appears here as you build it.
                      </p>
                    ) : mathIssue ? (
                      <p className="text-center text-xs font-semibold text-rose-400">
                        {mathIssue}
                      </p>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: mathPreview }} />
                    )}
                  </div>

                  <div>
                    <label htmlFor="studio-math-input" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      LaTeX Expression
                    </label>
                    <textarea
                      id="studio-math-input"
                      ref={mathInputRef}
                      value={mathSource}
                      onChange={(e) => setMathSource(e.target.value)}
                      rows={2}
                      spellCheck={false}
                      placeholder="Type LaTeX or click quick presets..."
                      className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-neutral-500 outline-none focus:border-signal-400 focus:ring-1 focus:ring-signal-400"
                    />
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
                      Preset Formulas
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {MATH_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setMathSource(preset.latex);
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 p-2 text-center text-xs font-mono text-neutral-300 hover:border-signal-500 hover:bg-signal-500/10 hover:text-white transition"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Math Symbols & Search */}
                  <div className="space-y-2">
                    <input
                      type="search"
                      value={mathQuery}
                      onChange={(e) => setMathQuery(e.target.value)}
                      placeholder="Search symbols — integral, matrix, theta..."
                      aria-label="Search math symbols"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-signal-400"
                    />
                    <div className="flex max-h-40 gap-2 overflow-hidden">
                      {mathQuery.trim() === '' && (
                        <div className="w-24 shrink-0 space-y-0.5 overflow-y-auto pr-1">
                          {mathTabs.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setMathTab(cat)}
                              className={cn(
                                'block w-full rounded-lg px-2 py-1 text-left text-[11px] font-semibold transition',
                                mathTab === cat
                                  ? 'bg-signal-500/20 text-signal-300 border border-signal-500/30'
                                  : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200',
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}
                      <div
                        className={cn(
                          'flex min-w-0 flex-1 gap-1 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2',
                          mathTab === 'Equations' && mathQuery.trim() === ''
                            ? 'flex-col'
                            : 'flex-wrap content-start',
                        )}
                      >
                        {visibleMath.length === 0 ? (
                          <p className="p-2 text-xs text-neutral-500">
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
                </div>
              )}

              {/* TAB 2: QUR'AN BLOCK */}
              {insertStudioTab === 'quran' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-500/30 bg-[#0b0e14] p-5 text-center font-serif text-xl sm:text-2xl leading-loose text-amber-300">
                    {SURAH_SNIPPETS[quranForm.surah] || 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400">Surah</label>
                      <select
                        value={quranForm.surah}
                        onChange={(e) => {
                          setQuranForm((f) => ({ ...f, surah: e.target.value }));
                          setQuranError(null);
                        }}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-signal-400"
                      >
                        <option value="1" className="bg-[#141722] text-white">1. Al-Fatihah</option>
                        <option value="2" className="bg-[#141722] text-white">2. Al-Baqarah</option>
                        <option value="18" className="bg-[#141722] text-white">18. Al-Kahf</option>
                        <option value="36" className="bg-[#141722] text-white">36. Ya-Sin</option>
                        <option value="67" className="bg-[#141722] text-white">67. Al-Mulk</option>
                        <option value="112" className="bg-[#141722] text-white">112. Al-Ikhlas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400">From Ayah</label>
                      <input
                        type="number"
                        min={1}
                        max={286}
                        value={quranForm.from}
                        onChange={(e) => {
                          setQuranForm((f) => ({ ...f, from: e.target.value }));
                          setQuranError(null);
                        }}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-signal-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-400">To Ayah</label>
                      <input
                        type="number"
                        min={1}
                        max={286}
                        value={quranForm.to}
                        onChange={(e) => {
                          setQuranForm((f) => ({ ...f, to: e.target.value }));
                          setQuranError(null);
                        }}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-signal-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                    <span className="text-amber-400">✦</span>
                    <span>Tajweed color annotations made in reader automatically synchronize to this vector block.</span>
                  </div>
                  {quranError && <p className="text-xs text-rose-400">{quranError}</p>}
                </div>
              )}

              {/* TAB 3: DOCS & VIDEO */}
              {insertStudioTab === 'docs' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="studio-link-input" className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      Google Drive, Slides, Docs or YouTube Link
                    </label>
                    <div className="relative mt-1.5">
                      <PiLinkSimpleBold className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input
                        id="studio-link-input"
                        ref={linkInputRef}
                        value={linkSource}
                        onChange={(e) => {
                          setLinkSource(e.target.value);
                          setLinkError(null);
                        }}
                        placeholder="https://docs.google.com/presentation/d/…"
                        className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-signal-400"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void importGoogleAsPages(linkSource)}
                      disabled={importing || linkSource.trim() === ''}
                      className="rounded-xl border border-signal-500/30 bg-signal-500/10 p-3.5 text-left transition hover:bg-signal-500/20 disabled:opacity-40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-signal-400">Paginated Slides</span>
                        <span className="rounded-full bg-signal-400 px-2 py-0.5 text-[10px] font-extrabold text-[#022c22]">
                          Recommended
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-snug text-neutral-300">
                        Imports slides as scrollable chalkboard pages. Everyone views synchronously and you can write on top.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => addLinkToBoard(linkSource)}
                      disabled={linkSource.trim() === ''}
                      className="rounded-xl border border-white/10 bg-white/5 p-3.5 text-left transition hover:bg-white/10 disabled:opacity-40"
                    >
                      <span className="block text-xs font-bold text-white">Live Interactive Frame</span>
                      <p className="mt-1.5 text-[11px] leading-snug text-neutral-400">
                        Always current Google Drive iframe. Best for read-only spreadsheets and collaborative forms.
                      </p>
                    </button>
                  </div>
                  {linkError ? (
                    <p className="text-xs font-medium text-rose-400">{linkError}</p>
                  ) : (
                    <p className="text-[11px] text-neutral-500">
                      YouTube is live view only. Google files must be shared with &ldquo;anyone with the link&rdquo;.
                    </p>
                  )}
                </div>
              )}

              {/* TAB 4: FILE UPLOAD */}
              {insertStudioTab === 'files' && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-8 text-center cursor-pointer transition hover:border-signal-400 hover:bg-signal-500/10"
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-signal-500/10 text-signal-400 mb-3">
                      <PiUploadSimpleBold className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-bold text-white">
                      Click to upload PDF slides or images
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Supports Multi-page PDF, PNG, JPG, WebP
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-5 py-3.5 shrink-0">
              <button
                type="button"
                onClick={closeInsertStudio}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                {insertStudioTab === 'math' && editingMath && (
                  <button
                    type="button"
                    onClick={() => void replaceMathOnBoard()}
                    disabled={mathBusy || !!mathIssue || mathSource.trim() === ''}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20 disabled:opacity-40"
                  >
                    {mathBusy ? 'Working…' : 'Replace Equation'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (insertStudioTab === 'math') {
                      void addMathToBoard();
                    } else if (insertStudioTab === 'quran') {
                      addQuranBlock();
                    } else if (insertStudioTab === 'docs') {
                      if (linkSource.trim()) void importGoogleAsPages(linkSource);
                    } else if (insertStudioTab === 'files') {
                      fileInputRef.current?.click();
                    }
                  }}
                  disabled={
                    (insertStudioTab === 'math' && (mathBusy || !!mathIssue || mathSource.trim() === '')) ||
                    (insertStudioTab === 'docs' && linkSource.trim() === '')
                  }
                  className="rounded-full bg-signal-500 px-5 py-2 text-xs font-bold text-[#022c22] shadow-sm shadow-signal-500/30 transition hover:bg-signal-400 disabled:opacity-40"
                >
                  {insertStudioTab === 'math'
                    ? mathBusy
                      ? 'Adding…'
                      : editingMath
                        ? 'Add as New Line'
                        : 'Insert on Board'
                    : insertStudioTab === 'quran'
                      ? 'Add Ayah Block'
                      : insertStudioTab === 'docs'
                        ? 'Import Slides'
                        : 'Choose File'}
                </button>
              </div>
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
