'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { getRealtimeToken, clearRealtimeToken } from '@/lib/client-token';
import type {
  ForwardedPortInfo,
  TunnelClientToServerEvents,
  TunnelServerToClientEvents,
} from '@/lib/realtime-contract';
import {
  PiArrowClockwise,
  PiArrowSquareOut,
  PiDesktop,
  PiDeviceMobile,
  PiDeviceTablet,
  PiGlobe,
} from 'react-icons/pi';

type TunnelSocket = Socket<TunnelServerToClientEvents, TunnelClientToServerEvents>;

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export function PortPreviewView({
  sessionId,
}: {
  sessionId: string;
}) {
  const [ports, setPorts] = useState<ForwardedPortInfo[]>([]);
  const [activePort, setActivePort] = useState<number | null>(null);
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [token, setToken] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    void getRealtimeToken().then((t) => setToken(t ?? ''));

    const socket: TunnelSocket = io(`${API_URL}/tunnel`, {
      auth: (cb) =>
        void getRealtimeToken().then((tok) => cb({ token: tok ?? '' })),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      socket.emit('tunnel:join', { sessionId });
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        clearRealtimeToken();
        setTimeout(() => socket.connect(), 1000);
      }
    });

    socket.on('connect_error', (err) => {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('token')) {
        clearRealtimeToken();
      }
    });

    socket.on('error' as unknown as keyof TunnelServerToClientEvents, (err: unknown) => {
      const parsed = typeof err === 'object' && err !== null ? (err as { code?: string }) : null;
      if (parsed?.code === 'UNAUTHORIZED') {
        clearRealtimeToken();
        setTimeout(() => socket.connect(), 800);
      }
    });

    socket.on('tunnel:ports', (p) => {
      setPorts(p.ports);
      if (p.ports.length > 0) {
        setActivePort((curr) => (curr && p.ports.some((x) => x.port === curr) ? curr : p.ports[0].port));
      } else {
        setActivePort(null);
      }
    });

    return () => {
      socket.emit('tunnel:leave', { sessionId });
      socket.disconnect();
    };
  }, [sessionId]);

  const activePortInfo = ports.find((p) => p.port === activePort);
  const previewUrl = activePort
    ? `${API_URL}/proxy/${sessionId}/${activePort}/?token=${encodeURIComponent(token)}`
    : '';

  const viewportWidthClass =
    viewport === 'mobile'
      ? 'max-w-[390px] h-[844px] shadow-2xl rounded-2xl border border-white/10'
      : viewport === 'tablet'
      ? 'max-w-[768px] h-[1024px] shadow-2xl rounded-xl border border-white/10'
      : 'w-full h-full';

  return (
    <div className="flex h-full w-full flex-col bg-[#0d1117] text-[#c9d1d9]">
      {/* Top Bar */}
      <div className="flex h-11 items-center justify-between border-b border-white/8 bg-[#161b22] px-3">
        {/* Port Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {ports.length === 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              <PiGlobe size={14} />
              <span>No forwarded ports</span>
            </span>
          ) : (
            ports.map((p) => (
              <button
                key={p.port}
                onClick={() => setActivePort(p.port)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono transition ${
                  p.port === activePort
                    ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30'
                    : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                }`}
              >
                <span>:{p.port}</span>
                {p.label && <span className="opacity-75">({p.label})</span>}
              </button>
            ))
          )}
        </div>

        {/* Viewport controls & Reload */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-black/30 p-0.5 border border-white/8">
            <button
              onClick={() => setViewport('desktop')}
              title="Desktop view (100%)"
              className={`rounded p-1 transition ${
                viewport === 'desktop' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <PiDesktop size={14} />
            </button>
            <button
              onClick={() => setViewport('tablet')}
              title="Tablet view (768px)"
              className={`rounded p-1 transition ${
                viewport === 'tablet' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <PiDeviceTablet size={14} />
            </button>
            <button
              onClick={() => setViewport('mobile')}
              title="Mobile view (390px)"
              className={`rounded p-1 transition ${
                viewport === 'mobile' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <PiDeviceMobile size={14} />
            </button>
          </div>

          <button
            onClick={() => setReloadKey((k) => k + 1)}
            title="Reload web preview"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white transition"
          >
            <PiArrowClockwise size={15} />
          </button>

          {previewUrl && (
            <button
              onClick={() => window.open(previewUrl, '_blank')}
              title="Open in new window"
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white transition"
            >
              <PiArrowSquareOut size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Frame Preview Stage */}
      <div className="flex flex-1 items-center justify-center overflow-auto bg-[#090c10] p-3">
        {activePort ? (
          <iframe
            key={`${activePort}-${reloadKey}`}
            ref={iframeRef}
            src={previewUrl}
            title={activePortInfo?.label ?? `Port ${activePort}`}
            className={`${viewportWidthClass} border-0 bg-white`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-neutral-500">
            <PiGlobe size={42} className="mb-3 opacity-40 text-emerald-400" />
            <h3 className="text-sm font-semibold text-neutral-300">No Web App Forwarded</h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-neutral-500">
              When the host forwards a port from VS Code or Antigravity IDE (e.g. <code>npm run dev</code> on port 3000), it will render here in real time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
