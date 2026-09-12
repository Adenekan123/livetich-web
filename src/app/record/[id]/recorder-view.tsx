'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { setRecorderToken } from '@/lib/client-token';
import { RECORDER_COOKIE } from '@/lib/recorder-cookie';
import { QuranReader } from '@/app/sessions/[id]/quran-reader';
import type { StageView } from '@/lib/realtime-contract';

// Excalidraw reaches for `window` as it loads, so it cannot be server
// rendered — the same client-only import the classroom uses.
const BoardExcalidraw = dynamic(
  () =>
    import('@/app/sessions/[id]/board-excalidraw').then(
      (m) => m.BoardExcalidraw,
    ),
  { ssr: false },
);

interface RecorderContext {
  livekitToken: string;
  url: string | null;
  room: string;
  courseTitle: string;
}

/**
 * The frame LiveKit records.
 *
 * Board-dominant on purpose: what makes a lesson worth re-watching is the
 * working — the diagram, the ayah, the correction — not a face. The camera is
 * a small tile, present so the recording still feels like a person teaching.
 */
export function RecorderView({
  sessionId,
  token,
}: {
  sessionId: string;
  token: string;
}) {
  // Must be set before the board's own socket effect runs, so it is done
  // during the first render rather than in an effect. Idempotent module state.
  useState(() => {
    setRecorderToken(token);
    // Board images and PDFs are loaded by the browser itself, which cannot add
    // a header — the /api/files proxy reads this instead. Session-scoped and
    // SameSite=Lax, on a throwaway browser that lives for one recording.
    if (typeof document !== 'undefined') {
      document.cookie = `${RECORDER_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
    }
    return null;
  });

  const [ctx, setCtx] = useState<RecorderContext | null>(null);
  const [view, setView] = useState<StageView>('board');
  const [quran, setQuran] = useState({ surah: 1, ayah: 1 });
  const [fault, setFault] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const cameraRef = useRef<HTMLDivElement>(null);
  const signalledRef = useRef(false);

  // 1. Exchange the recorder token for a hidden LiveKit token.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API_URL}/sessions/${sessionId}/recorder-context`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`recorder-context ${res.status}`);
        if (!cancelled) setCtx((await res.json()) as RecorderContext);
      } catch (e) {
        if (!cancelled) setFault(e instanceof Error ? e.message : 'context failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, token]);

  // 2. Join the room to hear and see the class. Hidden and subscribe-only, so
  //    nobody in the class learns anything from it being here.
  useEffect(() => {
    if (!ctx) return;
    const room = new Room({ adaptiveStream: false, dynacast: false });
    const attach = (track: RemoteTrack) => {
      const host = cameraRef.current;
      if (!host) return;
      if (track.kind === Track.Kind.Video) {
        host.replaceChildren(track.attach());
      } else if (track.kind === Track.Kind.Audio) {
        // Audio needs to be in the document to reach the recorder's mixer, but
        // never needs to be seen.
        const el = track.attach();
        el.style.display = 'none';
        document.body.appendChild(el);
      }
    };
    room.on(RoomEvent.TrackSubscribed, attach);

    // A missing URL is reported during render (see configFault) rather than
    // from in here.
    if (!ctx.url) return;
    void room
      .connect(ctx.url, ctx.livekitToken)
      // connect() resolving is the connected state; waiting on the event as
      // well only adds a way for this to hang with nothing to show for it.
      .then(() => setMediaReady(true))
      .catch((e: unknown) =>
        setFault(e instanceof Error ? e.message : 'livekit connect failed'),
      );
    return () => {
      void room.disconnect();
    };
  }, [ctx]);

  // 3. Follow what the class is actually looking at. Both of these are already
  //    broadcast to every participant and replayed on join, so the recorder
  //    only has to listen.
  useEffect(() => {
    const socket: Socket = io(API_URL, {
      auth: (cb: (d: { token: string }) => void) => cb({ token }),
      transports: ['websocket'],
    });
    socket.on('connect', () => socket.emit('room:join', { sessionId }));
    socket.on('view:changed', (p: { view: StageView }) => setView(p.view));
    socket.on('quran:position', (p: { surah: number; ayah: number }) =>
      setQuran({ surah: p.surah, ayah: p.ayah }),
    );
    return () => {
      socket.close();
    };
  }, [sessionId, token]);

  // 4. Tell egress the frame is worth recording. Without this it would capture
  //    the loading state — and with awaitStartSignal it simply waits instead.
  useEffect(() => {
    if (signalledRef.current || !mediaReady) return;
    signalledRef.current = true;
    // Read by LiveKit from the browser's console; not for humans.
    console.log('START_RECORDING');
  }, [mediaReady]);

  // Derived rather than stored: it is a fact about the context we were handed,
  // not an event that happened.
  const configFault = ctx && !ctx.url ? 'LiveKit is not configured' : null;
  const problem = fault ?? configFault;

  if (problem) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-neutral-900 text-sm text-red-300">
        Recorder could not start: {problem}
      </div>
    );
  }

  return (
    <div className="livetich-recorder relative h-screen w-screen overflow-hidden bg-white">
      {/* The lesson itself, full frame. */}
      <div className="absolute inset-0">
        <div className={view === 'quran' ? 'hidden' : 'h-full w-full'}>
          <BoardExcalidraw sessionId={sessionId} canDraw={false} />
        </div>
        {view === 'quran' && (
          <div className="h-full w-full">
            <QuranReader
              surah={quran.surah}
              ayah={quran.ayah}
              isInstructor={false}
              onNavigate={() => {
                // A recorder never turns the page.
              }}
            />
          </div>
        )}
      </div>

      {/* The instructor, small and out of the way.
          Bottom-right rather than top: the mushaf puts the surah name and the
          current ayah along the top, and a tile there sat on top of them. The
          board's own controls used to live down here and are hidden in a
          recording, so this corner is free in both views. */}
      <div
        ref={cameraRef}
        className="absolute bottom-6 right-6 z-10 h-[180px] w-[320px] overflow-hidden rounded-xl bg-neutral-800 shadow-lg [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
      />
    </div>
  );
}
