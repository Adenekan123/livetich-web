'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

async function requestPreviewToken(sessionId: string, port: number): Promise<string | null> {
  try {
    const response = await fetch('/api/preview-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ sessionId, port }),
    });
    if (!response.ok) return null;
    const result = (await response.json()) as { token?: string };
    return result.token ?? null;
  } catch {
    return null;
  }
}

export function PortPreviewView({
  sessionId,
  reloadSignal = 0,
}: {
  sessionId: string;
  /** Refresh the app after a shared IDE/editor document has settled. */
  reloadSignal?: number;
}) {
  const [ports, setPorts] = useState<ForwardedPortInfo[]>([]);
  const [activePort, setActivePort] = useState<number | null>(null);
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [previewToken, setPreviewToken] = useState<{
    sessionId: string;
    port: number;
    token: string;
  } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastReloadSignalRef = useRef(reloadSignal);

  const refreshPreview = useCallback(async (reload = false) => {
    if (!activePort) return null;
    const token = await requestPreviewToken(sessionId, activePort);
    if (!token) {
      setPreviewToken(null);
      return null;
    }
    setPreviewToken({ sessionId, port: activePort, token });
    if (reload) setReloadKey((key) => key + 1);
    return token;
  }, [activePort, sessionId]);

  useEffect(() => {
    if (lastReloadSignalRef.current === reloadSignal) return;
    lastReloadSignalRef.current = reloadSignal;
    void refreshPreview(true);
  }, [reloadSignal, refreshPreview]);

  useEffect(() => {
    if (!activePort) return;
    let cancelled = false;
    void requestPreviewToken(sessionId, activePort).then((token) => {
      if (!cancelled && token) setPreviewToken({ sessionId, port: activePort, token });
    });
    return () => { cancelled = true; };
  }, [activePort, sessionId]);

  useEffect(() => {

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
  const previewUrl = activePortInfo
    ? (() => {
        // New host-based previews give each forwarded app its own origin, so
        // Vite/Next asset and HMR paths remain rooted at `/`. Keep the legacy
        // path proxy as a compatibility fallback for older API deployments.
        const base = activePortInfo.previewUrl
          ? activePortInfo.previewUrl
          : `${API_URL}/proxy/${sessionId}/${activePortInfo.port}/`;
        const url = new URL(base, window.location.href);
        if (
          previewToken?.sessionId === sessionId &&
          previewToken.port === activePortInfo.port
        ) {
          url.searchParams.set('token', previewToken.token);
        }
        return url.toString();
      })()
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
            onClick={() => void refreshPreview(true)}
            title="Reload web preview"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white transition"
          >
            <PiArrowClockwise size={15} />
          </button>

          {previewUrl && (
            <button
              onClick={async () => {
                const popup = window.open('about:blank', '_blank');
                if (!popup || !activePortInfo) return;
                popup.opener = null;
                const freshToken = await refreshPreview();
                if (!freshToken) {
                  popup.close();
                  return;
                }
                const url = new URL(
                  activePortInfo.previewUrl ?? `${API_URL}/proxy/${sessionId}/${activePortInfo.port}/`,
                  window.location.href,
                );
                url.searchParams.set('token', freshToken);
                popup.location.replace(url.toString());
              }}
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
