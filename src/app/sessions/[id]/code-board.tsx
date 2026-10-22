'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { EditorState, StateEffect, StateField, type Extension, type Range } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  Decoration,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { yCollab } from 'y-codemirror.next';
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
} from 'y-protocols/awareness';
import { io, type Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { API_URL } from '@/lib/api';
import { getRealtimeToken, clearRealtimeToken } from '@/lib/client-token';
import { useNetworkStatus } from '@/lib/network-status';
import type {
  CodeClientToServerEvents,
  CodeFileTreeNode,
  CodeCursorPayload,
  CodeFocusPayload,
  CodePermissionPayload,
  CodePointerPayload,
  CodeSpotlightPayload,
  CodeServerToClientEvents,
  CodeWritePermissionMode,
  RoomUser,
} from '@/lib/realtime-contract';
import { avatarColor, initials } from '@/lib/ui';
import {
  PiCode,
  PiFileCode,
  PiFolder,
  PiFolderOpen,
  PiGlobe,
  PiTerminal,
  PiLockSimple,
  PiLockSimpleOpen,
  PiUser,
  PiUserCheck,
  PiUsers,
  PiArrowSquareOut,
  PiSidebarSimple,
  PiCaretDown,
  PiCaretRight,
  PiFileText,
  PiGear,
  PiFile,
  PiArrowsOutSimple,
  PiDatabase,
  PiCube,
  PiGitBranch,
  PiMagnifyingGlass,
  PiCopy,
  PiCheck,
  PiDownloadSimple,
  PiTarget,
  PiCompass,
  PiLightning,
  PiX,
  PiWifiSlash,
} from 'react-icons/pi';
import { VscCollapseAll } from 'react-icons/vsc';
import dynamic from 'next/dynamic';

const TerminalView = dynamic(
  () => import('./terminal-view').then((m) => m.TerminalView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#090c10] text-xs text-neutral-500">
        Loading terminal...
      </div>
    ),
  },
);

const PortPreviewView = dynamic(
  () => import('./port-preview-view').then((m) => m.PortPreviewView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#0d1117] text-xs text-neutral-500">
        Loading live web preview...
      </div>
    ),
  },
);

type CodeSocket = Socket<CodeServerToClientEvents, CodeClientToServerEvents>;

const LANGUAGES = {
  javascript: { label: 'JavaScript', ext: () => javascript() },
  typescript: { label: 'TypeScript', ext: () => javascript({ typescript: true }) },
  jsx: { label: 'JSX / TSX', ext: () => javascript({ jsx: true, typescript: true }) },
  python: { label: 'Python', ext: () => python() },
  html: { label: 'HTML', ext: () => html() },
  css: { label: 'CSS', ext: () => css() },
  json: { label: 'JSON', ext: () => json() },
  markdown: { label: 'Markdown', ext: () => markdown() },
} as const;
type LangKey = keyof typeof LANGUAGES;
const DEFAULT_LANG: LangKey = 'javascript';

function langExtension(key: string): Extension {
  return (LANGUAGES[key as LangKey] ?? LANGUAGES[DEFAULT_LANG]).ext();
}

function detectLangFromPath(path: string): LangKey {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
    case 'jsx':
      return 'jsx';
    case 'py':
      return 'python';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    default:
      return 'javascript';
  }
}

type BottomTab = 'editor' | 'terminal' | 'preview';

const setRemoteSelectionEffect = StateEffect.define<{
  cursorPos: number;
  selection?: { from: number; to: number };
  name?: string;
} | null>();

function computeMinimalChange(prev: string, next: string): { from: number; to: number; insert: string } | null {
  if (prev === next) return null;
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) {
    start++;
  }
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  return {
    from: start,
    to: endPrev,
    insert: next.slice(start, endNext),
  };
}

function getOffsetFromLineCh(text: string, line: number, ch: number): number {
  const clean = text.replace(/\r\n/g, '\n');
  const lines = clean.split('\n');
  const safeLine = Math.max(0, Math.min(line, lines.length - 1));
  let offset = 0;
  for (let i = 0; i < safeLine; i++) {
    offset += lines[i].length + 1;
  }
  offset += Math.max(0, Math.min(ch, lines[safeLine]?.length ?? 0));
  return offset;
}

function getDocOffset(
  doc: { lines: number; line: (n: number) => { from: number; to: number } },
  line: number,
  ch: number,
): number {
  const safeLine = Math.max(1, Math.min(line + 1, doc.lines));
  const lineObj = doc.line(safeLine);
  return Math.min(lineObj.from + Math.max(0, ch), lineObj.to);
}

class RemoteCursorWidget extends WidgetType {
  constructor(readonly name: string) {
    super();
  }

  eq(other: RemoteCursorWidget) {
    return true;
  }

  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cm-remote-cursor-wrap';

    const caret = document.createElement('span');
    caret.className = 'cm-remote-cursor-caret';
    wrap.appendChild(caret);

    return wrap;
  }

  ignoreEvent() {
    return true;
  }
}

