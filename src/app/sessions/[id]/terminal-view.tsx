'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import type {
  TerminalClientToServerEvents,
  TerminalServerToClientEvents,
  TerminalSessionInfo,
} from '@/lib/realtime-contract';
import { PiTerminal, PiLockSimple, PiLockSimpleOpen } from 'react-icons/pi';

type TermSocket = Socket<TerminalServerToClientEvents, TerminalClientToServerEvents>;

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

  const [activeTerminal, setActiveTerminal] = useState<TerminalSessionInfo | null>(null);
  const [terminalsList, setTerminalsList] = useState<TerminalSessionInfo[]>([]);
  const [canType, setCanType] = useState<boolean>(canEdit);

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

    // 2. Connect to /terminal namespace
    const socket: TermSocket = io(`${API_URL}/terminal`, {
      auth: (cb) =>
        void getRealtimeToken().then((token) => cb({ token: token ?? '' })),
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('term:join', { sessionId });
    });

    socket.on('term:state', (p) => {
      setTerminalsList(p.terminals);
      if (p.terminals.length > 0) {
        const first = p.terminals[0];
        setActiveTerminal(first);
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
      setActiveTerminal(p.terminal);
      setTerminalsList((prev) => {
        const next = prev.filter((t) => t.terminalId !== p.terminal.terminalId);
        return [...next, p.terminal];
      });
      term.writeln(`\r\n\x1b[32m✔ Terminal opened: ${p.terminal.name}\x1b[0m\r\n`);
    });

    socket.on('term:data', (p) => {
      if (!activeTerminal || p.terminalId === activeTerminal.terminalId) {
        term.write(p.data);
      }
    });

    socket.on('term:closed', (p) => {
      setTerminalsList((prev) => prev.filter((t) => t.terminalId !== p.terminalId));
      if (activeTerminal?.terminalId === p.terminalId) {
        term.writeln('\r\n\x1b[31m✖ Terminal stream closed by host\x1b[0m\r\n');
        setActiveTerminal(null);
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
      if (!activeTerminal) return;
      socket.emit('term:stdin', {
        sessionId,
        terminalId: activeTerminal.terminalId,
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
    <div className="flex h-full w-full flex-col bg-[#090c10] text-[#c9d1d9]">
      {/* Terminal Header */}
      <div className="flex h-9 items-center justify-between border-b border-white/8 bg-[#161b22] px-3 font-mono text-xs">
        <div className="flex items-center gap-2">
          <PiTerminal className="text-emerald-400" size={15} />
          <span className="font-semibold text-neutral-200">
            {activeTerminal ? activeTerminal.name : 'Terminal'}
          </span>
          {activeTerminal && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
              Live Output
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
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

      {/* Terminal Viewport */}
      <div ref={containerRef} className="flex-1 overflow-hidden p-2" />
    </div>
  );
}
