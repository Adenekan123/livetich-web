'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { getRealtimeToken, clearRealtimeToken } from '@/lib/client-token';
import { useNetworkStatus } from '@/lib/network-status';
import type {
  TerminalClientToServerEvents,
  TerminalServerToClientEvents,
  TerminalSessionInfo,
} from '@/lib/realtime-contract';
import {
  PiTerminal,
  PiLockSimple,
  PiLockSimpleOpen,
  PiWifiSlash,
  PiArrowsClockwise,
  PiWarningCircle,
  PiCheckCircle,
} from 'react-icons/pi';

type TermSocket = Socket<TerminalServerToClientEvents, TerminalClientToServerEvents>;

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline' | 'error';

export function TerminalView({
  sessionId,
  canEdit,
}: {
  sessionId: string;
  canEdit: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<TermSocket | null>(null);

  const { isOnline } = useNetworkStatus();
  const [connState, setConnState] = useState<ConnectionState>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const authRetriesRef = useRef<number>(0);

  const [activeTerminal, setActiveTerminal] = useState<TerminalSessionInfo | null>(null);
  const activeTerminalRef = useRef<TerminalSessionInfo | null>(null);
  const [terminalsList, setTerminalsList] = useState<TerminalSessionInfo[]>([]);
  const [canType, setCanType] = useState<boolean>(canEdit);

  const updateActiveTerminal = (t: TerminalSessionInfo | null) => {
    activeTerminalRef.current = t;
    setActiveTerminal(t);
  };

  // Manual reconnect trigger
  const handleManualReconnect = useCallback(() => {
    clearRealtimeToken();
    setConnState('connecting');
    setErrorMessage(null);
    authRetriesRef.current = 0;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  // Synchronize browser offline state
  useEffect(() => {
    if (!isOnline) {
      setConnState('offline');
    } else {
      // Internet restored: drop stale token & trigger reconnection if disconnected
      clearRealtimeToken();
      if (socketRef.current && !socketRef.current.connected) {
        setConnState('connecting');
        socketRef.current.connect();
      }
    }
  }, [isOnline]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.25,
      theme: {
        background: '#090c10',
        foreground: '#c9d1d9',
        cursor: '#10b981',
        selectionBackground: 'rgba(16, 185, 129, 0.3)',
        black: '#484f58',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#f2cc60',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    term.writeln('\x1b[90mConnecting to Livetich terminal stream...\x1b[0m');

    // 2. Connect to /terminal namespace with polling fallback and auto-reconnect
    const socket: TermSocket = io(`${API_URL}/terminal`, {
      auth: (cb) =>
        void getRealtimeToken().then((token) => cb({ token: token ?? '' })),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      authRetriesRef.current = 0;
      setConnState('connected');
      setErrorMessage(null);
      socket.emit('term:join', { sessionId });
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server rejected connection (often token expiry) — Socket.IO won't auto-reconnect
        // on server-initiated disconnect, so we self-heal with a fresh token
        clearRealtimeToken();
        if (authRetriesRef.current < 5) {
          authRetriesRef.current += 1;
          setConnState('reconnecting');
          setTimeout(() => {
            if (socketRef.current === socket) {
              socket.connect();
            }
          }, 1000);
        } else {
          setConnState('error');
          setErrorMessage('Session token expired. Click Reconnect to resume.');
        }
      } else {
        setConnState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting');
      }
    });

    socket.on('connect_error', (err) => {
      // Do not pollute the terminal screen with repeated raw websocket error lines.
      // Instead, report status cleanly to the UI banner and heal token if unauthorized.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setConnState('offline');
      } else {
        setConnState('reconnecting');
        const msg = err.message || '';
        if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('token')) {
          clearRealtimeToken();
        }
      }
    });

    socket.on('error' as unknown as keyof TerminalServerToClientEvents, (err: unknown) => {
      const parsed = typeof err === 'object' && err !== null ? (err as { code?: string; message?: string }) : null;
      if (parsed?.code === 'UNAUTHORIZED') {
        // Token expired on gateway verification — self heal
        clearRealtimeToken();
        setConnState('reconnecting');
        setTimeout(() => {
          if (socketRef.current === socket) {
            socket.connect();
          }
        }, 800);
      } else {
        const msg = parsed?.message || String(err);
        setErrorMessage(msg);
      }
    });

    socket.on('term:state', (p) => {
      setTerminalsList(p.terminals);
      if (p.terminals.length > 0) {
        const first = p.terminals[0];
        updateActiveTerminal(first);
        term.clear();
        if (first.backlog) {
          term.write(first.backlog);
        } else {
          term.writeln(`\x1b[32m✔ Connected to ${first.name}\x1b[0m`);
        }
      } else {
        term.clear();
        term.writeln('\x1b[90mNo active terminal shared by the host yet.\x1b[0m');
      }
    });

    socket.on('term:opened', (p) => {
      updateActiveTerminal(p.terminal);
      setTerminalsList((prev) => {
        const next = prev.filter((t) => t.terminalId !== p.terminal.terminalId);
        return [...next, p.terminal];
      });
      term.writeln(`\r\n\x1b[32m✔ Terminal opened: ${p.terminal.name}\x1b[0m\r\n`);
    });

    socket.on('term:data', (p) => {
      const cur = activeTerminalRef.current;
      if (!cur || p.terminalId === cur.terminalId) {
        term.write(p.data);
      }
    });

    socket.on('term:closed', (p) => {
      setTerminalsList((prev) => prev.filter((t) => t.terminalId !== p.terminalId));
      if (activeTerminalRef.current?.terminalId === p.terminalId) {
        term.writeln('\r\n\x1b[31m✖ Terminal stream closed by host\x1b[0m\r\n');
        updateActiveTerminal(null);
      }
    });

    socket.on('term:permission', (p) => {
      if (p.writableBy === 'OPEN') {
        setCanType(true);
      } else if (p.writableBy === 'INSTRUCTOR_ONLY') {
        setCanType(canEdit);
      }
    });

    // 3. User Keystrokes -> Stdin
    const onDataDisposable = term.onData((data) => {
      const cur = activeTerminalRef.current;
      if (!cur) return;
      socket.emit('term:stdin', {
        sessionId,
        terminalId: cur.terminalId,
        data,
      });
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // Ignored
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      term.dispose();
      socket.emit('term:leave', { sessionId });
      socket.disconnect();
    };
  }, [sessionId, canEdit]);

  return (
    <div className="flex h-full w-full flex-col bg-[#090c10] text-[#c9d1d9] relative">
      {/* Terminal Header */}
      <div className="flex h-9 items-center justify-between border-b border-white/8 bg-[#161b22] px-3 font-mono text-xs select-none">
        <div className="flex items-center gap-2.5">
          <PiTerminal className="text-emerald-400" size={15} />
          <span className="font-semibold text-neutral-200">
            {activeTerminal ? activeTerminal.name : 'Terminal'}
          </span>

          {/* Connection Status Badge in Header */}
          {connState === 'connected' ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/25">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Connected</span>
            </span>
          ) : connState === 'offline' ? (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/25">
              <PiWifiSlash size={11} className="text-rose-400" />
              <span>Offline</span>
            </span>
          ) : connState === 'reconnecting' || connState === 'connecting' ? (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/25">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Reconnecting...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/25">
              <PiWarningCircle size={11} className="text-rose-400" />
              <span>Disconnected</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {canType ? (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400">
              <PiLockSimpleOpen size={13} />
              <span>Interactive</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-neutral-400">
              <PiLockSimple size={13} />
              <span>Read Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Network Alert / Reconnection Notification Banner */}
      {connState === 'offline' && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-gradient-to-r from-amber-950/80 via-[#181308] to-amber-950/80 px-3.5 py-2 text-xs font-sans shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5 text-amber-200">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
              <PiWifiSlash size={14} className="animate-pulse" />
            </div>
            <div>
              <span className="font-semibold text-amber-300">You are currently offline.</span>{' '}
              <span className="text-amber-200/80">
                Please check your internet connection. Live terminal stream will automatically reconnect once you are back online.
              </span>
            </div>
          </div>
          <button
            onClick={handleManualReconnect}
            className="shrink-0 rounded-md bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/30 hover:text-white transition border border-amber-500/30"
          >
            Retry Now
          </button>
        </div>
      )}

      {connState === 'reconnecting' && (
        <div className="flex items-center justify-between gap-3 border-b border-sky-500/25 bg-gradient-to-r from-sky-950/70 via-[#0b1320] to-sky-950/70 px-3.5 py-2 text-xs font-sans shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5 text-sky-200">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
              <PiArrowsClockwise size={14} className="animate-spin" />
            </div>
            <div>
              <span className="font-semibold text-sky-300">Connection interrupted.</span>{' '}
              <span className="text-sky-200/80">
                Re-establishing terminal stream and refreshing session credentials...
              </span>
            </div>
          </div>
          <button
            onClick={handleManualReconnect}
            className="flex items-center gap-1.5 shrink-0 rounded-md bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/30 hover:text-white transition border border-sky-500/30"
          >
            <PiArrowsClockwise size={12} />
            <span>Reconnect Now</span>
          </button>
        </div>
      )}

      {connState === 'error' && (
        <div className="flex items-center justify-between gap-3 border-b border-rose-500/30 bg-gradient-to-r from-rose-950/80 via-[#1c0b0f] to-rose-950/80 px-3.5 py-2 text-xs font-sans shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2.5 text-rose-200">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
              <PiWarningCircle size={14} />
            </div>
            <div>
              <span className="font-semibold text-rose-300">Unable to reach terminal stream.</span>{' '}
              <span className="text-rose-200/80">
                {errorMessage || 'Connection lost. Please click Reconnect to refresh credentials.'}
              </span>
            </div>
          </div>
          <button
            onClick={handleManualReconnect}
            className="flex items-center gap-1.5 shrink-0 rounded-md bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/30 hover:text-white transition border border-rose-500/30"
          >
            <PiArrowsClockwise size={12} />
            <span>Reconnect</span>
          </button>
        </div>
      )}

      {/* Terminal Viewport */}
      <div ref={containerRef} className="flex-1 overflow-hidden p-2" />
    </div>
  );
}
