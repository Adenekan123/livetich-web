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
  CodeServerToClientEvents,
} from '@/lib/realtime-contract';

type CodeSocket = Socket<CodeServerToClientEvents, CodeClientToServerEvents>;

/** The languages the picker offers, each mapped to its CodeMirror grammar. */
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

/**
 * The shared code editor surface (Code Instruction pack). A single Y.Doc holds
 * the buffer (Y.Text "code") and the chosen language (Y.Map "meta"), synced
 * over the /code socket namespace exactly like the chalkboard. The instructor
 * types and picks the language; students get it read-only, syntax-highlighted,
 * and follow every keystroke. The editor is rebuilt when the language changes
 * (local or remote) so highlighting always matches. Cursor presence stays local
 * for now — text is the shared state.
 */
export function CodeBoard({
  sessionId,
  canEdit,
}: {
  sessionId: string;
  canEdit: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<string>(DEFAULT_LANG);

  // Long-lived collaboration objects, kept in refs so the language-change
  // effect can rebuild the view without tearing down the doc/socket.
  const docRef = useRef<Y.Doc | null>(null);
  const metaRef = useRef<Y.Map<string> | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);

  // ---- Doc + socket: set up once per session. ----
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

    // Reflect the language stored in the shared doc into local state (drives
    // both the picker and the editor rebuild). Seed it once if we're the writer.
    const syncLang = () => {
      const stored = meta.get('lang');
      if (stored && stored in LANGUAGES) setLang(stored);
      else if (canEdit && !stored) meta.set('lang', DEFAULT_LANG);
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
    // A brand-new room emits no state; unblock rendering after a short beat.
    const initTimer = setTimeout(() => {
      if (!readyRef.current) {
        readyRef.current = true;
        setReady(true);
        syncLang();
      }
    }, 1200);

    // doc -> socket: forward only local edits (remote updates carry origin
    // 'remote' and must not echo back).
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
      docRef.current = null;
      metaRef.current = null;
      awarenessRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, canEdit]);

  // ---- Editor view: (re)build when ready or the language changes. ----
  useEffect(() => {
    const host = hostRef.current;
    const doc = docRef.current;
    const awareness = awarenessRef.current;
    if (!ready || !host || !doc || !awareness) return;

    const yText = doc.getText('code');
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
      EditorView.editable.of(canEdit),
      EditorState.readOnly.of(!canEdit),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': {
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
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
  }, [ready, lang, canEdit]);

  const onPickLang = (next: string) => {
    setLang(next);
    metaRef.current?.set('lang', next); // broadcasts to everyone via the doc
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#282c34]">
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-3 py-2">
        <span className="text-xs font-medium text-neutral-400">Code</span>
        {canEdit ? (
          <select
            value={lang}
            onChange={(e) => onPickLang(e.target.value)}
            aria-label="Editor language"
            className="ml-auto rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-neutral-200 focus:border-signal-500 focus:outline-none"
          >
            {Object.entries(LANGUAGES).map(([key, { label }]) => (
              <option key={key} value={key} className="bg-neutral-900">
                {label}
              </option>
            ))}
          </select>
        ) : (
          <span className="ml-auto text-xs text-neutral-500">
            {LANGUAGES[lang as LangKey]?.label ?? lang} · following instructor
          </span>
        )}
      </div>
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden" />
    </div>
  );
}
