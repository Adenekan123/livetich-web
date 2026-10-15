'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
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
import { Awareness } from 'y-protocols/awareness';
import { io, type Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import type {
  CodeClientToServerEvents,
  CodeFileTreeNode,
  CodeFocusPayload,
  CodePermissionPayload,
  CodeServerToClientEvents,
  CodeWritePermissionMode,
} from '@/lib/realtime-contract';
import {
  PiCode,
  PiFileCode,
  PiFolder,
  PiFolderOpen,
  PiGlobe,
  PiTerminal,
  PiLockSimple,
  PiLockSimpleOpen,
  PiArrowSquareOut,
  PiSidebarSimple,
} from 'react-icons/pi';
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

/**
 * Duckly-Like Live Multi-File Code Studio & Terminal Stream.
 * Synchronizes multi-file project trees, cursor follow mode, interactive terminals,
 * and live-forwarded localhost web previews.
 */
export function CodeBoard({
  sessionId,
  canEdit: initialCanEdit,
}: {
  sessionId: string;
  canEdit: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<string>(DEFAULT_LANG);
  const [activeTab, setActiveTab] = useState<BottomTab>('editor');
  const [showTerminalDrawer, setShowTerminalDrawer] = useState<boolean>(true);
  const [showFileTree, setShowFileTree] = useState<boolean>(true);

  const [tree, setTree] = useState<CodeFileTreeNode[]>([]);
  const [openFiles, setOpenFiles] = useState<string[]>(['index.ts']);
  const [activeFile, setActiveFile] = useState<string>('index.ts');
  const [permissionMode, setPermissionMode] = useState<CodeWritePermissionMode>('INSTRUCTOR_ONLY');
  const [cursorPos, setCursorPos] = useState<{ line: number; ch: number } | null>(null);

  const docRef = useRef<Y.Doc | null>(null);
  const metaRef = useRef<Y.Map<string> | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Can the user currently write to code?
  const isWritable = initialCanEdit || permissionMode === 'OPEN';

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
      transports: ['websocket'],
    });

    const applyRemote = (u: ArrayBuffer | Uint8Array) =>
      Y.applyUpdate(doc, u instanceof Uint8Array ? u : new Uint8Array(u), 'remote');

    const syncLang = () => {
      const stored = meta.get('lang');
      if (stored && stored in LANGUAGES) setLang(stored);
      else if (initialCanEdit && !stored) meta.set('lang', DEFAULT_LANG);
    };
    meta.observe(syncLang);

    socket.on('connect', () => socket.emit('code:join', { sessionId }));

    socket.on('code:state', (p) => {
      applyRemote(p.update);
      syncLang();
      readyRef.current = true;
      setReady(true);
    });

    socket.on('code:update', (p) => applyRemote(p.update));

    socket.on('code:tree', (p) => {
      setTree(p.tree);
    });

    socket.on('code:focus', (p: CodeFocusPayload) => {
      if (p.path) {
        setActiveFile(p.path);
        setOpenFiles((prev) => (prev.includes(p.path) ? prev : [...prev, p.path]));
        setLang(detectLangFromPath(p.path));
      }
      if (p.cursor) {
        setCursorPos(p.cursor);
      }
    });

    socket.on('code:permission', (p: CodePermissionPayload) => {
      setPermissionMode(p.mode);
    });

    const initTimer = setTimeout(() => {
      if (!readyRef.current) {
        readyRef.current = true;
        setReady(true);
        syncLang();
      }
    }, 1200);

    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') socket.emit('code:update', { sessionId, update });
    };
    doc.on('update', onDocUpdate);

    return () => {
      clearTimeout(initTimer);
      meta.unobserve(syncLang);
      doc.off('update', onDocUpdate);
      socket.emit('code:leave', { sessionId });
      socket.disconnect();
      viewRef.current?.destroy();
      viewRef.current = null;
      awareness.destroy();
      doc.destroy();
    };
  }, [sessionId, initialCanEdit]);

  // ---- Editor view rebuild ----
  useEffect(() => {
    const host = hostRef.current;
    const doc = docRef.current;
    const awareness = awarenessRef.current;
    if (!ready || !host || !doc || !awareness) return;

    // Use specific Y.Text for active file (with fallback to default 'code' buffer)
    const yText = doc.getText(`file:${activeFile}`) || doc.getText('code');

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      bracketMatching(),
      indentOnInput(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      oneDark,
      langExtension(lang),
      yCollab(yText, awareness),
      EditorView.editable.of(isWritable),
      EditorState.readOnly.of(!isWritable),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13.5px' },
        '.cm-scroller': {
          fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
        },
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ extensions }),
      parent: host,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ready, lang, isWritable, activeFile]);

  const selectFile = (filePath: string) => {
    setActiveFile(filePath);
    setOpenFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
    setLang(detectLangFromPath(filePath));
  };

  const closeFileTab = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = openFiles.filter((f) => f !== filePath);
    setOpenFiles(filtered);
    if (activeFile === filePath && filtered.length > 0) {
      selectFile(filtered[filtered.length - 1]);
    }
  };

  // Render file tree recursively
  const renderTreeNodes = (nodes: CodeFileTreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const isDir = node.isDirectory;
      const isSelected = activeFile === node.path;

      if (isDir) {
        return (
          <div key={node.path} className="flex flex-col">
            <div
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className="flex items-center gap-1.5 py-1 text-xs text-neutral-400 hover:text-neutral-200"
            >
              <PiFolderOpen size={14} className="text-emerald-400/80" />
              <span className="truncate">{node.name}</span>
            </div>
            {node.children && renderTreeNodes(node.children, depth + 1)}
          </div>
        );
      }

      return (
        <button
          key={node.path}
          onClick={() => selectFile(node.path)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`flex w-full items-center gap-1.5 py-1 text-xs text-left transition ${
            isSelected
              ? 'bg-emerald-500/15 text-emerald-400 font-semibold'
              : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
          }`}
        >
          <PiFileCode size={13} className={isSelected ? 'text-emerald-400' : 'text-neutral-500'} />
          <span className="truncate">{node.name}</span>
        </button>
      );
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl">
      {/* Top Header Bar */}
      <div className="flex h-11 items-center justify-between border-b border-white/8 bg-[#161b22] px-3">
        <div className="flex items-center gap-2">
          {tree.length > 0 && (
            <button
              onClick={() => setShowFileTree(!showFileTree)}
              title="Toggle File Tree"
              className={`rounded p-1 text-neutral-400 transition hover:bg-white/5 hover:text-white ${
                showFileTree ? 'text-emerald-400' : ''
              }`}
            >
              <PiSidebarSimple size={16} />
            </button>
          )}

          {/* Surface Mode Switcher */}
          <div className="flex items-center rounded-lg bg-black/30 p-0.5 border border-white/8">
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
        </div>

        {/* Right Info: Permission pill & IDE deep links */}
        <div className="flex items-center gap-2">
          {isWritable ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/25">
              <PiLockSimpleOpen size={12} />
              <span>Co-Edit Open</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-neutral-800/80 px-2.5 py-0.5 text-[11px] font-medium text-neutral-400 border border-white/5">
              <PiLockSimple size={12} />
              <span>Instructor Only</span>
            </span>
          )}

          {cursorPos && (
            <span className="text-[11px] font-mono text-neutral-500 hidden sm:inline">
              Ln {cursorPos.line + 1}, Col {cursorPos.ch + 1}
            </span>
          )}

          {/* Open in Antigravity or VS Code */}
          <button
            onClick={() => {
              window.open(`antigravity://UsmanAdenekan.livetich/join?sessionId=${sessionId}`, '_blank');
            }}
            title="Open in Google Antigravity IDE"
            className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/5 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:bg-white/10 hover:text-white transition"
          >
            <span>Antigravity</span>
            <PiArrowSquareOut size={12} />
          </button>
        </div>
      </div>

      {/* Main Surface Body */}
      {activeTab === 'preview' ? (
        <PortPreviewView sessionId={sessionId} />
      ) : activeTab === 'terminal' ? (
        <TerminalView sessionId={sessionId} canEdit={initialCanEdit} />
      ) : (
        /* Editor Mode (with optional Split Terminal) */
        <div className="flex flex-1 overflow-hidden">
          {/* File Tree Drawer */}
          {showFileTree && tree.length > 0 && (
            <aside className="w-56 border-r border-white/8 bg-[#11161d] overflow-y-auto py-2 font-mono">
              <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                Workspace
              </div>
              {renderTreeNodes(tree)}
            </aside>
          )}

          {/* Editor + Drawer Layout */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* File Tabs Bar */}
            <div className="flex h-9 items-center overflow-x-auto border-b border-white/8 bg-[#090c10] px-2 font-mono text-xs">
              {openFiles.map((f) => {
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
                    {openFiles.length > 1 && (
                      <span
                        onClick={(e) => closeFileTab(f, e)}
                        className="rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 text-neutral-400 hover:text-white"
                      >
                        ×
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CodeMirror Lines Area */}
            <div
              ref={hostRef}
              className={`overflow-hidden transition-all duration-200 ${
                showTerminalDrawer ? 'flex-1' : 'h-full'
              }`}
            />

            {/* Collapsible Bottom Terminal Split Drawer */}
            {showTerminalDrawer && (
              <div className="h-48 border-t border-white/8 bg-[#090c10]">
                <TerminalView sessionId={sessionId} canEdit={initialCanEdit} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
