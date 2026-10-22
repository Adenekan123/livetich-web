'use client';

import '@excalidraw/excalidraw/index.css';
import 'katex/dist/katex.min.css';
import './board-excalidraw.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CaptureUpdateAction,
  Excalidraw,
  FONT_FAMILY,
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
  PiCopyBold,
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

const CHALKBOARD_COLORS = [
  '#ffffff', '#000000', '#f8fafc', '#cbd5e1', '#94a3b8', '#64748b',
  '#10b981', '#22c55e', '#a3e635', '#38bdf8', '#3b82f6',
  '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#fbbf24',
] as const;

const CHALKBOARD_FONTS = [
  { label: 'Cursive', family: FONT_FAMILY.Excalifont },
  { label: 'Handwritten', family: FONT_FAMILY.Virgil },
  { label: 'Sans serif', family: FONT_FAMILY.Helvetica },
  { label: 'Monospace', family: FONT_FAMILY.Cascadia },
  { label: 'Rounded', family: FONT_FAMILY.Nunito },
  { label: 'Display', family: FONT_FAMILY['Lilita One'] },
  { label: 'Comic', family: FONT_FAMILY['Comic Shanns'] },
  { label: 'Liberation Sans', family: FONT_FAMILY['Liberation Sans'] },
] as const;

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
const PAGES_KEY = 'excalidraw-pages';
const PAGE_STATE_ID = 'state';
const DEFAULT_PAGE_ID = 'page-1';

interface BoardPage {
  id: string;
  title: string;
}

interface BoardPagesState {
  pages: BoardPage[];
  activePageId: string;
  title: string;
}

function elementPageId(element: ExcalidrawElement): string {
  const customData = element.customData as Record<string, unknown> | undefined;
  return typeof customData?.livetichPageId === 'string'
    ? customData.livetichPageId
    : DEFAULT_PAGE_ID;
}

function isBoardPagesState(value: unknown): value is BoardPagesState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<BoardPagesState>;
  return (
    Array.isArray(state.pages) &&
    state.pages.length > 0 &&
    state.pages.every(
      (page) =>
        !!page &&
        typeof page.id === 'string' &&
        typeof page.title === 'string',
    ) &&
    typeof state.activePageId === 'string' &&
    typeof state.title === 'string'
  );
}
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
  width: number;
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
      width: el.width,
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
 * A selected shape element on the board whose outline, fill, stroke thickness,
 * or placement can be edited through the contextual floating shape toolbar.
 */
