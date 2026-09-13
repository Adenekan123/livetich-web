'use client';

import { useEffect, useState } from 'react';
import { API_URL, setApiBase } from '@/lib/api';
import { setRecorderToken } from '@/lib/client-token';
import { RECORDER_COOKIE } from '@/lib/recorder-cookie';
import { ClassRoom } from '@/app/sessions/[id]/class-room';
import type { RoomUser, StageView } from '@/lib/realtime-contract';

/**
 * How long the classroom gets to assemble before egress is told to start.
 *
 * The room has to reach LiveKit, the board its socket, and the roster arrives
 * over a third connection — none of which report readiness anywhere this
 * component can see. Signalling early costs a second of half-drawn classroom at
 * the head of the file; not signalling at all costs the whole recording.
 */
const SETTLE_MS = 3000;

interface RecorderContext {
  livekitToken: string;
  url: string | null;
  room: string;
  courseTitle: string;
  courseId: string;
  me: RoomUser;
  /** Render the host's classroom rather than the observer's. See the note on
   *  the API side: it changes the UI only, never the LiveKit identity. */
  teaching: boolean;
  /** The surface the class is on right now, so the first frame is the right one. */
  view: StageView;
  /** Add-on packs for the course's workspace. The classroom only mounts the
   *  mushaf and the shared editor when these are on, so a wrong answer here is
   *  a surface silently missing from the recording. */
  packs: {
    islamicEducation: boolean;
    codeInstruction: boolean;
    testPrep: boolean;
  };
}

/**
 * The frame LiveKit records.
 *
 * It renders the classroom itself — the same component the instructor is
 * looking at — rather than a reconstruction of it. Every attempt to assemble
 * "just the important parts" drifted out of step with the real thing: cameras
 * that showed whoever published last, a grid with no colour or names on it, and
 * two of the four surfaces silently replaced by the whiteboard. Rendering the
 * real classroom cannot drift, because there is nothing to keep in step.
 *
 * It is safe to do because the API answers a recorder token with a hidden,
 * per-recording identity everywhere it matters: LiveKit (so the instructor is
 * not evicted by a duplicate identity, and nobody sees a participant join), the
 * room socket (shadow — no presence, but the roster is sent so this view is
 * populated), and attendance (no phantom on the register).
 *
 * This page is a room composite's template, not a web egress: LiveKit mixes the
 * lesson's audio server-side and only draws this. Web egress was abandoned
 * because it records the browser's own speakers, and a browser will not play
 * sound to a page nobody has ever clicked — every such recording came out with
 * a good picture and an audio track of pure silence.
 *
 * It is still not a page for people: nothing here is driven by anyone, and it
 * holds one narrowly-scoped token that dies with the lesson. But it is now a
 * faithful mirror, which means a recording carries whatever is on the
 * instructor's screen — the chat included. That is the intent; it is also worth
 * remembering before a recording is shared outside the class.
 */
export function RecorderView({
  sessionId,
  token,
  apiBase,
}: {
  sessionId: string;
  token: string;
  /**
   * Where this browser can reach the API. Supplied by the API when it mints
   * the recorder URL, because the build-time NEXT_PUBLIC_API_URL is written
   * for the team's own browsers and is routinely a localhost that means
   * nothing on LiveKit's machines.
   */
  apiBase?: string;
}) {
  // Must be set before the classroom's own effects run, so it is done during
  // the first render rather than in an effect. Idempotent module state.
  useState(() => {
    // Before the token: the room, the board and the mushaf all read the API
    // base the moment their effects run, and there is no second chance to
    // redirect them.
    if (apiBase) setApiBase(apiBase);
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
  const [fault, setFault] = useState<string | null>(null);

  // Exchange the recorder token for what the classroom needs to render: who it
  // is rendering as, and which course the session belongs to.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${API_URL}/sessions/${sessionId}/recorder-context`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`recorder-context ${res.status}`);
        if (!cancelled) setCtx((await res.json()) as RecorderContext);
      } catch (e) {
        if (!cancelled)
          setFault(e instanceof Error ? e.message : 'context failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, token]);

  // Tell egress the frame is worth recording.
  //
  // This is not optional and it is not web-egress-only, which is the mistake
  // that produced a run of "Failed — Start signal not received": a *custom*
  // room-composite template is held at the gate exactly like a web egress is,
  // and LiveKit gives up after about a minute of waiting. LiveKit's own stock
  // templates send it too. Only the built-in layouts are exempt, and this page
  // is not one.
  useEffect(() => {
    if (!ctx) return;
    const t = setTimeout(() => {
      // Read by LiveKit from the browser's console; not for humans.
      console.log('START_RECORDING');
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [ctx]);

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

  // Nothing at all until the context lands: the classroom cannot be rendered
  // without knowing who it is for. Egress is still waiting for the signal, so
  // this state is never filmed.
  if (!ctx) return <div className="h-screen w-screen bg-neutral-900" />;

  return (
    <div className="livetich-recorder">
      <ClassRoom
        sessionId={sessionId}
        courseId={ctx.courseId}
        courseTitle={ctx.courseTitle}
        me={ctx.me}
        teaching={ctx.teaching}
        initialView={ctx.view}
        // Never let the recorder decide to save bandwidth. Its browser is
        // LiveKit's, and whatever that container reports for connection type
        // was enough to switch data saver on — which unsubscribes every remote
        // camera, so the recording came out with the room but no faces in it.
        dataSaverDefault={false}
        islamicEducation={ctx.packs.islamicEducation}
        codeInstruction={ctx.packs.codeInstruction}
        testPrep={ctx.packs.testPrep}
      />
    </div>
  );
}
