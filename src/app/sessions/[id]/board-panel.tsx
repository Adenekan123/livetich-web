'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { API_URL } from '@/lib/api';
import { getClientToken } from '@/lib/client-token';
import type {
  BoardClientToServerEvents,
  BoardServerToClientEvents,
} from '@/lib/realtime-contract';

type BoardSocket = Socket<BoardServerToClientEvents, BoardClientToServerEvents>;

/** One chalk stroke; points are normalized 0..1 as a flat [x, y, x, y, …]. */
interface Stroke {
  color: string;
  width: number;
  points: number[];
}

const COLORS = ['#f8fafc', '#facc15', '#4ade80', '#60a5fa', '#f87171'];
const LOCAL = 'local'; // Yjs transaction origin for edits made on this client

/**
 * Minimal chalkboard bound to the /board Yjs namespace: strokes live in a
 * Y.Array so the server keeps authority and snapshots. The instructor draws;
 * students watch. A richer tldraw embed can replace the surface later
 * without touching the transport.
 */
export function BoardPanel({
  sessionId,
  canDraw,
}: {
  sessionId: string;
  canDraw: boolean;
}) {
  const docRef = useRef<Y.Doc | null>(null);
  const socketRef = useRef<BoardSocket | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [connected, setConnected] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;
    const strokesArr = doc.getArray<Stroke>('strokes');
    const repaint = () => setStrokes(strokesArr.toArray());
    strokesArr.observe(repaint);

    const socket: BoardSocket = io(`${API_URL}/board`, {
      auth: { token: getClientToken() },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    const apply = (update: ArrayBuffer | Uint8Array) =>
      Y.applyUpdate(
        doc,
        update instanceof Uint8Array ? update : new Uint8Array(update),
        'remote',
      );
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('board:join', { sessionId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('board:state', (p) => apply(p.update));
    socket.on('board:update', (p) => apply(p.update));

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === LOCAL) {
        socket.emit('board:update', { sessionId, update });
      }
    });

    return () => {
      strokesArr.unobserve(repaint);
      socket.disconnect();
      doc.destroy();
      socketRef.current = null;
      docRef.current = null;
    };
  }, [sessionId]);

  const toPoint = (e: React.PointerEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
    ];
  };

  const onDown = (e: React.PointerEvent) => {
    if (!canDraw) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort; some pointer types can't be captured.
    }
    setDraft({ color, width: 0.004, points: [...toPoint(e)] });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!draft) return;
    setDraft({ ...draft, points: [...draft.points, ...toPoint(e)] });
  };
  const onUp = () => {
    if (!draft) return;
    if (draft.points.length >= 4 && docRef.current) {
      const doc = docRef.current;
      doc.transact(() => {
        doc.getArray<Stroke>('strokes').push([draft]);
      }, LOCAL);
    }
    setDraft(null);
  };

  const clear = () => {
    const doc = docRef.current;
    if (!doc) return;
    doc.transact(() => {
      const arr = doc.getArray<Stroke>('strokes');
      arr.delete(0, arr.length);
    }, LOCAL);
  };

  const path = (s: Stroke) => {
    let d = `M ${s.points[0] * 1000} ${s.points[1] * 562.5}`;
    for (let i = 2; i < s.points.length; i += 2) {
      d += ` L ${s.points[i] * 1000} ${s.points[i + 1] * 562.5}`;
    }
    return d;
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 px-3 py-2">
        <span className="text-xs text-slate-400">
          🧑‍🏫 Chalkboard {connected ? '' : '· connecting…'}
          {!canDraw && ' · view only'}
        </span>
        {canDraw && (
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`chalk ${c}`}
                className={`h-5 w-5 rounded-full border-2 ${
                  color === c ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <button
              onClick={clear}
              className="ml-2 rounded border border-slate-600 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 1000 562.5"
        className={`aspect-video w-full ${canDraw ? 'cursor-crosshair' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {[...strokes, ...(draft ? [draft] : [])].map((s, i) => (
          <path
            key={i}
            d={path(s)}
            fill="none"
            stroke={s.color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}