interface SelectedShape {
  id: string;
  type: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  fillStyle: string;
  canFill: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

function isShapeElement(el: ExcalidrawElement): boolean {
  if (el.isDeleted) return false;
  if ((el.customData as MathCustomData | undefined)?.livetichMath) return false;
  if ((el.customData as ImportCustomData | undefined)?.livetichImport) return false;
  if (
    el.type === 'freedraw' ||
    el.type === 'text' ||
    el.type === 'image' ||
    el.type === 'embeddable' ||
    el.type === 'frame'
  ) {
    return false;
  }
  return (
    el.type === 'rectangle' ||
    el.type === 'ellipse' ||
    el.type === 'diamond' ||
    el.type === 'line' ||
    el.type === 'arrow'
  );
}

function shapeCanFill(el: ExcalidrawElement): boolean {
  if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') return true;
  if (el.type === 'line') {
    const pts = 'points' in el ? el.points : undefined;
    return Array.isArray(pts) && pts.length >= 3;
  }
  return false;
}

function soleShapeElement(
  elements: readonly ExcalidrawElement[],
  selectedIds: Readonly<Record<string, boolean>>,
  view: { scrollX: number; scrollY: number; zoom: number },
): SelectedShape | null {
  let found: ExcalidrawElement | null = null;
  for (const el of elements) {
    if (el.isDeleted || !selectedIds[el.id]) continue;
    if (!isShapeElement(el)) return null;
    if (found) return null; // more than one shape selected
    found = el;
  }
  if (!found) return null;

  const [minX, minY, maxX, maxY] = getCommonBounds([found]);
  const sceneW = Math.max(found.width, maxX - minX);
  const sceneH = Math.max(found.height, maxY - minY);
  const left = Math.round((minX + view.scrollX) * view.zoom);
  const top = Math.round((minY + view.scrollY) * view.zoom);
  const width = Math.round(sceneW * view.zoom);
  const height = Math.round(sceneH * view.zoom);

  return {
    id: found.id,
    type: found.type,
    strokeColor: found.strokeColor || '#ffffff',
    strokeWidth: found.strokeWidth || 2,
    backgroundColor: found.backgroundColor || 'transparent',
    fillStyle: found.fillStyle || 'solid',
    canFill: shapeCanFill(found),
    left,
    top,
    width,
    height,
  };
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
    key: 'line',
    label: 'Line',
    tool: 'line',
    icon: 'M4 20L20 4',
  },
  {
    key: 'arrow',
    label: 'Arrow',
    tool: 'arrow',
    icon: 'M5 19L19 5M13 5h6v6',
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
  const existingCards = editor.getSceneElements().filter((e) => !e.isDeleted && (e.type === 'embeddable' || e.type === 'image'));
  const count = existingCards.length;
  const xOffset = count > 0 ? 300 : 0;
  const yOffset = count > 0 ? 40 : 0;
  const seed = () => Math.floor(Math.random() * 2 ** 31);
  const id = crypto.randomUUID();
  const element = {
    id,
    type: 'embeddable',
    x: (x1 + x2) / 2 - w / 2 + xOffset,
    y: (y1 + y2) / 2 - h / 2 + yOffset,
    width: w,
    height: h,
    angle: 0,
    strokeColor: '#334155',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
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
    appState: {
      selectedElementIds: { [id]: true },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  editor.setActiveTool({ type: 'selection' });
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
  const pageStateMapRef = useRef<Y.Map<BoardPagesState> | null>(null);
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
  const flushLocalRef = useRef<() => void>(() => {});
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
  const lastSelectedIdsRef = useRef<Record<string, true> | null>(null);

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
  const [deletePageOpen, setDeletePageOpen] = useState(false);
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
  const [mathSource, setMathSource] = useState('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
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
  >('select');
  const [activeColor, setActiveColor] = useState('#ffffff');
  const [activeFontFamily, setActiveFontFamily] = useState<number>(FONT_FAMILY.Excalifont);
  const [selectedTextCount, setSelectedTextCount] = useState(0);
  const [selectedTextFontFamily, setSelectedTextFontFamily] = useState<number | null>(null);
  const [activeWeight, setActiveWeight] = useState(1);
  const [shapeFillColor, setShapeFillColor] = useState<string>('transparent');
  const shapeFillColorRef = useRef(shapeFillColor);
  shapeFillColorRef.current = shapeFillColor;
  const [propertiesPopoverOpen, setPropertiesPopoverOpen] = useState(false);
  const [shapesPopoverOpen, setShapesPopoverOpen] = useState(false);
  const [boardTitle, setBoardTitle] = useState('System Architecture');
  const boardTitleRef = useRef(boardTitle);
  boardTitleRef.current = boardTitle;
  const [boardPages, setBoardPages] = useState<BoardPage[]>([
    { id: DEFAULT_PAGE_ID, title: 'Page 1' },
  ]);
  const boardPagesRef = useRef(boardPages);
  boardPagesRef.current = boardPages;
  const [activeBoardPageId, setActiveBoardPageId] = useState(DEFAULT_PAGE_ID);
  const activeBoardPageIdRef = useRef(activeBoardPageId);
  activeBoardPageIdRef.current = activeBoardPageId;

  const openInsertStudio = useCallback((tab?: InsertStudioTab) => {
    if (tab) setInsertStudioTab(tab);
    setInsertStudioOpen(true);
    setCollabSheetOpen(false);
    setPropertiesPopoverOpen(false);
    setShapesPopoverOpen(false);
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
      const chalkColor =
        !activeColor || activeColor === '#27272a' || activeColor === '#1e1e1e'
          ? '#ffffff'
          : activeColor;

      if (tool !== 'rectangle') {
        armedShapeRef.current = null;
        armedActiveRef.current = false;
        previewRef.current = null;
        setPreview(null);
      }
      if (tool !== 'select') {
        lastSelectedIdsRef.current = null;
        editor.updateScene({
          appState: {
            selectedElementIds: {},
          },
        });
      }

      if (tool === 'select') {
        editor.setActiveTool({ type: 'selection' });
        editor.updateScene({
          appState: { currentItemOpacity: 100 },
        });
      } else if (tool === 'pen') {
        editor.updateScene({
          appState: {
            selectedElementIds: {},
            currentItemOpacity: 100,
            currentItemStrokeWidth: activeWeight,
            currentItemStrokeColor: chalkColor,
            currentItemBackgroundColor: 'transparent',
          },
        });
        editor.setActiveTool({ type: 'freedraw', locked: true });
      } else if (tool === 'highlighter') {
        editor.setActiveTool({ type: 'freedraw', locked: true });
        editor.updateScene({
          appState: {
            currentItemOpacity: 35,
            currentItemStrokeWidth: activeWeight * 3,
            currentItemStrokeColor: activeColor || '#fbbf24',
            currentItemBackgroundColor: 'transparent',
          },
        });
      } else if (tool === 'eraser') {
        editor.setActiveTool({ type: 'eraser', locked: true });
      } else if (tool === 'rectangle') {
        editor.setActiveTool({ type: 'rectangle', locked: true });
        editor.updateScene({
          appState: {
            currentItemOpacity: 100,
            currentItemStrokeColor: chalkColor,
            currentItemStrokeWidth: activeWeight,
            currentItemBackgroundColor: shapeFillColorRef.current || 'transparent',
            currentItemFillStyle: 'solid',
          },
        });
      } else if (tool === 'text') {
        editor.setActiveTool({ type: 'text', locked: true });
        editor.updateScene({
          appState: {
            currentItemOpacity: 100,
            currentItemStrokeColor: chalkColor,
            currentItemFontSize: 28,
            currentItemFontFamily: activeFontFamily,
            currentItemTextAlign: 'left',
          },
        });
      } else if (tool === 'laser') {
        editor.setActiveTool({ type: 'laser', locked: true });
      }
      setPropertiesPopoverOpen(false);
      if (tool !== 'rectangle') {
        setShapesPopoverOpen(false);
      }
    },
    [activeWeight, activeColor, activeFontFamily],
  );

  const setStrokeColor = useCallback(
    (color: string) => {
      setActiveColor(color);
      const editor = apiRef.current;
      if (!editor) return;
      const elements = editor.getSceneElements();
      const appState = editor.getAppState();
      let selectedIds = appState.selectedElementIds;
      if (!selectedIds || !Object.keys(selectedIds).some((id) => selectedIds[id])) {
        if (
          lastSelectedIdsRef.current &&
          Object.keys(lastSelectedIdsRef.current).some((id) => lastSelectedIdsRef.current![id])
        ) {
          selectedIds = lastSelectedIdsRef.current;
        }
      }
      const keepOpacity = activeToolState === 'highlighter' ? 35 : 100;
      if (selectedIds && Object.keys(selectedIds).some((id) => selectedIds[id])) {
        lastSelectedIdsRef.current = { ...selectedIds };
        const next = elements.map((el) =>
          selectedIds[el.id]
            ? {
                ...el,
                strokeColor: color,
                opacity: el.type === 'text' && el.opacity < 50 ? 100 : el.opacity,
                version: el.version + 1,
              }
            : el,
        );
        editor.updateScene({
          elements: next,
          appState: {
            selectedElementIds: { ...selectedIds },
            currentItemStrokeColor: color,
            currentItemOpacity: keepOpacity,
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        const map = elementsRef.current;
        const doc = docRef.current;
        if (doc && map) {
          doc.transact(() => {
            for (const el of next) {
              if (selectedIds[el.id]) {
                map.set(el.id, el);
              }
            }
          }, LOCAL);
        }
      } else {
        editor.updateScene({
          appState: { currentItemStrokeColor: color, currentItemOpacity: keepOpacity },
        });
      }
      if (activeToolState === 'eraser') selectTool('pen');
    },
    [activeToolState, selectTool],
  );

  const setShapeFill = useCallback(
    (color: string) => {
      setShapeFillColor(color);
      shapeFillColorRef.current = color;
      const editor = apiRef.current;
      if (!editor) return;

      // 1. Set current drawing background fill for upcoming shapes
      editor.updateScene({
        appState: {
          currentItemBackgroundColor: color,
          currentItemFillStyle: 'solid',
        },
      });

      // 2. If a shape element is currently selected on the chalkboard, recolor it
      const elements = editor.getSceneElements();
      const appState = editor.getAppState();
      let selectedIds = appState.selectedElementIds;
      if (!selectedIds || !Object.keys(selectedIds).some((id) => selectedIds[id])) {
        if (
          lastSelectedIdsRef.current &&
          Object.keys(lastSelectedIdsRef.current).some((id) => lastSelectedIdsRef.current![id])
        ) {
          selectedIds = lastSelectedIdsRef.current;
        }
      }

      if (selectedIds && Object.keys(selectedIds).some((id) => selectedIds[id])) {
        lastSelectedIdsRef.current = { ...selectedIds };
        const next = elements.map((el) =>
          selectedIds[el.id]
            ? {
                ...el,
                backgroundColor: color,
                fillStyle: 'solid' as const,
                version: el.version + 1,
              }
            : el,
        );
        editor.updateScene({
          elements: next,
          appState: {
            selectedElementIds: { ...selectedIds },
            currentItemBackgroundColor: color,
            currentItemFillStyle: 'solid',
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        const map = elementsRef.current;
        const doc = docRef.current;
        if (doc && map) {
          doc.transact(() => {
            for (const el of next) {
              if (selectedIds[el.id]) {
                map.set(el.id, el);
              }
            }
          }, LOCAL);
        }
      }
    },
    [],
  );

  const setStrokeWeight = useCallback((weight: number) => {
    setActiveWeight(weight);
    const editor = apiRef.current;
    if (!editor) return;
    const elements = editor.getSceneElements();
    const appState = editor.getAppState();
    let selectedIds = appState.selectedElementIds;
    const hasSelection = !!(selectedIds && Object.keys(selectedIds).some((id) => selectedIds[id]));

    if (
      activeToolState === 'select' &&
      (hasSelection ||
        (lastSelectedIdsRef.current &&
          Object.keys(lastSelectedIdsRef.current).some((id) => lastSelectedIdsRef.current![id])))
    ) {
      if (!hasSelection && lastSelectedIdsRef.current) {
        selectedIds = lastSelectedIdsRef.current;
      }
      lastSelectedIdsRef.current = { ...selectedIds };
      const next = elements.map((el) =>
        selectedIds[el.id] ? { ...el, strokeWidth: weight, version: el.version + 1 } : el,
      );
      editor.updateScene({
        elements: next,
        appState: {
          selectedElementIds: { ...selectedIds },
          currentItemStrokeWidth: weight,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      const map = elementsRef.current;
      const doc = docRef.current;
      if (doc && map) {
        doc.transact(() => {
          for (const el of next) {
            if (selectedIds[el.id]) {
              map.set(el.id, el);
            }
          }
        }, LOCAL);
      }
    } else {
      lastSelectedIdsRef.current = null;
      editor.updateScene({
        appState: {
          selectedElementIds: {},
          currentItemStrokeWidth: weight,
        },
      });
      editor.setActiveTool({ type: 'freedraw', locked: true });
      setActiveToolState('pen');
    }
  }, [activeToolState]);

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
  const [selectedShape, setSelectedShape] = useState<SelectedShape | null>(null);
  const selectedShapeRef = useRef<SelectedShape | null>(null);
  const [shapeToolbarMenu, setShapeToolbarMenu] = useState<'none' | 'stroke' | 'width' | 'fill'>('none');
  /** Set while the panel is editing an existing equation rather than composing
   *  a new one. */
  const [editingMath, setEditingMath] = useState<SelectedMath | null>(null);
  const editingMathRef = useRef<SelectedMath | null>(null);
  editingMathRef.current = editingMath;
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
    const activePageId = activeBoardPageIdRef.current;
    for (const element of incoming) {
      syncedVersionsRef.current.set(element.id, element.version);
    }
    const visibleIncoming = incoming.filter(
      (element) => elementPageId(element) === activePageId,
    );
    if (visibleIncoming.length === 0) return;
    // restoreElements repairs bindings and drops anything malformed before it
    // can reach the scene.
    const remote = restoreElements(visibleIncoming, null, {
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
      void fetchAsDataURL(value.url, sessionId)
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
    const pageState = doc.getMap<BoardPagesState>(PAGES_KEY);
    const awareness = new Awareness(doc);
    // Captured for the cleanup below: these Maps outlive any single render, so
    // reading them at teardown time would trip the ref-in-cleanup lint rule.
    const syncedVersions = syncedVersionsRef.current;
    const syncedFiles = syncedFilesRef.current;
    const retryTimers = retryTimersRef.current;
    docRef.current = doc;
    elementsRef.current = elements;
    filesRef.current = files;
    pageStateMapRef.current = pageState;
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
    const onPageState = () => {
      const value = pageState.get(PAGE_STATE_ID);
      if (!isBoardPagesState(value)) return;
      const pages = value.pages;
      const activePageId = pages.some((page) => page.id === value.activePageId)
        ? value.activePageId
        : pages[0].id;
      const currentPageIds = new Set(pages.map((page) => page.id));
      const removedPageIds = new Set(
        boardPagesRef.current
          .filter((page) => !currentPageIds.has(page.id))
          .map((page) => page.id),
      );
      if (removedPageIds.size) {
        // Flush this client first, then remove again so a queued local edit
        // cannot resurrect content from a page another instructor deleted.
        flushLocalRef.current();
        doc.transact(() => {
          for (const [id, element] of [...elements.entries()]) {
            if (removedPageIds.has(elementPageId(element))) elements.delete(id);
          }
        }, LOCAL);
      }
      boardPagesRef.current = pages;
      setBoardPages(pages);
      boardTitleRef.current = value.title;
      setBoardTitle(value.title);
      if (activeBoardPageIdRef.current === activePageId) return;

      flushLocalRef.current();
      activeBoardPageIdRef.current = activePageId;
      setActiveBoardPageId(activePageId);
      const visible = [...elements.values()].filter(
        (element): element is ExcalidrawElement =>
          isSharedElement(element) && elementPageId(element) === activePageId,
      );
      for (const element of visible) {
        syncedVersionsRef.current.set(element.id, element.version);
      }
      const editor = apiRef.current;
      editor?.history.clear();
      editor?.updateScene({
        elements: visible,
        appState: { selectedElementIds: {} },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    };
    elements.observe(onElements);
    files.observe(hydrateFiles);
    pageState.observe(onPageState);

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
      if (!pageState.has(PAGE_STATE_ID) && canDraw) {
        const initialState: BoardPagesState = {
          pages: [{ id: DEFAULT_PAGE_ID, title: 'Page 1' }],
          activePageId: DEFAULT_PAGE_ID,
          title: boardTitleRef.current,
        };
        doc.transact(() => pageState.set(PAGE_STATE_ID, initialState), LOCAL);
      }
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
      if (error.code === 'UNAUTHORIZED' && authRetries < 2) {
        authRetries += 1;
        clearJoinTimer();
        clearRealtimeToken();
        window.setTimeout(() => {
          if (socketRef.current === socket) socket.connect();
        }, 600);
        return;
      }

      // A permission/session error cannot succeed by retrying. Stop the join
      // timer so an ended session or non-participant does not query the API
      // every two seconds for the lifetime of this component.
      clearJoinTimer();
      setReady(false);
      flash(error.message || 'Unable to join the chalkboard.');
    });

    return () => {
      clearJoinTimer();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      elements.unobserve(onElements);
      files.unobserve(hydrateFiles);
      pageState.unobserve(onPageState);
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
      pageStateMapRef.current = null;
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
    flash,
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
  flushLocalRef.current = flushLocal;

  const persistBoardPageState = useCallback((patch: Partial<BoardPagesState> = {}) => {
    const doc = docRef.current;
    const pageState = pageStateMapRef.current;
    if (!doc || !pageState) return;
    const existing = pageState.get(PAGE_STATE_ID);
    const next: BoardPagesState = {
      ...(isBoardPagesState(existing) ? existing : {
        pages: boardPagesRef.current,
        activePageId: activeBoardPageIdRef.current,
        title: boardTitleRef.current,
      }),
      pages: boardPagesRef.current,
      activePageId: activeBoardPageIdRef.current,
      title: boardTitleRef.current,
      ...patch,
    };
    doc.transact(() => pageState.set(PAGE_STATE_ID, next), LOCAL);
  }, []);

  const switchBoardPage = useCallback((pageId: string) => {
    if (!boardPagesRef.current.some((page) => page.id === pageId)) return;
    if (activeBoardPageIdRef.current === pageId) return;
    flushLocalRef.current();
    activeBoardPageIdRef.current = pageId;
    setActiveBoardPageId(pageId);
    const elements = elementsRef.current;
    const visible = elements
      ? [...elements.values()].filter(
          (element): element is ExcalidrawElement =>
            isSharedElement(element) && elementPageId(element) === pageId,
        )
      : [];
    for (const element of visible) {
      syncedVersionsRef.current.set(element.id, element.version);
    }
    const editor = apiRef.current;
    editor?.history.clear();
    editor?.updateScene({
      elements: visible,
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    persistBoardPageState({ activePageId: pageId });
  }, [persistBoardPageState]);

  const currentPageIndex = Math.max(
    0,
    boardPages.findIndex((page) => page.id === activeBoardPageId),
  );

  const setTextFont = useCallback((fontFamily: number) => {
    setActiveFontFamily(fontFamily);
    const editor = apiRef.current;
    if (!editor) return;

    const elements = editor.getSceneElements();
    const selectedIds = editor.getAppState().selectedElementIds;
    const selectedTextIds = Object.keys(selectedIds).filter(
      (id) => selectedIds[id] && elements.some((element) => element.id === id && element.type === 'text'),
    );
    const updates = new Map<string, ExcalidrawElement>();
    const next = elements.map((element) => {
      if (element.type !== 'text' || !selectedTextIds.includes(element.id)) return element;
      const updated = {
        ...element,
        fontFamily,
        version: element.version + 1,
        versionNonce: Math.floor(Math.random() * 2 ** 31),
        updated: Date.now(),
      };
      updates.set(updated.id, updated);
      return updated;
    });

    editor.updateScene({
      ...(updates.size ? { elements: next } : {}),
      appState: {
        currentItemFontFamily: fontFamily,
      },
      captureUpdate: updates.size ? CaptureUpdateAction.IMMEDIATELY : CaptureUpdateAction.NEVER,
    });

    const map = elementsRef.current;
    const doc = docRef.current;
    if (updates.size && doc && map) {
      doc.transact(() => {
        for (const [id, element] of updates) map.set(id, element);
      }, LOCAL);
    }
    setPropertiesPopoverOpen(false);
  }, []);
  const currentPage = currentPageIndex + 1;
  const totalPages = boardPages.length;
  const prevPage = useCallback(() => {
    const index = boardPagesRef.current.findIndex(
      (page) => page.id === activeBoardPageIdRef.current,
    );
    if (index > 0) switchBoardPage(boardPagesRef.current[index - 1].id);
  }, [switchBoardPage]);
  const nextPage = useCallback(() => {
    const index = boardPagesRef.current.findIndex(
      (page) => page.id === activeBoardPageIdRef.current,
    );
    if (index >= 0 && index < boardPagesRef.current.length - 1) {
      switchBoardPage(boardPagesRef.current[index + 1].id);
    }
  }, [switchBoardPage]);
  const addPage = useCallback(() => {
    flushLocalRef.current();
    const page: BoardPage = {
      id: crypto.randomUUID(),
      title: `Page ${boardPagesRef.current.length + 1}`,
    };
    const pages = [...boardPagesRef.current, page];
    boardPagesRef.current = pages;
    setBoardPages(pages);
    activeBoardPageIdRef.current = page.id;
    setActiveBoardPageId(page.id);
    const editor = apiRef.current;
    editor?.history.clear();
    editor?.updateScene({
      elements: [],
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    persistBoardPageState({ pages, activePageId: page.id });
    flash('Added page');
  }, [flash, persistBoardPageState]);

  const deleteCurrentPage = useCallback(() => {
    if (!canDraw) return;
    const pages = boardPagesRef.current;
    if (pages.length <= 1) {
      setDeletePageOpen(false);
      flash('Keep at least one board page.');
      return;
    }

    const pageIndex = pages.findIndex(
      (page) => page.id === activeBoardPageIdRef.current,
    );
    if (pageIndex < 0) return;

    const doc = docRef.current;
    const elements = elementsRef.current;
    const pageState = pageStateMapRef.current;
    if (!doc || !elements || !pageState) {
      flash('The board is still connecting. Try again in a moment.');
      return;
    }

    flushLocalRef.current();
    const removedPageId = pages[pageIndex].id;
    const remainingPages = pages.filter((page) => page.id !== removedPageId);
    const nextActivePage = remainingPages[Math.max(0, pageIndex - 1)];
    const existing = pageState.get(PAGE_STATE_ID);
    const nextState: BoardPagesState = {
      ...(isBoardPagesState(existing)
        ? existing
        : { pages, activePageId: removedPageId, title: boardTitleRef.current }),
      pages: remainingPages,
      activePageId: nextActivePage.id,
      title: boardTitleRef.current,
    };

    boardPagesRef.current = remainingPages;
    setBoardPages(remainingPages);
    activeBoardPageIdRef.current = nextActivePage.id;
    setActiveBoardPageId(nextActivePage.id);

    doc.transact(() => {
      for (const [id, element] of [...elements.entries()]) {
        if (elementPageId(element) !== removedPageId) continue;
        elements.delete(id);
        syncedVersionsRef.current.delete(id);
      }
      pageState.set(PAGE_STATE_ID, nextState);
    }, LOCAL);

    const visible = [...elements.values()].filter(
      (element): element is ExcalidrawElement =>
        isSharedElement(element) && elementPageId(element) === nextActivePage.id,
    );
    for (const element of visible) {
      syncedVersionsRef.current.set(element.id, element.version);
    }
    const editor = apiRef.current;
    editor?.history.clear();
    editor?.updateScene({
      elements: visible,
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    setDeletePageOpen(false);
    flash('Page deleted');
  }, [canDraw, flash]);

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
        const pageId = activeBoardPageIdRef.current;
        pendingRef.current = scene.map((element) => {
          if (elementPageId(element) === pageId) return element;
          const customData =
            element.customData && typeof element.customData === 'object'
              ? (element.customData as Record<string, unknown>)
              : {};
          return {
            ...element,
            customData: { ...customData, livetichPageId: pageId },
          };
        });
        if (!flushTimerRef.current) {
          flushTimerRef.current = setTimeout(flushLocal, SYNC_INTERVAL_MS);
        }
        const unshared = Object.keys(editor.getFiles()).filter(
          (id) => !syncedFilesRef.current.has(id),
        );
        if (unshared.length) shareNewFiles(unshared);
      }

      const state = editor.getAppState();
      const currentSelected = state.selectedElementIds;
      const selectedTextElements = scene.filter(
        (element) => currentSelected?.[element.id] && element.type === 'text',
      );
      const selectedFontFamilies = new Set(
        selectedTextElements.map((element) => (element.type === 'text' ? element.fontFamily : null)),
      );
      setSelectedTextCount(selectedTextElements.length);
      setSelectedTextFontFamily(
        selectedFontFamilies.size === 1 ? selectedFontFamilies.values().next().value ?? null : null,
      );
      if (selectedFontFamilies.size === 1) {
        setActiveFontFamily(selectedFontFamilies.values().next().value ?? FONT_FAMILY.Excalifont);
      }
      if (currentSelected && Object.keys(currentSelected).some((id) => currentSelected[id])) {
        lastSelectedIdsRef.current = { ...currentSelected };
      }
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
          const p0x = shape.points[0][0];
          const p0y = shape.points[0][1];
          const polygon = convertToExcalidrawElements([
            {
              type: 'line',
              x: box.x + (p0x / SHAPE_SIZE) * w,
              y: box.y + (p0y / SHAPE_SIZE) * h,
              width: w,
              height: h,
              points: shape.points.map(
                ([px, py]) =>
                  [((px - p0x) / SHAPE_SIZE) * w, ((py - p0y) / SHAPE_SIZE) * h] as Point,
              ),
              strokeColor: activeColor || box.strokeColor || '#ffffff',
              backgroundColor: shapeFillColorRef.current || 'transparent',
              fillStyle: 'solid' as const,
              strokeWidth: activeWeight || box.strokeWidth || 2,
              strokeStyle: box.strokeStyle,
              roughness: box.roughness,
              opacity: 100,
            },
          ]);
          // Cleared first: updateScene re-enters onChange, and a second pass
          // must not try to convert the polygon it just created.
          armedShapeRef.current = null;
          editor.updateScene({
            elements: [...scene.filter((el) => el.id !== box.id), ...polygon],
            // Hand back 100% opacity, so the instructor's next shape or text is crisp and visible
            appState: {
              selectedElementIds: { [polygon[0].id]: true },
              currentItemOpacity: 100,
              currentItemStrokeColor: activeColor,
              currentItemStrokeWidth: activeWeight,
              currentItemBackgroundColor: shapeFillColorRef.current || 'transparent',
              currentItemFillStyle: 'solid',
            },
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
          editor.setActiveTool({ type: 'selection' });
          setActiveToolState('select');
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
      if (!picked && editingMathRef.current) {
        editingMathRef.current = null;
        setEditingMath(null);
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

      // Shape selection: tracks when a shape is selected so the contextual toolbar appears
      const shapeItem = soleShapeElement(scene, state.selectedElementIds, {
        scrollX: state.scrollX,
        scrollY: state.scrollY,
        zoom: state.zoom.value,
      });
      const hadShape = selectedShapeRef.current;
      if (
        shapeItem?.id !== hadShape?.id ||
        shapeItem?.strokeColor !== hadShape?.strokeColor ||
        shapeItem?.strokeWidth !== hadShape?.strokeWidth ||
        shapeItem?.backgroundColor !== hadShape?.backgroundColor ||
        shapeItem?.left !== hadShape?.left ||
        shapeItem?.top !== hadShape?.top ||
        shapeItem?.width !== hadShape?.width ||
        shapeItem?.height !== hadShape?.height
      ) {
        selectedShapeRef.current = shapeItem;
        setSelectedShape(shapeItem);
        if (!shapeItem) setShapeToolbarMenu('none');
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

  const updateSelectedShapeStrokeColor = useCallback(
    (color: string) => {
      const editor = apiRef.current;
      const shape = selectedShapeRef.current;
      if (!editor || !shape) return;
      const elements = editor.getSceneElements();
      const next = elements.map((el) =>
        el.id === shape.id
          ? {
              ...el,
              strokeColor: color,
              version: el.version + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
              updated: Date.now(),
            }
          : el,
      );
      editor.updateScene({
        elements: next,
        appState: {
          selectedElementIds: { [shape.id]: true },
          currentItemStrokeColor: color,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setActiveColor(color);
      const map = elementsRef.current;
      const doc = docRef.current;
      if (doc && map) {
        doc.transact(() => {
          const updatedEl = next.find((el) => el.id === shape.id);
          if (updatedEl) map.set(shape.id, updatedEl);
        }, LOCAL);
      }
    },
    [setActiveColor],
  );

  const updateSelectedShapeStrokeWidth = useCallback(
    (width: number) => {
      const editor = apiRef.current;
      const shape = selectedShapeRef.current;
      if (!editor || !shape) return;
      const elements = editor.getSceneElements();
      const next = elements.map((el) =>
        el.id === shape.id
          ? {
              ...el,
              strokeWidth: width,
              version: el.version + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
              updated: Date.now(),
            }
          : el,
      );
      editor.updateScene({
        elements: next,
        appState: {
          selectedElementIds: { [shape.id]: true },
          currentItemStrokeWidth: width,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setActiveWeight(width);
      const map = elementsRef.current;
      const doc = docRef.current;
      if (doc && map) {
        doc.transact(() => {
          const updatedEl = next.find((el) => el.id === shape.id);
          if (updatedEl) map.set(shape.id, updatedEl);
        }, LOCAL);
      }
    },
    [setActiveWeight],
  );

  const updateSelectedShapeFillColor = useCallback(
    (color: string) => {
      const editor = apiRef.current;
      const shape = selectedShapeRef.current;
      if (!editor || !shape) return;
      const elements = editor.getSceneElements();
      const next = elements.map((el) =>
        el.id === shape.id
          ? {
              ...el,
              backgroundColor: color,
              fillStyle: 'solid' as const,
              version: el.version + 1,
              versionNonce: Math.floor(Math.random() * 2 ** 31),
              updated: Date.now(),
            }
          : el,
      );
      editor.updateScene({
        elements: next,
        appState: {
          selectedElementIds: { [shape.id]: true },
          currentItemBackgroundColor: color,
          currentItemFillStyle: 'solid',
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      setShapeFillColor(color);
      shapeFillColorRef.current = color;
      const map = elementsRef.current;
      const doc = docRef.current;
      if (doc && map) {
        doc.transact(() => {
          const updatedEl = next.find((el) => el.id === shape.id);
          if (updatedEl) map.set(shape.id, updatedEl);
        }, LOCAL);
      }
    },
    [setShapeFillColor],
  );

  const deleteSelectedShape = useCallback(() => {
    const editor = apiRef.current;
    const shape = selectedShapeRef.current;
    if (!editor || !shape) return;
    const elements = editor.getSceneElementsIncludingDeleted();
    const next = elements.map((el) =>
      el.id === shape.id
        ? {
            ...el,
            isDeleted: true,
            version: el.version + 1,
            versionNonce: Math.floor(Math.random() * 2 ** 31),
            updated: Date.now(),
          }
        : el,
    );
    editor.updateScene({
      elements: next,
      appState: { selectedElementIds: {} },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    const map = elementsRef.current;
    const doc = docRef.current;
    if (doc && map) {
      doc.transact(() => {
        const deletedEl = next.find((el) => el.id === shape.id);
        if (deletedEl) map.set(shape.id, deletedEl);
      }, LOCAL);
    }
    setSelectedShape(null);
    selectedShapeRef.current = null;
    setShapeToolbarMenu('none');
    flash('Shape deleted');
  }, [flash]);

  const duplicateSelectedShape = useCallback(() => {
    const editor = apiRef.current;
    const shape = selectedShapeRef.current;
    if (!editor || !shape) return;
    const elements = editor.getSceneElements();
    const target = elements.find((el) => el.id === shape.id);
    if (!target) return;
    const cloneId = 'shape_' + Math.random().toString(36).substring(2, 9);
    const clone = {
      ...target,
      id: cloneId,
      x: target.x + 24,
      y: target.y + 24,
      version: 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
    };
    editor.updateScene({
      elements: [...elements, clone],
      appState: { selectedElementIds: { [cloneId]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    const map = elementsRef.current;
    const doc = docRef.current;
    if (doc && map) {
      doc.transact(() => {
        map.set(cloneId, clone);
      }, LOCAL);
    }
    flash('Shape duplicated');
  }, [flash]);

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
    setShapesPopoverOpen(false);
    setActiveShape(key);

    const strokeColor =
      !activeColor || activeColor === '#27272a' || activeColor === '#1e1e1e'
        ? '#ffffff'
        : activeColor;
    const strokeWidth = activeWeight || 2;

    const fill =
      'tool' in shape && (shape.tool === 'line' || shape.tool === 'arrow')
        ? 'transparent'
        : shapeFillColorRef.current || 'transparent';

    if ('tool' in shape) {
      // Native tool (rectangle, ellipse, diamond, line, arrow)
      armedShapeRef.current = null;
      editor.setActiveTool({ type: shape.tool, locked: false });
      editor.updateScene({
        appState: {
          currentItemOpacity: 100,
          currentItemStrokeColor: strokeColor,
          currentItemStrokeWidth: strokeWidth,
          currentItemBackgroundColor: fill,
          currentItemFillStyle: 'solid',
        },
      });
      setActiveToolState('rectangle');
      return;
    }

    // Custom polygon (triangle, star, pentagon, hexagon, octagon)
    armedShapeRef.current = key;
    armedBaselineRef.current = new Set(
      editor.getSceneElementsIncludingDeleted().map((el) => el.id),
    );
    armedOpacityRef.current = 100;
    armedActiveRef.current = true;
    previewRef.current = null;
    setPreview(null);

    // Arm the rectangle tool so dragging captures the bounding box
    editor.setActiveTool({ type: 'rectangle', locked: true });
    editor.updateScene({
      appState: {
        currentItemOpacity: 0,
        currentItemStrokeColor: strokeColor,
        currentItemStrokeWidth: strokeWidth,
        currentItemBackgroundColor: fill,
        currentItemFillStyle: 'solid',
      },
    });
    setActiveToolState('rectangle');
  }, [activeColor, activeWeight]);

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
  /** Open the inline formula editor on an equation that is already on the board. */
  const openMathEditor = useCallback((target: SelectedMath) => {
    setEditingMath(target);
    setMathSource(target.latex);
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
      map: Y.Map<SharedBoardFile> | null,
      doc: Y.Doc | null,
    ) => {
      const bg = editor.getAppState().viewBackgroundColor || '';
      const isDarkBg = bg === '#10131c' || bg === '#12141c' || bg === '#090a0f' || (bg.startsWith('#') && parseInt(bg.slice(1, 3), 16) < 100);
      const curStroke = editor.getAppState().currentItemStrokeColor;
      const strokeCol = curStroke && curStroke !== '#ffffff' && curStroke !== '#000000' && curStroke !== '#1e1e1e'
        ? curStroke
        : '#1e1e1e';
      const { file, width, height } = await renderMathToPng(latex, strokeCol);
      const fileId = crypto.randomUUID();
      const dataURL = await fileToDataURL(file);
      const created = Date.now();
      // Add immediately to Excalidraw in-memory registry so equation renders with zero delay
      editor.addFiles([
        { id: fileId as FileId, dataURL, mimeType: 'image/png', created } as BinaryFileData,
      ]);
      syncedFilesRef.current.add(fileId);

      if (doc && map) {
        // Upload asynchronously in background so insertion into scene is instantaneous
        void uploadBoardAsset(sessionId, file)
          .then(({ url }) => {
            doc.transact(() => {
              map.set(fileId, { id: fileId, url, mimeType: 'image/png', created });
            }, LOCAL);
          })
          .catch((uploadErr) => {
            console.warn('Board asset upload failed, falling back to dataURL in doc map:', uploadErr);
            doc.transact(() => {
              map.set(fileId, { id: fileId, url: dataURL, mimeType: 'image/png', created });
            }, LOCAL);
          });
      }
      return { fileId, width, height };
    },
    [sessionId],
  );

  const addMathToBoard = useCallback(async () => {
    const editor = apiRef.current;
    const map = filesRef.current;
    const doc = docRef.current;
    const latex = mathSource.trim();
    if (!editor || !latex) return;
    setMathBusy(true);
    try {
      const state = editor.getAppState();
      const { fileId, width, height } = await renderMathFile(latex, editor, map, doc);

      // Editing? Stack the new step directly under the one it came from, which
      // is how the working reads down the board. Otherwise centre it in view.
      const from = editingMath;
      const [x1, y1, x2, y2] = getVisibleSceneBounds(state);
      const existingImages = editor.getSceneElements().filter((e) => !e.isDeleted && e.type === 'image');
      const offset = from ? 0 : (existingImages.length % 5) * 40;
      const added = convertToExcalidrawElements([
        {
          type: 'image',
          status: 'saved',
          x: from ? from.x : (x1 + x2) / 2 - width / 2 - 180 + offset,
          y: from ? from.y + from.height + 24 : (y1 + y2) / 2 - height / 2 + 20 + offset,
          width,
          height,
          fileId: fileId as FileId,
          customData: { livetichMath: latex } satisfies MathCustomData,
        },
      ]);
      const newElement = added[0];
      editor.updateScene({
        elements: [...editor.getSceneElementsIncludingDeleted(), ...added],
        appState: {
          selectedElementIds: { [newElement.id]: true },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      editor.setActiveTool({ type: 'selection' });
      setActiveToolState('select');
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
    if (!editor || !latex || !target) return;
    setMathBusy(true);
    try {
      const { fileId, width, height } = await renderMathFile(latex, editor, map, doc);
      editor.updateScene({
        elements: editor.getSceneElementsIncludingDeleted().map((el) =>
          el.id === target.id
            ? {
                ...el,
                fileId: fileId as FileId,
                status: 'saved',
                width,
                height,
                customData: { livetichMath: latex } satisfies MathCustomData,
                version: el.version + 1,
                versionNonce: Math.floor(Math.random() * 2 ** 31),
              }
            : el,
        ),
        appState: {
          selectedElementIds: { [target.id]: true },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      editor.setActiveTool({ type: 'selection' });
      setActiveToolState('select');
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
      } catch (err) {
        console.warn('Google slides import failed, attempting direct embed:', err);
        const doc = googleEmbed(url);
        const video = youTubeIdOf(url);
        if (doc || video) {
          addLinkToBoard(url);
          setLinkError(null);
        } else {
          setLinkError('That file could not be imported. Ensure link is public or has view access.');
        }
      } finally {
        setImportProgress(null);
      }
    },
    [sessionId, addLinkToBoard],
  );

  const importFiles = useCallback(
    async (list: readonly File[] | FileList | null) => {
      const editor = apiRef.current;
      const map = filesRef.current;
      const doc = docRef.current;
      if (!editor || !map || !doc || !list?.length) return;
      closeInsertStudio();
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
          const dataURL = await fileToDataURL(image);
          const created = Date.now();
          editor.addFiles([
            { id: fileId as FileId, dataURL, mimeType: image.type, created } as BinaryFileData,
          ]);
          syncedFilesRef.current.add(fileId);

          try {
            const { url } = await uploadBoardAsset(sessionId, image);
            doc.transact(() => {
              map.set(fileId, { id: fileId, url, mimeType: image.type, created });
            }, LOCAL);
          } catch (uploadErr) {
            console.warn('Board asset upload failed, falling back to dataURL in doc map:', uploadErr);
            doc.transact(() => {
              map.set(fileId, { id: fileId, url: dataURL, mimeType: image.type, created });
            }, LOCAL);
          }
          const livetichImport = {
            id: importId,
            name: title,
            page: i + 1,
            pages: images.length,
          };
          added.push(
            ...convertToExcalidrawElements([
              { type: 'image', status: 'saved', x: 0, y, width, height, fileId: fileId as FileId },
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
        closeInsertStudio();
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [sessionId, flash, closeInsertStudio],
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
    const map = elementsRef.current;
    const doc = docRef.current;
    if (doc && map) {
      doc.transact(() => {
        for (const el of cleared) {
          map.set(el.id, el);
        }
      }, LOCAL);
    }
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
        width: hit.width,
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
  const didInitBoardToolRef = useRef(false);
  useEffect(() => {
    if (!api) return;
    const w = window as unknown as {
      __livetichBoard?: (ExcalidrawImperativeAPI & { clearCanvas?: () => void }) | null;
    };
    w.__livetichBoard = Object.assign(api, { clearCanvas: clearBoard });
    if (!didInitBoardToolRef.current) {
      didInitBoardToolRef.current = true;
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
        api.setActiveTool({ type: 'selection' });
      }
    }
    return () => {
      w.__livetichBoard = null;
    };
  }, [api, canDraw]);

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
      onKeyDownCapture={(event) => {
        const editingText = apiRef.current?.getAppState().editingTextElement;
        if (
          propertiesPopoverOpen &&
          editingText &&
          (event.nativeEvent.isComposing ||
            event.key.length === 1 ||
            event.key === 'Enter' ||
            event.key === 'Backspace' ||
            event.key === 'Delete')
        ) {
          setPropertiesPopoverOpen(false);
        }
      }}
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
            currentItemFontFamily: activeFontFamily,
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
          Boolean(youTubeIdOf(link) || googleEmbed(link) || parseQuranBlock(link))
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
          board advertises a double-click — this mini pop-up tells the teacher the
          equation is editable, and rides along on pans and zooms. */}
      {selectedMath && canDraw && !insertStudioOpen && !editingMath && (
        <div
          data-math-edit-popup
          style={{
            left: selectedMath.left,
            top: Math.max(8, selectedMath.top - 42),
          }}
          className="pointer-events-auto absolute z-[401] flex items-center gap-1.5 rounded-full border border-signal-500/40 bg-neutral-900/95 px-3 py-1.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-md transition-all hover:bg-neutral-800 animate-in fade-in zoom-in-95"
        >
          <button
            type="button"
            data-math-edit
            onClick={() => openMathEditor(selectedMath)}
            className="flex items-center gap-1.5 text-xs font-semibold text-signal-400 hover:text-signal-300 transition"
            title="Edit LaTeX Equation Inline"
          >
            <PiPencilSimpleBold className="h-3.5 w-3.5 text-signal-400" />
            <span>Edit Equation</span>
          </button>
        </div>
      )}

      {/* Inline Equation Editor — direct in-place editing on the board without modal interruption */}
      {editingMath && canDraw && !insertStudioOpen && (() => {
        const anchor = (selectedMath?.id === editingMath.id ? selectedMath : editingMath);
        const wrapperW = wrapperRef.current?.clientWidth ?? 1000;
        const wrapperH = wrapperRef.current?.clientHeight ?? 800;
        const cardW = Math.min(420, wrapperW - 24);
        const leftPos = Math.max(12, Math.min(wrapperW - cardW - 12, anchor.left));
        const topPos = anchor.top > 230
          ? Math.max(12, anchor.top - 200)
          : Math.min(wrapperH - 220, anchor.top + Math.max(50, anchor.height) + 14);

        return (
          <div
            data-inline-math-editor
            style={{
              left: leftPos,
              top: topPos,
              width: cardW,
            }}
            className="pointer-events-auto absolute z-[450] flex flex-col gap-2 rounded-2xl border border-white/15 bg-neutral-900/95 p-3 text-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-signal-400">
                <PiPencilSimpleBold className="h-3.5 w-3.5" />
                <span>Edit Equation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-neutral-400 hidden sm:inline">
                  Enter to update • Esc to cancel
                </span>
                <button
                  type="button"
                  onClick={() => setEditingMath(null)}
                  className="grid h-6 w-6 place-items-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white transition"
                  title="Cancel edit"
                  aria-label="Cancel"
                >
                  <PiXBold className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* LaTeX Textarea */}
            <div className="relative">
              <textarea
                ref={mathInputRef}
                value={mathSource}
                onChange={(e) => setMathSource(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!mathBusy && !mathIssue && mathSource.trim() !== '') {
                      void replaceMathOnBoard();
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingMath(null);
                  }
                }}
                rows={2}
                placeholder="Enter LaTeX formula, e.g. x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"
                className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:border-signal-500/80 focus:outline-none focus:ring-1 focus:ring-signal-500/80 transition resize-none"
                autoFocus
              />
            </div>

            {/* Live KaTeX Preview & Syntax validation */}
            {mathIssue ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-300 border border-rose-500/20">
                <span className="font-bold">⚠️</span>
                <span className="truncate">{mathIssue}</span>
              </div>
            ) : mathPreview ? (
              <div
                className="flex min-h-[38px] max-h-[80px] items-center justify-center overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-center text-sm text-white studio-scroll-hidden"
                dangerouslySetInnerHTML={{ __html: mathPreview }}
              />
            ) : null}

            {/* Quick Symbol Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] studio-scroll-hidden">
              {[
                { label: 'x/y', latex: '\\frac{a}{b}', select: [6, 1] as [number, number] },
                { label: '√x', latex: '\\sqrt{x}', select: [6, 1] as [number, number] },
                { label: '±', latex: '\\pm ' },
                { label: 'x²', latex: '^{2}' },
                { label: '∫', latex: '\\int_{a}^{b} ' },
                { label: '∑', latex: '\\sum_{i=1}^{n} ' },
                { label: 'π', latex: '\\pi ' },
                { label: 'θ', latex: '\\theta ' },
                { label: '×', latex: '\\times ' },
                { label: '≤', latex: '\\le ' },
                { label: '≥', latex: '\\ge ' },
                { label: '≠', latex: '\\neq ' },
              ].map((sym) => (
                <button
                  key={sym.label}
                  type="button"
                  onClick={() => insertMath(sym.latex, sym.select)}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-neutral-300 hover:border-signal-500/40 hover:bg-signal-500/15 hover:text-white transition"
                  title={`Insert ${sym.latex}`}
                >
                  {sym.label}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={() => void addMathToBoard()}
                disabled={mathBusy || !!mathIssue || mathSource.trim() === ''}
                className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400 hover:text-signal-300 disabled:opacity-40 transition"
                title="Add as a new line under the formula"
              >
                <PiPlusBold className="h-3 w-3" />
                <span>+ New line</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingMath(null)}
                  className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void replaceMathOnBoard()}
                  disabled={mathBusy || !!mathIssue || mathSource.trim() === ''}
                  className="flex items-center gap-1.5 rounded-xl bg-signal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-signal-600/30 hover:bg-signal-500 disabled:opacity-40 transition"
                >
                  {mathBusy ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <PiCheckBold className="h-3.5 w-3.5" />
                  )}
                  <span>Update</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Contextual Shape Toolbar: Edit outline, stroke thickness, fill, duplicate, delete */}
      {selectedShape && canDraw && !insertStudioOpen && !editingMath && (
        <div
          data-shape-actions
          role="toolbar"
          aria-label="Selected shape actions"
          style={{
            left: Math.max(140, selectedShape.left + selectedShape.width / 2),
            top:
              selectedShape.top - 52 >= 64
                ? selectedShape.top - 52
                : selectedShape.top + selectedShape.height + 14,
            transform: 'translateX(-50%)',
          }}
          className="shape-contextual-bar"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Outline Color Swatch & Popover */}
          <div className="relative flex items-center">
            <button
              type="button"
              className={cn(
                'shape-bar-btn',
                shapeToolbarMenu === 'stroke' && 'active',
              )}
              onClick={() =>
                setShapeToolbarMenu((cur) => (cur === 'stroke' ? 'none' : 'stroke'))
              }
              title="Change Outline Color"
            >
              <span
                className="shape-bar-swatch-ring"
                style={{ borderColor: selectedShape.strokeColor }}
              >
                <span
                  className="shape-bar-swatch-inner"
                  style={{ background: selectedShape.strokeColor }}
                />
              </span>
              <span className="shape-bar-label">Outline</span>
              <PiCaretDownBold className="h-2.5 w-2.5 opacity-60" />
            </button>

            {shapeToolbarMenu === 'stroke' && (
              <div
                className="shape-bar-dropdown"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shape-bar-dropdown-title">Outline Color</div>
                <div className="palette-grid">
                  {CHALKBOARD_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      className={cn(
                        'color-dot',
                        selectedShape.strokeColor.toLowerCase() ===
                          col.toLowerCase() && 'active',
                      )}
                      style={{ background: col }}
                      onClick={() => {
                        updateSelectedShapeStrokeColor(col);
                      }}
                      title={`Outline ${col}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Stroke Thickness & Popover */}
          <div className="relative flex items-center">
            <button
              type="button"
              className={cn(
                'shape-bar-btn',
                shapeToolbarMenu === 'width' && 'active',
              )}
              onClick={() =>
                setShapeToolbarMenu((cur) => (cur === 'width' ? 'none' : 'width'))
              }
              title="Change Stroke Thickness"
            >
              <div className="shape-bar-thickness-preview">
                <span
                  style={{
                    height: Math.min(6, Math.max(1.5, selectedShape.strokeWidth)),
                    background: selectedShape.strokeColor,
                  }}
                />
              </div>
              <span className="shape-bar-label">
                {selectedShape.strokeWidth <= 1.5
                  ? 'Fine'
                  : selectedShape.strokeWidth <= 2.5
                  ? 'Normal'
                  : selectedShape.strokeWidth <= 4
                  ? 'Bold'
                  : 'Heavy'}
              </span>
              <PiCaretDownBold className="h-2.5 w-2.5 opacity-60" />
            </button>

            {shapeToolbarMenu === 'width' && (
              <div
                className="shape-bar-dropdown"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shape-bar-dropdown-title">Stroke Thickness</div>
                <div className="thickness-options">
                  {[
                    { label: 'Fine', w: 1 },
                    { label: 'Normal', w: 2 },
                    { label: 'Bold', w: 3.5 },
                    { label: 'Heavy', w: 6 },
                  ].map(({ label, w }) => (
                    <button
                      key={label}
                      type="button"
                      className={cn(
                        'thickness-pill-btn',
                        Math.abs(selectedShape.strokeWidth - w) < 0.8 && 'active',
                      )}
                      onClick={() => {
                        updateSelectedShapeStrokeWidth(w);
                      }}
                    >
                      <span
                        className="thickness-line"
                        style={{
                          height: w,
                          background: selectedShape.strokeColor,
                        }}
                      />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Fill Color (if shape supports fill) */}
          {selectedShape.canFill && (
            <div className="relative flex items-center">
              <button
                type="button"
                className={cn(
                  'shape-bar-btn',
                  shapeToolbarMenu === 'fill' && 'active',
                )}
                onClick={() =>
                  setShapeToolbarMenu((cur) => (cur === 'fill' ? 'none' : 'fill'))
                }
                title="Change Fill Color"
              >
                {selectedShape.backgroundColor === 'transparent' ||
                !selectedShape.backgroundColor ? (
                  <span className="shape-bar-swatch-none">⊘</span>
                ) : (
                  <span
                    className="shape-bar-swatch-solid"
                    style={{ background: selectedShape.backgroundColor }}
                  />
                )}
                <span className="shape-bar-label">Fill</span>
                <PiCaretDownBold className="h-2.5 w-2.5 opacity-60" />
              </button>

              {shapeToolbarMenu === 'fill' && (
                <div
                  className="shape-bar-dropdown"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="shape-bar-dropdown-title">Fill Color</div>
                  <div className="fill-palette-grid">
                    <button
                      type="button"
                      className={cn(
                        'color-dot fill-none-dot',
                        (selectedShape.backgroundColor === 'transparent' ||
                          !selectedShape.backgroundColor) &&
                          'active',
                      )}
                      onClick={() => {
                        updateSelectedShapeFillColor('transparent');
                      }}
                      title="Outline Only (No Fill)"
                    >
                      <span className="fill-none-slash">⊘</span>
                    </button>
                    {[
                      '#ffffff',
                      '#10b981',
                      '#38bdf8',
                      '#fbbf24',
                      '#f43f5e',
                      '#a855f7',
                      '#94a3b8',
                      '#f97316',
                    ].map((col) => (
                      <button
                        key={col}
                        type="button"
                        className={cn(
                          'color-dot',
                          selectedShape.backgroundColor.toLowerCase() ===
                            col.toLowerCase() && 'active',
                        )}
                        style={{ background: col }}
                        onClick={() => {
                          updateSelectedShapeFillColor(col);
                        }}
                        title={`Fill ${col}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <span className="shape-bar-divider" />

          {/* 4. Duplicate */}
          <button
            type="button"
            className="shape-bar-icon-btn"
            onClick={duplicateSelectedShape}
            title="Duplicate Shape"
          >
            <PiCopyBold className="h-3.5 w-3.5" />
          </button>

          {/* 5. Delete */}
          <button
            type="button"
            className="shape-bar-icon-btn danger"
            onClick={deleteSelectedShape}
            title="Delete Shape"
          >
            <PiTrashBold className="h-3.5 w-3.5" />
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
            fill={shapeFillColor !== 'transparent' ? shapeFillColor : 'none'}
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

      {deletePageOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-board-page-title"
          className="fixed inset-0 z-[550] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDeletePageOpen(false)}
        >
          <div
            className="pointer-events-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#141724] p-4 text-slate-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="delete-board-page-title" className="text-sm font-bold text-white">
              Delete page {currentPage}?
            </p>
            <p className="mt-1.5 text-xs text-slate-300">
              This removes the page and all of its content for everyone in this session. You can’t undo this.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletePageOpen(false)}
                className="rounded-full bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteCurrentPage}
                className="flex items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-rose-500"
              >
                <PiTrashBold aria-hidden />
                <span>Delete page</span>
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
              readOnly={!canDraw}
              onChange={(e) => setBoardTitle(e.target.value)}
              onBlur={() => {
                boardTitleRef.current = boardTitle;
                persistBoardPageState({ title: boardTitle });
              }}
              title="Click to rename board"
            />
            <div className="page-stepper">
              <button
                type="button"
                className="page-nav-btn"
                onClick={prevPage}
                disabled={!canDraw || !ready || currentPageIndex === 0}
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
                disabled={!canDraw || !ready || currentPageIndex >= totalPages - 1}
                title="Next page"
              >
                ›
              </button>
              {canDraw && (
                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={addPage}
                  disabled={!ready}
                  title="Add blank page"
                  style={{ color: 'var(--accent)', fontWeight: 800, opacity: ready ? 1 : 0.5 }}
                >
                  +
                </button>
              )}
              {canDraw && (
                <button
                  type="button"
                  className="page-nav-btn page-delete-btn"
                  onClick={() => setDeletePageOpen(true)}
                  disabled={!ready || totalPages <= 1}
                  title={totalPages <= 1 ? 'Keep at least one page' : 'Delete current page'}
                  aria-label={totalPages <= 1 ? 'Keep at least one page' : `Delete page ${currentPage}`}
                >
                  <PiTrashBold aria-hidden />
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

          <p style={{ margin: '-4px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>
            Exports the page currently open. Tall content may span multiple PDF sheets.
          </p>

          <div
            className="collab-action-row"
            title="Export the currently open board page as a PDF"
            onClick={() => {
              setCollabSheetOpen(false);
              void exportPdf();
            }}
          >
            <PiDownloadSimpleBold className="h-4 w-4 text-emerald-400" />
            <span>Export current page as PDF</span>
          </div>

          <div
            className="collab-action-row"
            title="Export the currently open board page as a PNG"
            onClick={() => {
              setCollabSheetOpen(false);
              void exportPng();
            }}
          >
            <PiImageBold className="h-4 w-4 text-sky-400" />
            <span>Export current page as PNG</span>
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
      {canEdit && (
        <div className="dock-wrapper">
          {/* Contextual Shapes Flyout Popover */}
          {shapesPopoverOpen && (
            <div
              className="properties-popover shapes-popover"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <div className="pop-row-label">
                <span>Chalkboard Shapes</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Click to pick</span>
              </div>
              <div className="shapes-grid">
                {SHAPES.map((shape) => {
                  const isActive = activeShape === shape.key;
                  return (
                    <button
                      key={shape.key}
                      type="button"
                      className={cn('shape-select-btn', isActive && 'active')}
                      onClick={() => addShape(shape.key)}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      title={`Draw ${shape.label}`}
                    >
                      <svg viewBox="0 0 24 24">
                        <path
                          d={shape.icon}
                          fill={shapeFillColor !== 'transparent' && shape.key !== 'line' && shape.key !== 'arrow' ? shapeFillColor : 'none'}
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{shape.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Shape Fill Color Row */}
              <div className="pop-row-label" style={{ marginTop: 12 }}>
                <span>Shape Fill</span>
                <span style={{ fontSize: 10, color: shapeFillColor === 'transparent' ? 'var(--text-dim)' : 'var(--accent)' }}>
                  {shapeFillColor === 'transparent' ? 'Outline Only' : shapeFillColor.toUpperCase()}
                </span>
              </div>
              <div className="palette-grid">
                <button
                  type="button"
                  className={cn('color-dot fill-none-dot', shapeFillColor === 'transparent' && 'active')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShapeFill('transparent');
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  title="Outline Only (No Fill)"
                >
                  <span className="fill-none-slash">⊘</span>
                </button>
                {CHALKBOARD_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    className={cn('color-dot', shapeFillColor.toLowerCase() === col.toLowerCase() && 'active')}
                    style={{ background: col }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShapeFill(col);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    title={`Fill ${col}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Contextual Tool Property Flyout (Colors, Sizes, Styles) */}
          {propertiesPopoverOpen && (
            <div
              className="properties-popover"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              {(activeToolState === 'text' || selectedTextCount > 0) && (
                <div className="chalkboard-font-control">
                  <label htmlFor="chalkboard-font-family">Text font</label>
                  <select
                    id="chalkboard-font-family"
                    value={selectedTextCount > 1 && selectedTextFontFamily === null ? '' : selectedTextFontFamily ?? activeFontFamily}
                    onChange={(event) => setTextFont(Number(event.currentTarget.value))}
                    onPointerDown={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    aria-label="Choose chalkboard text font"
                  >
                    {selectedTextCount > 1 && selectedTextFontFamily === null && (
                      <option value="">Mixed fonts</option>
                    )}
                    {CHALKBOARD_FONTS.map(({ label, family }) => (
                      <option key={family} value={family}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="pop-row-label">
                <span>{activeToolState === 'text' || selectedTextCount > 0 ? 'Text Color' : 'Color Palette'}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--accent)' }}>
                  {activeColor.toUpperCase()}
                </span>
              </div>
              <div className="palette-grid">
                {CHALKBOARD_COLORS.map((col) => (
                  <button
                    type="button"
                    key={col}
                    className={cn('color-dot', activeColor.toLowerCase() === col.toLowerCase() && 'active')}
                    style={{ background: col }}
                    aria-label={`Use color ${col}`}
                    aria-pressed={activeColor.toLowerCase() === col.toLowerCase()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setStrokeColor(col);
                      setPropertiesPopoverOpen(false);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    title={`Color ${col}`}
                  />
                ))}
              </div>

              {(activeToolState === 'pen' || activeToolState === 'highlighter') && (
                <>
                  <div className="pop-row-label">
                    <span>Stroke Thickness</span>
                    <span>{activeWeight}px</span>
                  </div>
                  <div className="stroke-size-selector">
                    {[
                      { label: 'Fine', weight: 1, barHeight: 2 },
                      { label: 'Normal', weight: 2, barHeight: 3 },
                      { label: 'Bold', weight: 3.5, barHeight: 5 },
                      { label: 'Heavy', weight: 6, barHeight: 8 },
                    ].map(({ label, weight, barHeight }) => (
                      <button
                        key={weight}
                        type="button"
                        className={cn('stroke-btn', activeWeight === weight && 'active')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPropertiesPopoverOpen(false);
                          setStrokeWeight(weight);
                          const targetTool = activeToolState === 'highlighter' ? 'highlighter' : 'pen';
                          setActiveToolState(targetTool);
                          const editor = apiRef.current;
                          if (editor) {
                            editor.updateScene({
                              appState: {
                                selectedElementIds: {},
                                currentItemStrokeWidth: weight,
                              },
                            });
                            editor.setActiveTool({ type: 'freedraw', locked: true });
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                        }}
                        title={`${label} (${weight}px)`}
                      >
                        <div style={{ width: 16, height: barHeight, background: 'currentColor', borderRadius: 2 }} />
                        <span style={{ fontSize: 9.5, fontWeight: 600 }}>{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
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
              onClick={() => {
                if (activeToolState === 'pen') {
                  setPropertiesPopoverOpen((v) => !v);
                } else {
                  selectTool('pen');
                }
              }}
              title="Chalkboard Pen (P) — Click again for thickness"
            >
              <svg className="icon" viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
            </button>

            {/* Tool 3: Highlighter */}
            <button
              type="button"
              className={cn('tool-icon-btn', activeToolState === 'highlighter' && 'active')}
              onClick={() => {
                if (activeToolState === 'highlighter') {
                  setPropertiesPopoverOpen((v) => !v);
                } else {
                  selectTool('highlighter');
                }
              }}
              title="Highlighter Marker (H) — Click again for options"
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
              className={cn('tool-icon-btn', (activeToolState === 'rectangle' || shapesPopoverOpen) && 'active')}
              onClick={() => {
                setPropertiesPopoverOpen(false);
                setShapesPopoverOpen((v) => !v);
                selectTool('rectangle');
              }}
              title="Geometric Shapes (Square, Circle, Triangle, Star…)"
            >
              <svg className="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
            </button>

            {/* Tool 6: Text */}
            <button
              type="button"
              className={cn('tool-icon-btn desktop-only-tool', activeToolState === 'text' && 'active')}
              onClick={() => {
                selectTool('text');
                setPropertiesPopoverOpen(true);
              }}
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
              <svg className="icon" viewBox="0 0 24 24">
                <path d="M4 20l8.5-8.5" />
                <path d="M10.5 9.5l3-3a1.5 1.5 0 0 1 2.1 0l1.9 1.9a1.5 1.5 0 0 1 0 2.1l-3 3" />
                <path d="M12.5 11.5l1.5 1.5" />
                <circle cx="20" cy="4" r="1.5" style={{ fill: 'currentColor' }} />
                <path d="M20 1v1" />
                <path d="M20 6v1" />
                <path d="M17 4h1" />
                <path d="M22 4h1" />
              </svg>
            </button>

            <div className="divider-v" />

            {/* Active Color Swatch (Tap toggles properties popover) */}
            <div
              className="color-swatch-trigger"
              style={{ background: activeColor }}
              onClick={(e) => {
                e.stopPropagation();
                setPropertiesPopoverOpen((v) => !v);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
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



      {insertStudioOpen && canEdit && (
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
                      if (linkSource.trim()) {
                        const isPres =
                          linkSource.includes('/presentation/') ||
                          linkSource.includes('docs.google.com/presentation');
                        if (isPres) {
                          void importGoogleAsPages(linkSource);
                        } else {
                          addLinkToBoard(linkSource);
                        }
                      }
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
                        ? linkSource.includes('/presentation/')
                          ? 'Import Slides'
                          : 'Embed Link'
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