const remoteCursorField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setRemoteSelectionEffect)) {
        if (!effect.value) return Decoration.none;
        const { cursorPos, selection, name } = effect.value;
        const decos: Range<Decoration>[] = [];

        if (selection && selection.from < selection.to) {
          const from = Math.max(0, Math.min(selection.from, tr.state.doc.length));
          const to = Math.max(0, Math.min(selection.to, tr.state.doc.length));
          if (from < to) {
            decos.push(
              Decoration.mark({ class: 'cm-remote-selection' }).range(from, to),
            );
          }
        }

        const safePos = Math.max(0, Math.min(cursorPos, tr.state.doc.length));
        decos.push(
          Decoration.widget({
            widget: new RemoteCursorWidget(name || 'Instructor'),
            side: 1,
          }).range(safePos),
        );

        return Decoration.set(decos, true);
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const setSpotlightEffect = StateEffect.define<{ line: number } | null>();

const spotlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSpotlightEffect)) {
        if (!effect.value) return Decoration.none;
        const { line } = effect.value;
        const safeLine = Math.max(1, Math.min(line + 1, tr.state.doc.lines));
        const lineInfo = tr.state.doc.line(safeLine);
        return Decoration.set([
          Decoration.line({ class: 'cm-remote-spotlight' }).range(lineInfo.from),
        ]);
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const setDiffFlashEffect = StateEffect.define<{ fromLine: number; toLine: number } | null>();

const diffFlashField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setDiffFlashEffect)) {
        if (!effect.value) return Decoration.none;
        const decos: Range<Decoration>[] = [];
        const start = Math.max(1, Math.min(effect.value.fromLine, tr.state.doc.lines));
        const end = Math.max(start, Math.min(effect.value.toLine, tr.state.doc.lines));
        for (let l = start; l <= end; l++) {
          const lineInfo = tr.state.doc.line(l);
          decos.push(Decoration.line({ class: 'cm-remote-diff-flash' }).range(lineInfo.from));
        }
        return Decoration.set(decos, true);
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Duckly-Like Live Multi-File Code Studio & Terminal Stream.
 * Synchronizes multi-file project trees, cursor follow mode, interactive terminals,
 * and live-forwarded localhost web previews.
 */
export function CodeBoard({
  sessionId,
  canEdit: initialCanEdit,
  isInstructor = false,
  currentUserId = '',
  users = [],
}: {
  sessionId: string;
  canEdit: boolean;
  isInstructor?: boolean;
  currentUserId?: string;
  users?: RoomUser[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<string>(DEFAULT_LANG);
  const [activeTab, setActiveTab] = useState<BottomTab>('editor');
  const [previewReloadSignal, setPreviewReloadSignal] = useState(0);
  const previewReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTerminalDrawer, setShowTerminalDrawer] = useState<boolean>(true);
  const [showFileTree, setShowFileTree] = useState<boolean>(true);

  const [tree, setTree] = useState<CodeFileTreeNode[]>([]);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const latestTabCloseRequestRef = useRef<string | null>(null);
  const [activeFile, setActiveFile] = useState<string>('');
  const [permissionMode, setPermissionMode] = useState<CodeWritePermissionMode>('INSTRUCTOR_ONLY');
  const [delegatedUserIds, setDelegatedUserIds] = useState<string[]>([]);
  const [showPermissionMenu, setShowPermissionMenu] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; ch: number } | null>(null);
  const cursorPosRef = useRef<{ line: number; ch: number } | null>(null);
  const cursorPathRef = useRef('');
  const localCursorByPathRef = useRef(new Map<string, { anchor: number; head: number }>());
  const suppressNextCursorEmitRef = useRef(false);
  const [totalLines, setTotalLines] = useState<number>(1);
  const selectionRef = useRef<{
    anchor: { line: number; ch: number };
    active: { line: number; ch: number };
  } | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [sidebarPointer, setSidebarPointer] = useState<{
    target?: string;
    isFolder?: boolean;
    x?: number;
    y?: number;
  } | null>(null);
  const treeRef = useRef<CodeFileTreeNode[]>([]);
  const socketRef = useRef<CodeSocket | null>(null);
  const cursorSourceIdRef = useRef(`web:${useId()}`);
  const cursorSequenceRef = useRef(0);
  const lastCursorSentAtRef = useRef(0);
  const cursorSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCursorRef = useRef<{ path: string; line: number; ch: number; selection?: CodeCursorPayload['selection'] } | null>(null);
  const latestRemoteSequencesRef = useRef(new Map<string, number>());
  const remotePointerLocationRef = useRef<{ path: string; line: number; ch: number } | null>(null);
  const lastPointerSentAtRef = useRef(0);
  const sidebarPointerHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const docRef = useRef<Y.Doc | null>(null);
  const metaRef = useRef<Y.Map<string> | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  const isApplyingRemoteRef = useRef(false);
  const fileContentsRef = useRef<Map<string, string>>(new Map());

  const { isOnline } = useNetworkStatus();

  // Google-grade Smooth Floating Remote Cursor Layer State
  const [floatingCursor, setFloatingCursor] = useState<{
    path: string;
    x: number;
    y: number;
    visible: boolean;
    line: number;
    ch: number;
    name: string;
    isMoving: boolean;
  }>({
    path: '',
    x: 0,
    y: 0,
    visible: false,
    line: 0,
    ch: 0,
    name: 'Instructor',
    isMoving: false,
  });

  // Click Bubble Ripple State
  const [editorRipples, setEditorRipples] = useState<{ id: string; x: number; y: number; color?: string }[]>([]);
  const [activeRippleRow, setActiveRippleRow] = useState<{ path: string; x: number; y: number } | null>(null);
  const cursorHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRippleTimeRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const triggerEditorRipple = useCallback((x: number, y: number, color = '#10b981') => {
    const now = Date.now();
    const prev = lastRippleTimeRef.current;
    if (now - prev.time < 220 && Math.hypot(x - prev.x, y - prev.y) < 18) {
      return; // Deduplicate rapid identical click events
    }
    lastRippleTimeRef.current = { time: now, x, y };

    const id = `${now}-${Math.random().toString(36).slice(2, 7)}`;
    setEditorRipples((r) => [...r.slice(-4), { id, x, y, color }]);
    setTimeout(() => {
      setEditorRipples((r) => r.filter((item) => item.id !== id));
    }, 550);
  }, []);

  const triggerSidebarRipple = useCallback((path: string, x: number, y: number) => {
    setActiveRippleRow({ path, x, y });
    setTimeout(() => setActiveRippleRow(null), 600);
  }, []);

  // Calculates 2D pixel coordinates inside CodeMirror for smooth floating cursor gliding
  const updateFloatingCursorCoords = useCallback(
    (path: string, line: number, ch: number, name = 'Instructor', triggerClick = false, refreshLifetime = true) => {
      const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();
      if (!path || normalizePath(path) !== normalizePath(activeFileRef.current)) {
        setFloatingCursor((prev) => ({ ...prev, visible: false, isMoving: false }));
        return;
      }
      const view = viewRef.current;
      const host = hostRef.current;
      if (!view || !host) return;

      try {
        const doc = view.state.doc;
        if (!Number.isFinite(line) || !Number.isFinite(ch)) return;
        const safeLine = Math.max(1, Math.min(Math.trunc(line) + 1, doc.lines));
        const lineObj = doc.line(safeLine);
        const pos = Math.min(lineObj.from + Math.max(0, ch), lineObj.to);
        const coords = view.coordsAtPos(pos, ch > 0 ? -1 : 1) || view.coordsAtPos(pos);
        if (!coords) {
          setFloatingCursor((prev) => ({ ...prev, visible: false }));
          return;
        }

        const hostRect = host.getBoundingClientRect();
        const x = coords.left - hostRect.left;
        const y = coords.top - hostRect.top;

        if (x < -20 || y < -30 || x > hostRect.width + 60 || y > hostRect.height + 60) {
          setFloatingCursor((prev) => ({ ...prev, visible: false }));
          return;
        }

        setFloatingCursor((prev) => ({
          ...prev,
          path,
          x,
          y,
          visible: true,
          line,
          ch,
          name,
          isMoving: refreshLifetime ? true : prev.isMoving,
        }));

        if (triggerClick) {
          const yCenter = y + (coords.bottom - coords.top) / 2;
          triggerEditorRipple(x, yCenter);
        }

        remotePointerLocationRef.current = { path, line, ch };
        if (refreshLifetime) {
          if (cursorHideTimerRef.current) clearTimeout(cursorHideTimerRef.current);
          if (cursorFadeTimerRef.current) clearTimeout(cursorFadeTimerRef.current);
          cursorHideTimerRef.current = setTimeout(() => {
            cursorHideTimerRef.current = null;
            remotePointerLocationRef.current = null;
            setFloatingCursor((prev) => ({ ...prev, isMoving: false }));
            cursorFadeTimerRef.current = setTimeout(() => {
              cursorFadeTimerRef.current = null;
              setFloatingCursor((prev) => ({ ...prev, visible: false }));
            }, 160);
          }, 950);
        }
      } catch {
        setFloatingCursor((prev) => ({ ...prev, visible: false }));
      }
    },
    [triggerEditorRipple],
  );

  const [instructorLocation, setInstructorLocation] = useState<{
    path: string;
    line: number;
    ch: number;
  } | null>(null);

  // Keep floating cursor smoothly aligned during editor scrolling
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const scrollDom = view.scrollDOM;
    const onScroll = () => {
      const pointer = remotePointerLocationRef.current;
      const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();
      if (pointer && normalizePath(pointer.path) === normalizePath(activeFileRef.current)) {
        updateFloatingCursorCoords(pointer.path, pointer.line, pointer.ch, 'Instructor', false, false);
      }
    };
    scrollDom.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollDom.removeEventListener('scroll', onScroll);
  }, [instructorLocation, updateFloatingCursorCoords]);

  // Re-connect and invalidate stale tokens when internet is restored
  useEffect(() => {
    if (isOnline) {
      clearRealtimeToken();
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    }
  }, [isOnline]);

  // Per-user Font Size Control
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('livetich_editor_fontsize');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 11 && parsed <= 24) return parsed;
      }
    }
    return 14;
  });

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.max(11, Math.min(24, prev + delta));
      if (typeof window !== 'undefined') {
        localStorage.setItem('livetich_editor_fontsize', next.toString());
      }
      return next;
    });
  };

  // Follow Instructor vs Free Roam Mode (for students)
  const [followInstructor, setFollowInstructor] = useState<boolean>(true);
  const followInstructorRef = useRef<boolean>(true);
  useEffect(() => {
    followInstructorRef.current = followInstructor;
  }, [followInstructor]);

  // Expandable/resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('livetich_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 160 && parsed <= 650) return parsed;
      }
    }
    return 240;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);

  const startResizingSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizingSidebar(true);

      const startX = e.clientX;
      const startW = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextW = Math.max(160, Math.min(650, startW + delta));
        setSidebarWidth(nextW);
      };

      const onMouseUp = () => {
        setIsResizingSidebar(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        setSidebarWidth((finalW) => {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('livetich_sidebar_width', finalW.toString());
            } catch {}
          }
          return finalW;
        });
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [sidebarWidth],
  );

  // File tree quick search/filter
  const [treeSearch, setTreeSearch] = useState<string>('');

  // Copy Code Feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Ephemeral spotlight state
  const [laserActive, setLaserActive] = useState<boolean>(false);

  const copyCurrentFileCode = async () => {
    const content =
      viewRef.current?.state.doc.toString() ??
      fileContentsRef.current.get(activeFile) ??
      '';
    try {
      await navigator.clipboard.writeText(content);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const downloadCurrentFile = () => {
    const content =
      viewRef.current?.state.doc.toString() ??
      fileContentsRef.current.get(activeFile) ??
      '';
    const fileName = activeFile.split('/').pop() || 'file.txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const triggerSpotlight = (lineNumber?: number) => {
    if (!socketRef.current?.connected || !activeFileRef.current) return;
    const targetLine = lineNumber ?? cursorPos?.line ?? 0;
    socketRef.current.emit('code:spotlight' as unknown as keyof CodeClientToServerEvents, {
      sessionId,
      path: activeFileRef.current,
      line: targetLine,
    } as unknown as never);

    if (viewRef.current) {
      try {
        const view = viewRef.current;
        const line = Math.max(1, Math.min(targetLine + 1, view.state.doc.lines));
        const lineInfo = view.state.doc.line(line);
        view.dispatch({
          effects: [
            setSpotlightEffect.of({ line: targetLine }),
            EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
          ],
        });
        setLaserActive(true);
        setTimeout(() => {
          if (viewRef.current) {
            viewRef.current.dispatch({ effects: setSpotlightEffect.of(null) });
          }
          setLaserActive(false);
        }, 3000);
      } catch {}
    }
  };

  const filterTreeNodes = (nodes: CodeFileTreeNode[], query: string): CodeFileTreeNode[] => {
    if (!query) return nodes;
    const q = query.toLowerCase();
    const filtered: CodeFileTreeNode[] = [];
    for (const node of nodes) {
      if (node.isDirectory) {
        const matchingChildren = node.children ? filterTreeNodes(node.children, query) : [];
        if (matchingChildren.length > 0 || node.name.toLowerCase().includes(q)) {
          filtered.push({
            ...node,
            children: matchingChildren.length > 0 ? matchingChildren : node.children,
          });
        }
      } else {
        if (node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) {
          filtered.push(node);
        }
      }
    }
    return filtered;
  };

  const applyRemoteCursorAndSelection = (
    view: EditorView,
    cursor: { line: number; ch: number },
    selection?: {
      anchor: { line: number; ch: number };
      active: { line: number; ch: number };
    },
    shouldScroll: boolean = true,
  ) => {
    try {
      const doc = view.state.doc;
      const headLine = Math.max(1, Math.min(cursor.line + 1, doc.lines));
      const headInfo = doc.line(headLine);
      const headPos = Math.min(headInfo.from + cursor.ch, headInfo.to);
      let selRange: { from: number; to: number } | undefined;

      if (selection) {
        const aLine = Math.max(1, Math.min(selection.anchor.line + 1, doc.lines));
        const aInfo = doc.line(aLine);
        const anchorPos = Math.min(aInfo.from + selection.anchor.ch, aInfo.to);

        const hLine = Math.max(1, Math.min(selection.active.line + 1, doc.lines));
        const hInfo = doc.line(hLine);
        const activePos = Math.min(hInfo.from + selection.active.ch, hInfo.to);

        if (anchorPos !== activePos) {
          selRange = {
            from: Math.min(anchorPos, activePos),
            to: Math.max(anchorPos, activePos),
          };
        }
      }

      view.dispatch({
        effects: [
          setRemoteSelectionEffect.of({
            cursorPos: headPos,
            selection: selRange,
            name: 'Instructor',
          }),
          ...(shouldScroll ? [EditorView.scrollIntoView(headPos, { y: 'nearest' })] : []),
        ],
      });
    } catch {}
  };

  const normalizeFolderPath = (p: string): string => {
    return (p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  };

  const expandAncestorsOfFile = (filePath: string) => {
    const norm = normalizeFolderPath(filePath);
    if (!norm) return;
    const parts = norm.split('/');
    if (parts.length <= 1) return;

    const ancestors = new Set<string>();
    let cur = '';
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur ? `${cur}/${parts[i]}` : parts[i];
      ancestors.add(cur);
    }

    setCollapsedFolders((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const item of prev) {
        const itemNorm = normalizeFolderPath(item);
        let isAncestor = false;
        for (const anc of ancestors) {
          if (itemNorm === anc || itemNorm.endsWith('/' + anc) || anc.endsWith('/' + itemNorm)) {
            isAncestor = true;
            changed = true;
            break;
          }
        }
        if (!isAncestor) {
          next.add(item);
        }
      }
      return changed ? next : prev;
    });
  };

  const isFolderCollapsed = (folderPath: string, set: Set<string>): boolean => {
    const norm = normalizeFolderPath(folderPath);
    if (!norm) return false;
    if (set.has(norm) || set.has(folderPath)) return true;
    for (const item of set) {
      const nItem = normalizeFolderPath(item);
      if (nItem === norm) return true;
      if (norm.endsWith('/' + nItem) || nItem.endsWith('/' + norm)) {
        return true;
      }
    }
    return false;
  };

  const getAllFolderPaths = (nodes: CodeFileTreeNode[]): string[] => {
    const paths: string[] = [];
    for (const node of nodes) {
      if (node.isDirectory) {
        paths.push(normalizeFolderPath(node.path));
        if (node.children) {
          paths.push(...getAllFolderPaths(node.children));
        }
      }
    }
    return paths;
  };

  const latestExpandedRef = useRef<string[] | null>(null);

  const applyFoldersState = (expandedList: string[], currentTree: CodeFileTreeNode[]) => {
    const expandedNorms = new Set(expandedList.map(normalizeFolderPath));
    const allFolderPaths = getAllFolderPaths(currentTree);
    const nextCollapsed = new Set<string>();

    for (const fp of allFolderPaths) {
      const norm = normalizeFolderPath(fp);
      const isExp =
        expandedNorms.has(norm) ||
        Array.from(expandedNorms).some(
          (e) => e === norm || norm.endsWith('/' + e) || e.endsWith('/' + norm),
        );
      if (!isExp) {
        nextCollapsed.add(norm);
      }
    }

    setCollapsedFolders(nextCollapsed);
  };

  const collapseAllFolders = () => {
    const allPaths = getAllFolderPaths(tree);
    setCollapsedFolders(new Set(allPaths));
    if (isWritable && socketRef.current?.connected) {
      socketRef.current.emit('code:collapse-all' as unknown as keyof CodeClientToServerEvents, {
        sessionId,
        collapsed: true,
      } as unknown as never);
    }
  };

  const expandAllFolders = () => {
    setCollapsedFolders(new Set());
    if (isWritable && socketRef.current?.connected) {
      socketRef.current.emit('code:collapse-all' as unknown as keyof CodeClientToServerEvents, {
        sessionId,
        collapsed: false,
      } as unknown as never);
    }
  };

  const toggleFolder = (folderPath: string, e: React.MouseEvent, node?: CodeFileTreeNode) => {
    e.stopPropagation();
    const targetNorm = normalizeFolderPath(folderPath);
    let willCollapse = false;

    if (e.altKey && node?.children) {
      const subtreePaths = getAllFolderPaths([node]);
      setCollapsedFolders((prev) => {
        const next = new Set<string>();
        const currentlyCollapsed = isFolderCollapsed(targetNorm, prev);
        willCollapse = !currentlyCollapsed;

        for (const item of prev) {
          const itemNorm = normalizeFolderPath(item);
          const isSub = subtreePaths.some(
            (sp) => sp === itemNorm || itemNorm.endsWith('/' + sp) || sp.endsWith('/' + itemNorm),
          );
          if (!isSub) {
            next.add(itemNorm);
          }
        }

        if (willCollapse) {
          for (const sp of subtreePaths) {
            next.add(sp);
          }
        }
        return next;
      });
    } else {
      setCollapsedFolders((prev) => {
        const next = new Set<string>();
        const currentlyCollapsed = isFolderCollapsed(targetNorm, prev);
        willCollapse = !currentlyCollapsed;

        for (const item of prev) {
          const itemNorm = normalizeFolderPath(item);
          const matches =
            itemNorm === targetNorm ||
            itemNorm.endsWith('/' + targetNorm) ||
            targetNorm.endsWith('/' + itemNorm);
          if (!matches) {
            next.add(itemNorm);
          }
        }

        if (willCollapse) {
          next.add(targetNorm);
        }
        return next;
      });
    }

    if (isWritable && socketRef.current?.connected) {
      socketRef.current.emit('code:folder-toggle' as unknown as keyof CodeClientToServerEvents, {
        sessionId,
        path: targetNorm,
        collapsed: willCollapse,
      } as unknown as never);
      socketRef.current.emit('code:pointer', {
        sessionId,
        target: targetNorm,
        isFolder: true,
        surface: 'sidebar',
        isClick: true,
      });
    }
  };

  const matchesPath = (pathA?: string, pathB?: string): boolean => {
    if (!pathA || !pathB) return false;
    if (pathA === pathB) return true;
    const a = pathA.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
    const b = pathB.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
    return a === b || a.endsWith('/' + b) || b.endsWith('/' + a);
  };

  const sameCodePath = (pathA?: string, pathB?: string): boolean =>
    Boolean(pathA && pathB && normalizeFolderPath(pathA) === normalizeFolderPath(pathB));

  const activeFileRef = useRef(activeFile);

  // Whenever activeFile changes, gently scroll the tree node into view if it is visible
  useEffect(() => {
    if (!activeFile) return;
    const cleanActive = normalizeFolderPath(activeFile);
    const timer = setTimeout(() => {
      const safeId = `tree-file-${cleanActive.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const el = document.getElementById(safeId);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 150);

    return () => clearTimeout(timer);
  }, [activeFile]);

  // Permissions: Instructors always write; students write if OPEN or if DELEGATED specifically to them
  const isWritable =
    isInstructor || initialCanEdit
      ? true
      : permissionMode === 'OPEN'
        ? true
        : permissionMode === 'DELEGATED'
          ? delegatedUserIds.includes(currentUserId)
          : false;
  const canControlMirror =
    isInstructor || users.some((user) => user.userId === currentUserId && user.role === 'ORG_ADMIN');

  const ensureCursorSourceId = () => cursorSourceIdRef.current;

  const selectFile = (filePath: string, e?: React.MouseEvent) => {
    if (remotePointerLocationRef.current && !sameCodePath(remotePointerLocationRef.current.path, filePath)) {
      remotePointerLocationRef.current = null;
      setFloatingCursor((prev) => ({ ...prev, visible: false, isMoving: false }));
      if (cursorHideTimerRef.current) clearTimeout(cursorHideTimerRef.current);
      if (cursorFadeTimerRef.current) clearTimeout(cursorFadeTimerRef.current);
    }
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      triggerSidebarRipple(filePath, e.clientX - rect.left, e.clientY - rect.top);
    }
    // Keep the mutable path in step with the user's event before async editor/socket callbacks run.
    // eslint-disable-next-line react-hooks/immutability
    activeFileRef.current = filePath;
    setActiveFile(filePath);
    const nextOpenFiles = openFiles.includes(filePath) ? openFiles : [...openFiles, filePath];
    setOpenFiles(nextOpenFiles);
    setLang(detectLangFromPath(filePath));
    const cached = fileContentsRef.current.get(filePath);
    if (cached) setTotalLines(cached.split('\n').length);
    expandAncestorsOfFile(filePath);
    if (isWritable && socketRef.current?.connected) {
      socketRef.current.emit('code:pointer', {
        sessionId,
        target: filePath,
        isFolder: false,
        surface: 'sidebar',
        isClick: true,
      });
    }
    if (canControlMirror && socketRef.current?.connected) {
      socketRef.current.emit('code:focus', { sessionId, path: filePath, openFiles: nextOpenFiles });
    }
  };

  const emitCodeCursor = (
    path: string,
    line: number,
    ch: number,
    selection?: CodeCursorPayload['selection'],
  ) => {
    const socket = socketRef.current;
    if (!canControlMirror || !socket?.connected || !path) return;
    socket.emit('code:cursor', {
      sessionId,
      sourceId: ensureCursorSourceId(),
      sequence: ++cursorSequenceRef.current,
      path,
      line,
      ch,
      selection,
    });
  };

  const queueCodeCursor = (
    path: string,
    line: number,
    ch: number,
    selection?: CodeCursorPayload['selection'],
    requestedAt = 0,
  ) => {
    pendingCursorRef.current = { path, line, ch, selection };
    if (cursorSendTimerRef.current) return;
    const wait = Math.max(0, 50 - (requestedAt - lastCursorSentAtRef.current));
    cursorSendTimerRef.current = setTimeout(() => {
      cursorSendTimerRef.current = null;
      const pending = pendingCursorRef.current;
      pendingCursorRef.current = null;
      if (!pending) return;
      lastCursorSentAtRef.current = requestedAt + wait;
      emitCodeCursor(pending.path, pending.line, pending.ch, pending.selection);
    }, wait);
  };

  const clearRemoteCursor = () => {
    cursorPosRef.current = null;
    cursorPathRef.current = '';
    selectionRef.current = null;
    setCursorPos(null);
    setInstructorLocation(null);
    viewRef.current?.dispatch({ effects: setRemoteSelectionEffect.of(null) });
    setFloatingCursor((prev) => ({ ...prev, visible: false, isMoving: false }));
    remotePointerLocationRef.current = null;
    setSidebarPointer(null);
    if (cursorHideTimerRef.current) clearTimeout(cursorHideTimerRef.current);
    if (cursorFadeTimerRef.current) clearTimeout(cursorFadeTimerRef.current);
    if (sidebarPointerHideTimerRef.current) clearTimeout(sidebarPointerHideTimerRef.current);
  };

  const updatePermission = (mode: CodeWritePermissionMode, studentId?: string) => {
    const targetDelegated = studentId ? [studentId] : [];
    setPermissionMode(mode);
    setDelegatedUserIds(targetDelegated);
    setShowPermissionMenu(false);
    if (socketRef.current?.connected) {
      socketRef.current.emit('code:permission', {
        sessionId,
        mode,
        delegatedUserIds: targetDelegated,
      });
    }
  };

  const delegatedStudent = users.find((u) => delegatedUserIds.includes(u.userId));
  const studentUsers = users.filter((u) => u.role === 'STUDENT' || (u.userId !== currentUserId && !initialCanEdit));

  // ---- Doc + socket setup ----
  useEffect(() => {
    const doc = new Y.Doc();
    const meta = doc.getMap<string>('meta');
    const awareness = new Awareness(doc);
    docRef.current = doc;
    metaRef.current = meta;
    awarenessRef.current = awareness;

    const socket: CodeSocket = io(`${API_URL}/code`, {
      auth: (cb) =>
        void getRealtimeToken().then((token) => cb({ token: token ?? '' })),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    const onAwarenessUpdate = (
      changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === 'remote' || !socket.connected) return;
      const clients = [...changes.added, ...changes.updated, ...changes.removed];
      if (clients.length === 0) return;
      socket.emit('code:awareness', {
        sessionId,
        update: encodeAwarenessUpdate(awareness, clients),
      });
    };
    awareness.on('update', onAwarenessUpdate);

    let authRetries = 0;
    socket.on('connect', () => {
      authRetries = 0;
      socket.emit('code:join', { sessionId });
    });

    socket.on('code:joined' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as { sessionId?: string };
      if (payload?.sessionId !== sessionId || !canControlMirror || !viewRef.current || !activeFileRef.current) return;
      const view = viewRef.current;
      const selection = view.state.selection.main;
      const activeLine = view.state.doc.lineAt(selection.head);
      const anchorLine = view.state.doc.lineAt(selection.anchor);
      queueCodeCursor(activeFileRef.current, activeLine.number - 1, selection.head - activeLine.from, {
        anchor: { line: anchorLine.number - 1, ch: selection.anchor - anchorLine.from },
        active: { line: activeLine.number - 1, ch: selection.head - activeLine.from },
      }, performance.now());
    });

    socket.on('disconnect', (reason) => {
      clearRemoteCursor();
      if (reason === 'io server disconnect') {
        clearRealtimeToken();
        if (authRetries < 5) {
          authRetries += 1;
          setTimeout(() => {
            if (socketRef.current === socket) socket.connect();
          }, 1000);
        }
      }
    });

    socket.on('connect_error', (err) => {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('token')) {
        clearRealtimeToken();
      }
    });

    socket.on('error' as unknown as keyof CodeServerToClientEvents, (err: unknown) => {
      const parsed = typeof err === 'object' && err !== null ? (err as { code?: string }) : null;
      if (parsed?.code === 'UNAUTHORIZED' && authRetries < 5) {
        authRetries += 1;
        clearRealtimeToken();
        setTimeout(() => {
          if (socketRef.current === socket) socket.connect();
        }, 800);
      }
    });

    socket.on('code:awareness', (payload) => {
      if (payload.sessionId !== sessionId) return;
      try {
        const update = payload.update instanceof Uint8Array
          ? payload.update
          : new Uint8Array(payload.update);
        applyAwarenessUpdate(awareness, update, 'remote');
      } catch {}
    });

    const applyRemote = (u: unknown) => {
      let bytes: Uint8Array | null = null;
      if (u instanceof Uint8Array) bytes = u;
      else if (u instanceof ArrayBuffer) bytes = new Uint8Array(u);
      else if (ArrayBuffer.isView(u)) bytes = new Uint8Array(u.buffer, u.byteOffset, u.byteLength);
      else if (Array.isArray(u)) bytes = Uint8Array.from(u as number[]);
      else if (u && typeof u === 'object' && Array.isArray((u as { data?: unknown }).data)) {
        bytes = Uint8Array.from((u as { data: number[] }).data);
      }
      if (bytes) {
        // Remote Yjs edits update CodeMirror synchronously. The resulting
        // updateListener callback must not echo its mapped cursor back to the
        // IDE, where that stale position can pull the local caret backwards.
        const wasApplyingRemote = isApplyingRemoteRef.current;
        isApplyingRemoteRef.current = true;
        if (cursorSendTimerRef.current) clearTimeout(cursorSendTimerRef.current);
        cursorSendTimerRef.current = null;
        pendingCursorRef.current = null;
        try {
          Y.applyUpdate(doc, bytes, 'remote');
        } catch {}
        finally {
          isApplyingRemoteRef.current = wasApplyingRemote;
        }
      }
    };

    const refreshFileContents = () => {
      // Applying a Yjs update leaves named roots as generic AbstractType
      // instances until their typed getter is called. Materialize file roots
      // before reading them so remote IDE updates reach the editor cache.
      let changed = false;
      for (const name of doc.share.keys()) {
        if (!name.startsWith('file:') || name === 'file:initialized') continue;
        const path = name.slice('file:'.length);
        if (!path) continue;
        const content = doc.getText(name).toString();
        if (fileContentsRef.current.get(path) !== content) {
          fileContentsRef.current.set(path, content);
          changed = true;
        }
      }
      return changed;
    };

    const syncLang = () => {
      const stored = meta.get('lang');
      if (stored && stored in LANGUAGES) setLang(stored);
      else if (canControlMirror && !stored) meta.set('lang', DEFAULT_LANG);
    };
    meta.observe(syncLang);

    socket.on('code:state', (p) => {
      applyRemote(p.update);
      syncLang();
      readyRef.current = true;
      setReady(true);
    });

    socket.on('code:cursor' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as CodeCursorPayload;
      if (
        payload?.sessionId !== sessionId ||
        !payload.controllerUserId ||
        // The IDE and live editor share the instructor identity. Drawing the
        // IDE caret back over its own live editor creates a duplicate cursor.
        payload.controllerUserId === currentUserId ||
        payload.sourceId === cursorSourceIdRef.current ||
        !payload.sourceId ||
        payload.sourceId === cursorSourceIdRef.current ||
        !Number.isSafeInteger(payload.sequence)
      ) return;
      if (!isWritable && !followInstructorRef.current) return;
      const previous = latestRemoteSequencesRef.current.get(payload.sourceId) ?? 0;
      if (payload.sequence <= previous) return;
      latestRemoteSequencesRef.current.set(payload.sourceId, payload.sequence);

      if (!sameCodePath(activeFileRef.current, payload.path)) {
        if (!followInstructorRef.current && !isWritable) return;
        suppressNextCursorEmitRef.current = true;
        selectFile(payload.path);
      } else if (viewRef.current) {
        applyRemoteCursorAndSelection(viewRef.current, payload, payload.selection, followInstructorRef.current);
      }
      setCursorPos({ line: payload.line, ch: payload.ch });
      cursorPosRef.current = { line: payload.line, ch: payload.ch };
      cursorPathRef.current = payload.path;
      selectionRef.current = payload.selection ?? null;
      setInstructorLocation({ path: payload.path, line: payload.line, ch: payload.ch });
    });

    socket.on('code:update', (p) => applyRemote(p.update));

    socket.on('code:tree', (p) => {
      setTree(p.tree);
      treeRef.current = p.tree;

      if (latestExpandedRef.current !== null) {
        applyFoldersState(latestExpandedRef.current, p.tree);
      } else {
        // Initially collapse all folders so root folders mirror IDE's collapsed state
        setCollapsedFolders(new Set(getAllFolderPaths(p.tree)));
      }
    });

    socket.on('code:focus', (p: CodeFocusPayload) => {
      const freeRoamStudent =
        !isInstructor &&
        p.controllerUserId !== currentUserId &&
        !followInstructorRef.current;
      if (freeRoamStudent) return;
      if (!freeRoamStudent && Array.isArray(p.openFiles)) {
        setOpenFiles(p.openFiles);
      }

      if (!p.path) {
        // All tabs closed in instructor's IDE
        activeFileRef.current = '';
        setActiveFile('');
        setCursorPos(null);
        cursorPosRef.current = null;
        selectionRef.current = null;
        setSidebarPointer(null);
        clearRemoteCursor();
        return;
      }

      setInstructorLocation({
        path: p.path,
        line: p.cursor?.line ?? 0,
        ch: p.cursor?.ch ?? 0,
      });

      if (!freeRoamStudent) expandAncestorsOfFile(p.path);

      if (p.content !== undefined) {
        fileContentsRef.current.set(p.path, p.content);
      }

      if (!sameCodePath(activeFileRef.current, p.path)) {
        suppressNextCursorEmitRef.current = true;
        activeFileRef.current = p.path;
        setActiveFile(p.path);
      }

      if (!Array.isArray(p.openFiles)) {
        setOpenFiles((prev) => (prev.includes(p.path) ? prev : [...prev, p.path]));
      }

      setLang(detectLangFromPath(p.path));

      if (matchesPath(p.path, activeFileRef.current) && viewRef.current && p.content !== undefined) {
        const view = viewRef.current;
        const curDoc = view.state.doc.toString();
        const prevScrollTop = view.scrollDOM?.scrollTop;

        isApplyingRemoteRef.current = true;
        try {
          const change = computeMinimalChange(curDoc, p.content);
          const effects: StateEffect<unknown>[] = [];

          if (change) {
            view.dispatch({ changes: change });
          }

          if (p.cursor) {
            const headPos = getDocOffset(view.state.doc, p.cursor.line, p.cursor.ch);
            let selRange: { from: number; to: number } | undefined;
            if (p.selection) {
              const aPos = getDocOffset(view.state.doc, p.selection.anchor.line, p.selection.anchor.ch);
              const hPos = getDocOffset(view.state.doc, p.selection.active.line, p.selection.active.ch);
              if (aPos !== hPos) {
                selRange = { from: Math.min(aPos, hPos), to: Math.max(aPos, hPos) };
              }
            }

            effects.push(
              setRemoteSelectionEffect.of({
                cursorPos: headPos,
                selection: selRange,
                name: 'Instructor',
              }),
            );

            if (followInstructorRef.current) {
              effects.push(EditorView.scrollIntoView(headPos, { y: 'nearest' }));
            }
          }

          if (effects.length > 0) {
            view.dispatch({ effects });
          }
          setTotalLines(view.state.doc.lines);
          if (prevScrollTop !== undefined && view.scrollDOM) {
            view.scrollDOM.scrollTop = prevScrollTop;
          }
        } catch (err) {
          console.error('[livetich] Error applying remote focus content', err);
        } finally {
          isApplyingRemoteRef.current = false;
        }
      }
      if (p.content !== undefined) {
        setTotalLines(p.content.split('\n').length);
      }
      if (p.cursor) {
        setCursorPos(p.cursor);
        cursorPosRef.current = p.cursor;
        cursorPathRef.current = p.path;
        selectionRef.current = p.selection ?? null;
        setInstructorLocation({
          path: p.path,
          line: p.cursor.line,
          ch: p.cursor.ch,
        });
      }
    });

    socket.on('code:permission', (p: CodePermissionPayload) => {
      setPermissionMode(p.mode);
      if (Array.isArray(p.delegatedUserIds)) {
        setDelegatedUserIds(p.delegatedUserIds);
      }
    });

    socket.on('code:edit' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as { path: string; content: string; cursor?: { line: number; ch: number } };
      if (!payload?.path || payload.content === undefined) return;

      fileContentsRef.current.set(payload.path, payload.content);

      if (sameCodePath(payload.path, activeFileRef.current) && viewRef.current) {
        const view = viewRef.current;
        const curDoc = view.state.doc.toString();
        const prevScrollTop = view.scrollDOM?.scrollTop;

        isApplyingRemoteRef.current = true;
        try {
          const change = computeMinimalChange(curDoc, payload.content);
          const effects: StateEffect<unknown>[] = [];

          if (change) {
            view.dispatch({ changes: change });
          }

          if (payload.cursor) {
            const headPos = getDocOffset(view.state.doc, payload.cursor.line, payload.cursor.ch);
            effects.push(
              setRemoteSelectionEffect.of({
                cursorPos: headPos,
                name: 'Instructor',
              }),
            );

            if (followInstructorRef.current) {
              effects.push(EditorView.scrollIntoView(headPos, { y: 'nearest' }));
            }
          }

          if (effects.length > 0) {
            view.dispatch({ effects });
          }
          setTotalLines(view.state.doc.lines);
          if (prevScrollTop !== undefined && view.scrollDOM) {
            view.scrollDOM.scrollTop = prevScrollTop;
          }
        } catch (err) {
          console.error('[livetich] Error applying remote edit', err);
        } finally {
          isApplyingRemoteRef.current = false;
        }
      }
      if (payload.content !== undefined) {
        setTotalLines(payload.content.split('\n').length);
      }
      if (payload.cursor) {
        setCursorPos(payload.cursor);
        cursorPosRef.current = payload.cursor;
        cursorPathRef.current = payload.path;
        setInstructorLocation({
          path: payload.path,
          line: payload.cursor.line,
          ch: payload.cursor.ch,
        });
      }
    });

    socket.on('code:scroll' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const scrollPayload = p as { sessionId: string; path: string; line: number };
      if (!scrollPayload) return;

      // Free roam students are not forced to follow instructor's scroll
      if (!isWritable && !followInstructorRef.current) return;

      const currentActive = activeFileRef.current;
      const isMatch = sameCodePath(scrollPayload.path, currentActive);

      if (!isMatch && scrollPayload.path) {
        suppressNextCursorEmitRef.current = true;
        selectFile(scrollPayload.path);
        return;
      }

      if (viewRef.current) {
        try {
          const docLines = viewRef.current.state.doc.lines;
          const targetLine = Math.max(1, Math.min(scrollPayload.line + 1, docLines));
          const lineInfo = viewRef.current.state.doc.line(targetLine);
          viewRef.current.dispatch({
            effects: EditorView.scrollIntoView(lineInfo.from, { y: 'start' }),
          });
        } catch {}
      }
    });

    socket.on('code:folder-toggle' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as { path: string; collapsed: boolean };
      if (!payload?.path) return;
      const targetNorm = normalizeFolderPath(payload.path);
      setCollapsedFolders((prev) => {
        const next = new Set<string>();
        for (const item of prev) {
          const itemNorm = normalizeFolderPath(item);
          const matches =
            itemNorm === targetNorm ||
            itemNorm.endsWith('/' + targetNorm) ||
            targetNorm.endsWith('/' + itemNorm);
          if (!matches) {
            next.add(itemNorm);
          }
        }
        if (payload.collapsed) {
          next.add(targetNorm);
        }
        return next;
      });
    });

    socket.on('code:pointer' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as CodePointerPayload;
      if (
        !payload ||
        payload.sessionId !== sessionId ||
        !payload.controllerUserId ||
        payload.controllerUserId === currentUserId ||
        payload.sourceId === cursorSourceIdRef.current ||
        (!isWritable && !followInstructorRef.current)
      ) return;

      if (payload.surface === 'editor') {
        if (
          !payload.path ||
          !payload.sourceId ||
          !Number.isSafeInteger(payload.sequence) ||
          payload.line === undefined ||
          payload.ch === undefined
        ) return;
        const previous = latestRemoteSequencesRef.current.get(payload.sourceId) ?? 0;
        if (payload.sequence! <= previous) return;
        latestRemoteSequencesRef.current.set(payload.sourceId, payload.sequence!);
        if (!sameCodePath(payload.path, activeFileRef.current)) return;
        setInstructorLocation({ path: payload.path, line: payload.line, ch: payload.ch });
        updateFloatingCursorCoords(payload.path, payload.line, payload.ch, 'Instructor', payload.kind === 'click');
        return;
      }

      if (payload.surface !== 'sidebar') return;
      setSidebarPointer({
        target: payload.target,
        isFolder: payload.isFolder,
        x: payload.x,
        y: payload.y,
      });

      if (payload.target) {
        expandAncestorsOfFile(payload.target);
        const safeId = `${payload.isFolder ? 'tree-folder-' : 'tree-file-'}${normalizeFolderPath(payload.target).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        setTimeout(() => {
          const el = document.getElementById(safeId);
          if (el) {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            if (payload.isClick) {
              const rect = el.getBoundingClientRect();
              triggerSidebarRipple(payload.target!, rect.width / 2, rect.height / 2);
            }
          }
        }, 120);
      }
      if (sidebarPointerHideTimerRef.current) clearTimeout(sidebarPointerHideTimerRef.current);
      sidebarPointerHideTimerRef.current = setTimeout(() => setSidebarPointer(null), 1400);
    });

    socket.on('code:spotlight' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as CodeSpotlightPayload;
      if (!payload?.path) return;

      if (!sameCodePath(payload.path, activeFileRef.current)) {
        if (followInstructorRef.current) {
          suppressNextCursorEmitRef.current = true;
          selectFile(payload.path);
        }
      }

      if (viewRef.current && sameCodePath(payload.path, activeFileRef.current)) {
        try {
          const view = viewRef.current;
          const targetLine = Math.max(1, Math.min(payload.line + 1, view.state.doc.lines));
          const lineInfo = view.state.doc.line(targetLine);
          view.dispatch({
            effects: [
              setSpotlightEffect.of({ line: payload.line }),
              EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
            ],
          });
          setTimeout(() => {
            if (viewRef.current) {
              viewRef.current.dispatch({ effects: setSpotlightEffect.of(null) });
            }
          }, 3500);
        } catch {}
      }
    });

    socket.on('code:collapse-all' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as { collapsed: boolean };
      if (!payload) return;
      if (payload.collapsed) {
        setCollapsedFolders(new Set(getAllFolderPaths(treeRef.current)));
      } else {
        setCollapsedFolders(new Set());
      }
    });

    socket.on('code:folders-state' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as { expanded: string[] };
      if (!payload || !Array.isArray(payload.expanded)) return;
      latestExpandedRef.current = payload.expanded;
      applyFoldersState(payload.expanded, treeRef.current);
    });

    socket.on('code:tab-close' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as {
        path?: string;
        nextActive?: string;
        openFiles?: string[];
        all?: boolean;
        controllerUserId?: string;
      };
      if (!payload) return;
      if (
        !isInstructor &&
        payload.controllerUserId !== currentUserId &&
        !followInstructorRef.current
      ) return;
      if (payload.all) {
        setOpenFiles([]);
        setActiveFile('');
        activeFileRef.current = '';
        return;
      }
      if (payload.path) {
        if (Array.isArray(payload.openFiles)) {
          setOpenFiles(payload.openFiles);
        } else {
          setOpenFiles((prev) => prev.filter((f) => !matchesPath(f, payload.path!) && f !== payload.path));
        }
        if (payload.nextActive !== undefined) {
          setActiveFile(payload.nextActive);
          activeFileRef.current = payload.nextActive;
          if (payload.nextActive) setLang(detectLangFromPath(payload.nextActive));
        }
      }
    });

    socket.on('code:tab-close-result' as unknown as keyof CodeServerToClientEvents, (p: unknown) => {
      const payload = p as {
        sessionId?: string;
        requestId?: string;
        activePath?: string;
        openFiles?: string[];
        controllerUserId?: string;
      };
      if (
        payload?.sessionId !== sessionId ||
        !payload.requestId ||
        !Array.isArray(payload.openFiles) ||
        !payload.controllerUserId
      ) return;
      if (!isInstructor && payload.controllerUserId !== currentUserId && !followInstructorRef.current) return;
      if (canControlMirror && latestTabCloseRequestRef.current !== payload.requestId) return;

      const actualActive = payload.activePath ?? '';
      setOpenFiles(payload.openFiles);
      setActiveFile(actualActive);
      activeFileRef.current = actualActive;
      if (actualActive) setLang(detectLangFromPath(actualActive));
      if (payload.requestId === latestTabCloseRequestRef.current) {
        latestTabCloseRequestRef.current = null;
      }
    });

    socketRef.current = socket;

    const initTimer = setTimeout(() => {
      if (!readyRef.current) {
        readyRef.current = true;
        setReady(true);
        syncLang();
      }
    }, 1200);

    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (refreshFileContents()) {
        if (previewReloadTimerRef.current) clearTimeout(previewReloadTimerRef.current);
        previewReloadTimerRef.current = setTimeout(() => {
          previewReloadTimerRef.current = null;
          setPreviewReloadSignal((value) => value + 1);
        }, 750);
      }
      if (origin !== 'remote') socket.emit('code:update', { sessionId, update });
    };
    doc.on('update', onDocUpdate);

    return () => {
      clearTimeout(initTimer);
      if (previewReloadTimerRef.current) clearTimeout(previewReloadTimerRef.current);
      previewReloadTimerRef.current = null;
      if (cursorSendTimerRef.current) clearTimeout(cursorSendTimerRef.current);
      if (cursorHideTimerRef.current) clearTimeout(cursorHideTimerRef.current);
      if (cursorFadeTimerRef.current) clearTimeout(cursorFadeTimerRef.current);
      if (sidebarPointerHideTimerRef.current) clearTimeout(sidebarPointerHideTimerRef.current);
      cursorSendTimerRef.current = null;
      cursorHideTimerRef.current = null;
      cursorFadeTimerRef.current = null;
      sidebarPointerHideTimerRef.current = null;
      pendingCursorRef.current = null;
      meta.unobserve(syncLang);
      awareness.off('update', onAwarenessUpdate);
      doc.off('update', onDocUpdate);
      socket.emit('code:leave', { sessionId });
      socket.disconnect();
      viewRef.current?.destroy();
      viewRef.current = null;
      awareness.destroy();
      doc.destroy();
    };
  }, [sessionId, initialCanEdit, canControlMirror]);

  // ---- Editor view rebuild ----
  useEffect(() => {
    const host = hostRef.current;
    const doc = docRef.current;
    const awareness = awarenessRef.current;
    if (!ready || !host || !doc || !awareness) return;

    // Use specific Y.Text for active file (with fallback to default 'code' buffer)
    const yText = doc.getText(`file:${activeFile}`) || doc.getText('code');
    const initialDoc = yText.toString();

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      indentOnInput(),
      yCollab(yText, awareness),
      remoteCursorField,
      spotlightField,
      diffFlashField,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      oneDark,
      langExtension(lang),
      EditorView.editable.of(isWritable),
      EditorState.readOnly.of(!isWritable),
      EditorView.theme({
        '&': { height: '100%', fontSize: `${fontSize}px` },
        '.cm-scroller': {
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
        },
        '.cm-remote-selection': {
          backgroundColor: 'rgba(16, 185, 129, 0.3) !important',
          borderRadius: '3px',
          boxShadow: '0 0 8px rgba(16, 185, 129, 0.25)',
        },
        '.cm-remote-spotlight': {
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.45) 0%, rgba(245, 158, 11, 0.15) 60%, transparent 100%) !important',
          borderLeft: '4px solid #f59e0b !important',
          boxShadow: 'inset 0 0 16px rgba(245, 158, 11, 0.25)',
          animation: 'cm-spotlight-pulse 2s ease-in-out infinite',
        },
        '.cm-remote-diff-flash': {
          backgroundColor: 'rgba(16, 185, 129, 0.25) !important',
          transition: 'background-color 1.5s ease-out',
        },
        '.cm-remote-cursor-wrap': {
          position: 'relative',
          display: 'inline-block',
          width: '0',
          height: '1.2em',
          verticalAlign: 'text-bottom',
          pointerEvents: 'none',
        },
        '.cm-remote-cursor-caret': {
          position: 'absolute',
          top: '0px',
          left: '0px',
          display: 'block',
          width: '2px',
          height: '100%',
          backgroundColor: '#10b981',
          boxShadow: '0 0 8px #10b981, 0 0 2px #34d399',
          borderRadius: '1px',
          animation: 'cm-caret-blink 1.2s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: '90',
        },
        '.cm-remote-cursor-label': {
          position: 'absolute',
          top: '-0.3em',
          left: '14px',
          backgroundColor: '#10b981',
          color: '#022c22',
          fontSize: '9.5px',
          fontWeight: '700',
          padding: '1px 5px',
          borderRadius: '3px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
          zIndex: '101',
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          setTotalLines(update.state.doc.lines);
        }
        if (update.selectionSet || update.docChanged) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          const pos = { line: line.number - 1, ch: head - line.from };
          setCursorPos(pos);
          cursorPosRef.current = pos;
          cursorPathRef.current = activeFile;
          const selection = update.state.selection.main;
          localCursorByPathRef.current.set(activeFile, { anchor: selection.anchor, head: selection.head });
          if (canControlMirror) {
            const anchorInfo = update.state.doc.lineAt(selection.anchor);
            const activeInfo = update.state.doc.lineAt(selection.head);
            if (!isApplyingRemoteRef.current && !suppressNextCursorEmitRef.current) {
              queueCodeCursor(activeFile, pos.line, pos.ch, {
                anchor: { line: anchorInfo.number - 1, ch: selection.anchor - anchorInfo.from },
                active: { line: activeInfo.number - 1, ch: selection.head - activeInfo.from },
              }, performance.now());
            }
          }
        }
        if (update.docChanged && activeFile) {
          fileContentsRef.current.set(activeFile, update.state.doc.toString());
          const remotePointer = remotePointerLocationRef.current;
      if (remotePointer && sameCodePath(remotePointer.path, activeFile)) {
            requestAnimationFrame(() => {
              if (remotePointerLocationRef.current === remotePointer) {
                updateFloatingCursorCoords(remotePointer.path, remotePointer.line, remotePointer.ch, 'Instructor', false, false);
              }
            });
          }
        }
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({
        doc: initialDoc,
        selection: (() => {
          const saved = localCursorByPathRef.current.get(activeFile);
          if (!saved) return undefined;
          return {
            anchor: Math.max(0, Math.min(saved.anchor, initialDoc.length)),
            head: Math.max(0, Math.min(saved.head, initialDoc.length)),
          };
        })(),
        extensions,
      }),
      parent: host,
    });
    viewRef.current = view;
    setTotalLines(view.state.doc.lines);
    const skipCursorEcho = suppressNextCursorEmitRef.current;
    suppressNextCursorEmitRef.current = false;
    if (canControlMirror && !skipCursorEcho) {
      const selection = view.state.selection.main;
      const activeLine = view.state.doc.lineAt(selection.head);
      const anchorLine = view.state.doc.lineAt(selection.anchor);
      queueCodeCursor(activeFile, activeLine.number - 1, selection.head - activeLine.from, {
        anchor: { line: anchorLine.number - 1, ch: selection.anchor - anchorLine.from },
        active: { line: activeLine.number - 1, ch: selection.head - activeLine.from },
      }, performance.now());
    }

    // Restore cursor position and scroll into view when view is rebuilt for activeFile
    if (cursorPosRef.current && sameCodePath(cursorPathRef.current, activeFile)) {
      applyRemoteCursorAndSelection(view, cursorPosRef.current, selectionRef.current ?? undefined, followInstructorRef.current);
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ready, lang, isWritable, activeFile, fontSize, canControlMirror]);

  const handleEditorPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canControlMirror || !socketRef.current?.connected || !viewRef.current || !hostRef.current) return;
    if (event.pointerType === 'touch' || !hostRef.current.contains(event.target as Node)) return;
    const now = performance.now();
    if (now - lastPointerSentAtRef.current < 50) return;
    const offset = viewRef.current.posAtCoords({ x: event.clientX, y: event.clientY });
    if (offset === null) return;
    lastPointerSentAtRef.current = now;
    const lineInfo = viewRef.current.state.doc.lineAt(offset);
    socketRef.current.emit('code:pointer', {
      sessionId,
      sourceId: ensureCursorSourceId(),
      sequence: ++cursorSequenceRef.current,
      path: activeFileRef.current,
      surface: 'editor',
      kind: 'move',
      line: lineInfo.number - 1,
      ch: offset - lineInfo.from,
    });
  };

  const closeFileTab = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const filtered = openFiles.filter((f) => !matchesPath(f, filePath) && f !== filePath);
    setOpenFiles(filtered);
    let nextActive = activeFile;
    if (matchesPath(activeFile, filePath) || activeFile === filePath) {
      nextActive = filtered.length > 0 ? filtered[filtered.length - 1] : '';
      // Update synchronously so immediately queued socket events use the new tab.
      // eslint-disable-next-line react-hooks/immutability
      activeFileRef.current = nextActive;
      setActiveFile(nextActive);
      if (nextActive) {
        setLang(detectLangFromPath(nextActive));
      }
    }
    // Broadcast tab closure to session so connected students and local IDE mirror tab state
    if (canControlMirror && socketRef.current?.connected) {
      const requestId = crypto.randomUUID();
      latestTabCloseRequestRef.current = requestId;
      socketRef.current.emit('code:tab-close' as unknown as keyof CodeClientToServerEvents, {
        sessionId,
        requestId,
        path: filePath,
        nextActive,
        openFiles: filtered,
        all: filtered.length === 0,
      } as unknown as never);
    }
  };

  const getFileIcon = (fileName: string, isSelected: boolean) => {
    const lower = fileName.toLowerCase();
    const ext = fileName.split('.').pop()?.toLowerCase();
    const baseColor = isSelected ? 'text-emerald-400' : 'text-neutral-400';

    if (lower === 'dockerfile' || lower.includes('docker-compose')) {
      return <PiCube size={13} className={isSelected ? 'text-emerald-400' : 'text-sky-400'} />;
    }
    if (lower.includes('.git')) {
      return <PiGitBranch size={13} className={isSelected ? 'text-emerald-400' : 'text-orange-400'} />;
    }
    if (ext === 'prisma') {
      return <PiDatabase size={13} className={isSelected ? 'text-emerald-400' : 'text-emerald-400'} />;
    }
    if (['ts', 'tsx'].includes(ext || '')) {
      return <PiFileCode size={13} className={isSelected ? 'text-emerald-400' : 'text-sky-400'} />;
    }
    if (['js', 'jsx', 'mjs', 'cjs'].includes(ext || '')) {
      return <PiFileCode size={13} className={isSelected ? 'text-emerald-400' : 'text-yellow-400'} />;
    }
    if (['json', 'yml', 'yaml', 'toml', 'env'].includes(ext || '') || lower.startsWith('.env')) {
      return <PiGear size={13} className={isSelected ? 'text-emerald-400' : 'text-amber-400'} />;
    }
    if (['md', 'txt', 'html', 'css'].includes(ext || '')) {
      return <PiFileText size={13} className={isSelected ? 'text-emerald-400' : 'text-emerald-400/80'} />;
    }
    return <PiFile size={13} className={baseColor} />;
  };

  // Render file tree recursively
  const renderTreeNodes = (nodes: CodeFileTreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const isDir = node.isDirectory;
      const isCollapsed = isFolderCollapsed(node.path, collapsedFolders);
      const isSelected =
        activeFile === node.path ||
        activeFile.endsWith('/' + node.path) ||
        node.path.endsWith('/' + activeFile);

      const normNodePath = normalizeFolderPath(node.path);

      const isFolderTarget = Boolean(
        isDir &&
          sidebarPointer?.isFolder &&
          sidebarPointer?.target &&
          (normalizeFolderPath(sidebarPointer.target) === normNodePath ||
            normalizeFolderPath(sidebarPointer.target).endsWith('/' + normNodePath) ||
            normNodePath.endsWith('/' + normalizeFolderPath(sidebarPointer.target))),
      );

      const isFileTarget = Boolean(
        !isDir &&
          sidebarPointer &&
          !sidebarPointer.isFolder &&
          sidebarPointer.target &&
          (normalizeFolderPath(sidebarPointer.target) === normNodePath ||
            normalizeFolderPath(sidebarPointer.target).endsWith('/' + normNodePath) ||
            normNodePath.endsWith('/' + normalizeFolderPath(sidebarPointer.target))),
      );

      const containsActiveFile = Boolean(
        isDir &&
          activeFile &&
          (normalizeFolderPath(activeFile).startsWith(normNodePath + '/') ||
            normalizeFolderPath(activeFile) === normNodePath ||
            normalizeFolderPath(activeFile).includes('/' + normNodePath + '/')),
      );

      if (isDir) {
        const isRootFolder = depth === 0 && tree.length > 1;

        return (
          <div key={node.path} className="flex flex-col select-none relative group">
            <div
              id={`tree-folder-${normNodePath.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
              onClick={(e) => toggleFolder(node.path, e, node)}
              style={{ paddingLeft: `${depth * 12 + 6}px` }}
              className={`flex items-center gap-1.5 py-1 text-xs cursor-pointer transition relative overflow-hidden active:scale-[0.985] duration-150 ${
                isFolderTarget
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border-l-2 border-l-emerald-400'
                  : isRootFolder
                  ? 'font-bold uppercase tracking-wider text-neutral-300 hover:text-white bg-white/5 py-1.5 my-0.5'
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/5'
              }`}
            >
              {activeRippleRow?.path === normNodePath && (
                <span
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/80 bg-emerald-400/25 z-20"
                  style={{
                    left: activeRippleRow.x,
                    top: activeRippleRow.y,
                    width: '32px',
                    height: '32px',
                    animation: 'editor-click-ring 500ms cubic-bezier(0.1, 0.9, 0.2, 1) forwards',
                  }}
                />
              )}
              {isCollapsed ? (
                <PiCaretRight size={12} className="text-neutral-500 shrink-0" />
              ) : (
                <PiCaretDown size={12} className="text-neutral-500 shrink-0" />
              )}
              {isCollapsed ? (
                <PiFolder size={14} className={isRootFolder ? 'text-amber-400' : 'text-amber-400/80'} />
              ) : (
                <PiFolderOpen size={14} className={isRootFolder ? 'text-amber-400' : 'text-amber-400/80'} />
              )}
              <span className="truncate">{node.name}</span>

              {isFolderTarget && (
                <span
                  className="shrink-0 relative inline-flex items-center pointer-events-none transition-all duration-200 animate-in zoom-in-75 slide-in-from-left-2"
                  style={{ filter: 'drop-shadow(0 2px 6px rgba(16, 185, 129, 0.6))' }}
                >
                  <span className="absolute -inset-1 rounded-full bg-emerald-400/30 animate-ping" />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <path
                      d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"
                      fill="#10b981"
                      stroke="#064e3b"
                      strokeWidth="1.5"
                    />
                  </svg>
                </span>
              )}

              {isCollapsed && containsActiveFile && !isFolderTarget && (
                <span className="ml-auto mr-1 flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>active inside</span>
                </span>
              )}
            </div>
            {!isCollapsed && node.children && renderTreeNodes(node.children, depth + 1)}
          </div>
        );
      }

      return (
        <div key={node.path} className="relative group">
          <button
            id={`tree-file-${normNodePath.replace(/[^a-zA-Z0-9_-]/g, '_')}`}
            onClick={(e) => selectFile(node.path, e)}
            style={{ paddingLeft: `${depth * 12 + 18}px` }}
            className={`flex w-full items-center justify-between py-1 text-xs text-left transition select-none pr-2.5 relative overflow-hidden active:scale-[0.985] duration-150 ${
              isSelected
                ? 'bg-emerald-500/20 text-emerald-400 font-semibold border-l-2 border-l-emerald-400'
                : isFileTarget
                ? 'bg-emerald-500/10 text-emerald-300 border-l-2 border-l-emerald-400/70'
                : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
            }`}
          >
            {activeRippleRow?.path === node.path && (
              <span
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/80 bg-emerald-400/25 z-20"
                style={{
                  left: activeRippleRow.x,
                  top: activeRippleRow.y,
                  width: '32px',
                  height: '32px',
                  animation: 'editor-click-ring 500ms cubic-bezier(0.1, 0.9, 0.2, 1) forwards',
                }}
              />
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              {getFileIcon(node.name, isSelected || isFileTarget)}
              <span className="truncate">{node.name}</span>
              {isFileTarget && (
                <span
                  className="shrink-0 relative inline-flex items-center pointer-events-none transition-all duration-200 animate-in zoom-in-75 slide-in-from-left-2"
                  style={{ filter: 'drop-shadow(0 2px 6px rgba(16, 185, 129, 0.6))' }}
                >
                  <span className="absolute -inset-1 rounded-full bg-emerald-400/30 animate-ping" />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <path
                      d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"
                      fill="#10b981"
                      stroke="#064e3b"
                      strokeWidth="1.5"
                    />
                  </svg>
                </span>
              )}
            </div>
          </button>
        </div>
      );
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl">
      {/* Top Header Bar */}
      <div className="flex h-11 items-center justify-between border-b border-white/8 bg-[#161b22] px-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowFileTree(!showFileTree)}
            title={showFileTree ? 'Hide File Explorer' : 'Show File Explorer'}
            className={`rounded p-1 text-neutral-400 transition hover:bg-white/5 hover:text-white ${
              showFileTree ? 'text-emerald-400 bg-white/5' : ''
            }`}
          >
            <PiSidebarSimple size={16} />
          </button>

          {/* Surface Mode Switcher */}
          <div className="flex items-center rounded-lg bg-black/30 p-0.5 border border-white/8 shrink-0">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition ${
                activeTab === 'editor' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <PiCode size={14} className="text-emerald-400" />
              <span>Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition ${
                activeTab === 'terminal' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <PiTerminal size={14} className="text-emerald-400" />
              <span>Terminal</span>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition ${
                activeTab === 'preview' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <PiGlobe size={14} className="text-emerald-400" />
              <span>Web Preview</span>
            </button>
          </div>

          {/* Student Follow / Free Roam Switch */}
          {!isWritable && (
            <button
              onClick={() => {
                const nextFollowing = !followInstructorRef.current;
                followInstructorRef.current = nextFollowing;
                setFollowInstructor(nextFollowing);
                if (!nextFollowing) {
                  clearRemoteCursor();
                }
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition border shrink-0 ${
                followInstructor
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-sm'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
              }`}
              title={
                followInstructor
                  ? "Following instructor's view automatically. Click to free roam."
                  : 'Free roaming. Click to follow instructor.'
              }
            >
              {followInstructor ? (
                <PiTarget size={13} className="text-emerald-400" />
              ) : (
                <PiCompass size={13} className="text-amber-400" />
              )}
              <span className="hidden sm:inline">
                {followInstructor ? 'Following' : 'Free Roam'}
              </span>
            </button>
          )}

          {/* Instructor Spotlight Button */}
          {isWritable && (
            <button
              onClick={() => triggerSpotlight()}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition border shrink-0 ${
                laserActive
                  ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
              }`}
              title="Spotlight current line across all students' screens"
            >
              <PiLightning size={13} className="text-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Spotlight</span>
            </button>
          )}
        </div>

        {/* Right Info: Font Zoom, Permission pill & IDE deep links */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Per-user Font Size Zoom Controls */}
          <div className="flex items-center rounded-lg bg-black/40 border border-white/8 px-1 py-0.5 text-xs text-neutral-300">
            <button
              onClick={() => changeFontSize(-1)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 hover:text-white transition font-mono text-[11px]"
              title="Decrease editor font size"
            >
              A-
            </button>
            <span className="px-1.5 text-[10px] font-mono text-neutral-400 font-semibold select-none">
              {fontSize}px
            </span>
            <button
              onClick={() => changeFontSize(1)}
              className="px-1.5 py-0.5 rounded hover:bg-white/10 hover:text-white transition font-mono text-[11px]"
              title="Increase editor font size"
            >
              A+
            </button>
          </div>

          {/* Permission Mode Indicator & Instructor Control */}
          <div className="relative">
            {isInstructor || initialCanEdit ? (
              <div>
                <button
                  onClick={() => setShowPermissionMenu((prev) => !prev)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition shadow-sm ${
                    permissionMode === 'INSTRUCTOR_ONLY'
                      ? 'bg-neutral-800/90 text-neutral-300 border-white/10 hover:border-white/20 hover:bg-neutral-800'
                      : permissionMode === 'DELEGATED'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25 ring-1 ring-emerald-500/20'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
                  }`}
                  title="Manage collaborative editing permissions"
                >
                  {permissionMode === 'INSTRUCTOR_ONLY' && (
                    <>
                      <PiLockSimple size={12} className="text-neutral-400" />
                      <span>Instructor Only</span>
                    </>
                  )}
                  {permissionMode === 'DELEGATED' && (
                    <>
                      <PiUserCheck size={13} className="text-emerald-400" />
                      <span>Delegated: {delegatedStudent?.name || '1 Student'}</span>
                    </>
                  )}
                  {permissionMode === 'OPEN' && (
                    <>
                      <PiLockSimpleOpen size={12} className="text-amber-400" />
                      <span>Co-Edit Open</span>
                    </>
                  )}
                  <PiCaretDown size={10} className="text-neutral-400 ml-0.5" />
                </button>

                {/* Dropdown Menu */}
                {showPermissionMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowPermissionMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-white/10 bg-[#161b22] p-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-1 text-xs">
                      <div className="px-2 py-1.5 font-semibold text-neutral-400 text-[10.5px] uppercase tracking-wider border-b border-white/5 mb-1.5">
                        Co-Edit Permissions
                      </div>

                      {/* Option 1: Instructor Only (Default) */}
                      <button
                        onClick={() => updatePermission('INSTRUCTOR_ONLY')}
                        className={`w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                          permissionMode === 'INSTRUCTOR_ONLY'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'text-neutral-300 hover:bg-white/5'
                        }`}
                      >
                        <PiLockSimple size={15} className="shrink-0 mt-0.5 text-neutral-400" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">Instructor Only</span>
                            {permissionMode === 'INSTRUCTOR_ONLY' && (
                              <PiCheck size={13} className="text-emerald-400" />
                            )}
                          </div>
                          <p className="text-[10.5px] text-neutral-400 leading-tight mt-0.5">
                            Default mode. Students have view-only access.
                          </p>
                        </div>
                      </button>

                      {/* Option 2: Delegate to a Student */}
                      <div className="mt-1 border-t border-white/5 pt-1.5">
                        <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                          <div className="flex items-center gap-1.5">
                            <PiUser size={13} className="text-emerald-400" />
                            <span>Delegate to One Student</span>
                          </div>
                          {permissionMode === 'DELEGATED' && (
                            <span className="text-[9.5px] font-bold text-emerald-400 uppercase">Active</span>
                          )}
                        </div>

                        {studentUsers.length === 0 ? (
                          <div className="px-2.5 py-2 text-[11px] text-neutral-500 italic">
                            No students connected to room yet
                          </div>
                        ) : (
                          <div className="max-h-36 overflow-y-auto space-y-0.5 mt-1 pr-1">
                            {studentUsers.map((st) => {
                              const isSelected =
                                permissionMode === 'DELEGATED' && delegatedUserIds.includes(st.userId);
                              return (
                                <button
                                  key={st.userId}
                                  onClick={() => updatePermission('DELEGATED', st.userId)}
                                  className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition ${
                                    isSelected
                                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                                      : 'text-neutral-300 hover:bg-white/5'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
                                      style={{ backgroundColor: avatarColor(st.name) }}
                                    >
                                      {initials(st.name)}
                                    </span>
                                    <span className="truncate text-[11.5px]">{st.name}</span>
                                  </div>
                                  {isSelected && <PiCheck size={13} className="text-emerald-400 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Option 3: Open to All Students */}
                      <div className="mt-1 border-t border-white/5 pt-1">
                        <button
                          onClick={() => updatePermission('OPEN')}
                          className={`w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                            permissionMode === 'OPEN'
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'text-neutral-300 hover:bg-white/5'
                          }`}
                        >
                          <PiLockSimpleOpen size={15} className="shrink-0 mt-0.5 text-amber-400" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">Open to Entire Class</span>
                              {permissionMode === 'OPEN' && (
                                <PiCheck size={13} className="text-amber-400" />
                              )}
                            </div>
                            <p className="text-[10.5px] text-neutral-400 leading-tight mt-0.5">
                              All connected students can edit simultaneously.
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Student view of current permissions */
              <div className="flex items-center">
                {isWritable ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)] animate-pulse">
                    <PiUserCheck size={13} />
                    <span>You Have Edit Access</span>
                  </span>
                ) : permissionMode === 'DELEGATED' ? (
                  <span className="flex items-center gap-1 rounded-full bg-neutral-800/80 px-2.5 py-0.5 text-[11px] font-medium text-neutral-400 border border-white/5 hidden md:inline-flex">
                    <PiLockSimple size={12} />
                    <span>Delegated: {delegatedStudent?.name || '1 Student'}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-neutral-800/80 px-2.5 py-0.5 text-[11px] font-medium text-neutral-400 border border-white/5 hidden md:inline-flex">
                    <PiLockSimple size={12} />
                    <span>Instructor Only</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Open in Antigravity or VS Code */}
          {!isOnline && (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/25">
              <PiWifiSlash size={11} />
              <span>Offline</span>
            </span>
          )}

          <button
            onClick={() => {
              window.open(`antigravity://UsmanAdenekan.livetich/join?sessionId=${sessionId}`, '_blank');
            }}
            title="Open in Google Antigravity IDE"
            className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/5 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:bg-white/10 hover:text-white transition hidden sm:inline-flex"
          >
            <span>Antigravity</span>
            <PiArrowSquareOut size={12} />
          </button>

          <button
            onClick={() => {
              window.open(`vscode://UsmanAdenekan.livetich/join?sessionId=${sessionId}`, '_blank');
            }}
            title="Open and connect in Visual Studio Code"
            className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/5 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:bg-white/10 hover:text-white transition hidden sm:inline-flex"
          >
            <span>VS Code</span>
            <PiArrowSquareOut size={12} />
          </button>
        </div>
      </div>

      {/* Offline Notification Banner */}
      {!isOnline && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-gradient-to-r from-amber-950/80 via-[#181308] to-amber-950/80 px-3.5 py-1.5 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <PiWifiSlash size={14} className="text-amber-400 animate-pulse shrink-0" />
            <span className="font-semibold text-amber-300">You are currently offline.</span>
            <span className="text-amber-200/80 hidden sm:inline">
              Collaborative code changes will automatically sync once your connection is restored.
            </span>
          </div>
          <button
            onClick={() => {
              clearRealtimeToken();
              if (socketRef.current) socketRef.current.connect();
            }}
            className="shrink-0 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30 transition border border-amber-500/30"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Main Surface Body */}
      {activeTab === 'preview' ? (
        <PortPreviewView sessionId={sessionId} reloadSignal={previewReloadSignal} />
      ) : activeTab === 'terminal' ? (
        <TerminalView sessionId={sessionId} canEdit={isWritable} />
      ) : (
        /* Editor Mode (with optional Split Terminal) */
        <div className="flex flex-1 overflow-hidden relative">
          {/* Mobile Backdrop for Sidebar */}
          {showFileTree && (
            <div
              onClick={() => setShowFileTree(false)}
              className="fixed inset-0 z-30 bg-black/60 md:hidden backdrop-blur-xs"
            />
          )}

          {/* File Tree Drawer */}
          {showFileTree && (
            <div className="relative flex shrink-0 h-full">
              <aside
                style={{ width: `${sidebarWidth}px` }}
                className="border-r border-white/8 bg-[#11161d] overflow-y-auto font-mono flex flex-col shrink-0 md:relative fixed inset-y-0 left-0 z-40 shadow-2xl md:shadow-none"
              >
                {/* Explorer Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#161b22]/70 sticky top-0 z-10 select-none backdrop-blur-sm">
                  <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                    Explorer
                  </span>
                  {tree.length > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={collapseAllFolders}
                        title="Collapse All Folders in Explorer"
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition"
                      >
                        <VscCollapseAll size={14} />
                      </button>
                      <button
                        onClick={expandAllFolders}
                        title="Expand All Folders"
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition"
                      >
                        <PiArrowsOutSimple size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick Search / Filter Input */}
                {tree.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5 bg-[#0d1117]/80">
                    <PiMagnifyingGlass size={12} className="text-neutral-500 shrink-0" />
                    <input
                      type="text"
                      value={treeSearch}
                      onChange={(e) => setTreeSearch(e.target.value)}
                      placeholder="Filter files..."
                      className="w-full bg-transparent text-[11px] font-mono text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
                    />
                    {treeSearch && (
                      <button
                        onClick={() => setTreeSearch('')}
                        className="p-0.5 text-neutral-500 hover:text-white transition"
                      >
                        <PiX size={12} />
                      </button>
                    )}
                  </div>
                )}

                <div className="py-1">
                  {tree.length === 0 ? (
                    <div className="p-4 text-center text-xs text-neutral-500 italic">
                      Waiting for workspace files...
                    </div>
                  ) : (
                    (() => {
                      const filtered = filterTreeNodes(tree, treeSearch);
                      if (filtered.length === 0) {
                        return (
                          <div className="p-4 text-center text-xs text-neutral-500 italic">
                            No matching files found
                          </div>
                        );
                      }
                      return renderTreeNodes(filtered);
                    })()
                  )}
                </div>
              </aside>

              {/* Drag Resize Handle */}
              <div
                onMouseDown={startResizingSidebar}
                onDoubleClick={() => {
                  setSidebarWidth(240);
                  try {
                    localStorage.setItem('livetich_sidebar_width', '240');
                  } catch {}
                }}
                title="Drag to resize sidebar width (double-click to reset)"
                className="hidden md:block absolute top-0 -right-1 w-2 h-full cursor-col-resize hover:bg-emerald-500/60 active:bg-emerald-500 transition-colors z-50 group hover:w-2"
              />
            </div>
          )}

          {isResizingSidebar && (
            <div className="fixed inset-0 z-[999] cursor-col-resize select-none" />
          )}

          {/* Editor + Drawer Layout */}
          <div className="flex flex-1 flex-col overflow-hidden relative">
            {/* File Tabs Bar */}
            <div className="flex h-9 items-center overflow-x-auto border-b border-white/8 bg-[#090c10] px-2 font-mono text-xs">
              {openFiles.length === 0 ? (
                <div className="px-3 py-1.5 text-neutral-500 italic text-[11px] select-none">
                  No files open
                </div>
              ) : (
                openFiles.map((f) => {
                  const isSelected = f === activeFile;
                  return (
                    <div
                      key={f}
                      onClick={() => selectFile(f)}
                      className={`group flex items-center gap-2 border-r border-white/5 px-3 py-1.5 cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#0d1117] text-emerald-400 font-semibold border-t-2 border-t-emerald-400'
                          : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                      }`}
                    >
                      <PiFileCode size={13} />
                      <span>{f.split('/').pop()}</span>
                      <button
                        type="button"
                        onClick={(e) => closeFileTab(f, e)}
                        title={`Close ${f.split('/').pop()}`}
                        className="ml-1 rounded p-0.5 text-neutral-400 hover:bg-white/15 hover:text-white transition opacity-60 group-hover:opacity-100 flex items-center justify-center shrink-0"
                      >
                        <PiX size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Breadcrumb Bar + Quick Action Tools */}
            {activeFile && (
              <div className="flex h-8 items-center justify-between border-b border-white/5 bg-[#11161d]/90 px-3 font-mono text-[11px] select-none backdrop-blur-sm">
                {/* Left: Breadcrumbs */}
                <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 mr-2 text-neutral-400">
                  <span className="text-neutral-500 hover:text-neutral-300 transition">root</span>
                  {activeFile.split('/').map((seg, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    return (
                      <span key={idx} className="flex items-center gap-1.5 shrink-0">
                        <span className="text-neutral-600">/</span>
                        <span
                          className={
                            isLast
                              ? 'text-emerald-400 font-semibold'
                              : 'hover:text-neutral-200 transition'
                          }
                        >
                          {seg}
                        </span>
                      </span>
                    );
                  })}
                </div>

                {/* Right: Quick actions (Language tag, Line count, Copy code, Download file) */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Language Pill */}
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase border border-emerald-500/20">
                    {lang}
                  </span>

                  {/* Live Line and Col + Total Lines */}
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    {cursorPos && (
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Ln {cursorPos.line + 1}, Col {cursorPos.ch + 1}</span>
                      </span>
                    )}
                    <span className="text-neutral-500 hidden sm:inline">
                      {totalLines} {totalLines === 1 ? 'line' : 'lines'}
                    </span>
                  </div>

                  <div className="h-3.5 w-px bg-white/10 mx-0.5 hidden sm:block" />

                  {/* Copy Code */}
                  <button
                    onClick={copyCurrentFileCode}
                    title="Copy full file code to clipboard"
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-neutral-400 hover:text-white hover:bg-white/10 transition"
                  >
                    {copiedCode ? (
                      <>
                        <PiCheck size={12} className="text-emerald-400" />
                        <span className="text-emerald-400 font-semibold text-[10px]">Copied</span>
                      </>
                    ) : (
                      <>
                        <PiCopy size={12} />
                        <span className="text-[10px] hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>

                  {/* Download File */}
                  <button
                    onClick={downloadCurrentFile}
                    title="Download this file locally"
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-neutral-400 hover:text-white hover:bg-white/10 transition"
                  >
                    <PiDownloadSimple size={12} />
                    <span className="text-[10px] hidden sm:inline">Download</span>
                  </button>
                </div>
              </div>
            )}

            {/* Editor Area / Empty State */}
            {openFiles.length === 0 || !activeFile ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-8 select-none text-neutral-500">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 mb-3 text-neutral-400 shadow-inner">
                  <PiCode size={22} />
                </div>
                <p className="text-sm font-medium text-neutral-300">No editor open</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                  Instructor has closed all active files. Waiting for instructor to open a file...
                </p>
              </div>
            ) : (
              /* CodeMirror Lines Area with Google-grade smooth cursor glide and radiant click ripples */
              <div
                onPointerMove={handleEditorPointerMove}
                onClick={(e) => {
                  if (!hostRef.current) return;
                  const rect = hostRef.current.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;

                  // Local click shockwave
                  triggerEditorRipple(x, y);

                  // If instructor, broadcast click shockwave to all students
                  if (isWritable && socketRef.current?.connected && viewRef.current) {
                    const pos = viewRef.current.posAtCoords({ x: e.clientX, y: e.clientY });
                    if (pos !== null && canControlMirror) {
                      const lineObj = viewRef.current.state.doc.lineAt(pos);
                      socketRef.current.emit('code:pointer', {
                        sessionId,
                        sourceId: ensureCursorSourceId(),
                        sequence: ++cursorSequenceRef.current,
                        path: activeFileRef.current,
                        surface: 'editor',
                        kind: 'click',
                        line: lineObj.number - 1,
                        ch: pos - lineObj.from,
                      });
                    }
                  }
                }}
                className={`overflow-hidden transition-all duration-200 relative ${
                  showTerminalDrawer ? 'flex-1' : 'h-full'
                }`}
              >
                <div ref={hostRef} className="h-full w-full" />

                {/* Smooth Floating Remote Cursor Layer (Spring Gliding Physics) */}
                {floatingCursor.visible &&
                  sameCodePath(floatingCursor.path, activeFile) &&
                  (isWritable || followInstructor) && (
                  <div
                    className="pointer-events-none absolute top-0 left-0 z-40 will-change-transform"
                    style={{
                      transform: `translate3d(${floatingCursor.x}px, ${floatingCursor.y}px, 0)`,
                      opacity: floatingCursor.isMoving ? 0.82 : 0,
                      transition: 'transform 110ms cubic-bezier(0.16, 1, 0.3, 1), opacity 150ms ease',
                    }}
                  >
                    <div style={{ position: 'relative', top: '2px', left: '9px', opacity: 0.82 }}>
                      {/* SVG Cursor Pointer with 3D drop-shadow */}
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="drop-shadow-[0_3px_8px_rgba(0,0,0,0.7)] filter"
                      >
                        <path
                          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"
                          fill="#10b981"
                          stroke="#064e3b"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {/* Smooth Single Click Bubble Layer */}
                {editorRipples.map((ripple) => (
                  <div
                    key={ripple.id}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-50 flex items-center justify-center"
                    style={{ left: ripple.x, top: ripple.y }}
                  >
                    {/* Silky soft expanding click bubble */}
                    <div
                      className="h-7 w-7 rounded-full border border-emerald-400/70 bg-emerald-400/20 backdrop-blur-xs"
                      style={{ animation: 'editor-click-bubble 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                    />
                    {/* Subtle micro dot in the center */}
                    <div
                      className="absolute h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_#10b981]"
                      style={{ animation: 'editor-click-center 350ms ease-out forwards' }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Custom Keyframes for Clicks & Spotlight */}
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes editor-click-bubble {
                0% { transform: scale(0.25); opacity: 0.95; }
                100% { transform: scale(2.2); opacity: 0; }
              }
              @keyframes editor-click-center {
                0% { transform: scale(1.3); opacity: 1; }
                100% { transform: scale(0.3); opacity: 0; }
              }
              @keyframes cm-caret-blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.35; }
              }
              @keyframes cm-spotlight-pulse {
                0%, 100% { opacity: 0.95; box-shadow: inset 0 0 20px rgba(245, 158, 11, 0.3); }
                50% { opacity: 0.65; box-shadow: inset 0 0 10px rgba(245, 158, 11, 0.15); }
              }
            `}} />

            {/* Free Roam "Jump to Instructor" Floating Banner (for students) */}
            {!isWritable &&
              !followInstructor &&
              instructorLocation &&
              (instructorLocation.path !== activeFile ||
                Math.abs(instructorLocation.line - (cursorPos?.line ?? 0)) > 5) && (
                <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-[#161b22]/95 px-3 py-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 text-xs text-neutral-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>
                      Instructor is on{' '}
                      <strong className="text-emerald-400">
                        {instructorLocation.path.split('/').pop()}
                      </strong>{' '}
                      (Ln {instructorLocation.line + 1})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setFollowInstructor(true);
                      selectFile(instructorLocation.path);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-bold text-emerald-950 transition hover:bg-emerald-400 shadow-md"
                  >
                    <PiTarget size={12} />
                    <span>Jump to Instructor</span>
                  </button>
                </div>
              )}

            {/* Collapsible Bottom Terminal Split Drawer */}
            {showTerminalDrawer && (
              <div className="h-48 border-t border-white/8 bg-[#090c10]">
                <TerminalView sessionId={sessionId} canEdit={isWritable} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
