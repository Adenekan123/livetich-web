'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { PiRecordFill, PiStopFill } from 'react-icons/pi';
import {
  sessionRecordingState,
  startSessionRecording,
  stopSessionRecording,
} from '@/app/actions/recordings';
import { cn } from '@/lib/ui';

/** How often to re-ask while idle, to notice a recording another admin started. */
const IDLE_POLL_MS = 30_000;
/** Faster while recording: the elapsed clock and a failure both need catching. */
const ACTIVE_POLL_MS = 10_000;

function elapsed(fromISO: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(fromISO).getTime()) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const h = Math.floor(m / 60);
  return h > 0
    ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Start and stop recording a class.
 *
 * Rendered only for the instructor, and deliberately shows nothing to anyone
 * else in the room. The server enforces the same thing — the endpoints reject a
 * student — so this is presentation, not the access control.
 *
 * When recording is not configured it stays visible but disabled, saying so.
 * Hiding it was worse: a missing button is indistinguishable from a broken
 * feature, and the instructor has no way to tell which — or who to ask.
 */
export function RecordButton({ sessionId }: { sessionId: string }) {
  const [available, setAvailable] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [pending, start] = useTransition();
  // The poll loop reschedules itself outside React's cycle, so it reads the
  // current state through a ref rather than a captured value.
  const startedAtRef = useRef<string | null>(null);
  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  // Poll rather than push: recording changes once or twice a lesson, and this
  // avoids another socket channel for something so slow-moving.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      try {
        const state = await sessionRecordingState(sessionId);
        if (cancelled) return;
        setAvailable(state.available);
        setStartedAt(state.recording?.createdAt ?? null);
        if (state.last?.status === 'FAILED' && !state.recording) {
          setError(state.last.error ?? 'The last recording failed');
        }
      } catch {
        // A failed check is not worth interrupting a class over; the next one
        // will pick it up.
      }
      if (!cancelled) {
        timer = setTimeout(
          check,
          startedAtRef.current ? ACTIVE_POLL_MS : IDLE_POLL_MS,
        );
      }
    };
    void check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  // Drive the elapsed clock while recording.
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const recording = startedAt !== null;

  if (!available) {
    return (
      <button
        type="button"
        disabled
        title="Recording needs cloud storage configured for this deployment. An administrator sets R2 credentials on the API."
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white/40"
      >
        <PiRecordFill className="h-4 w-4" aria-hidden />
        Record
        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
          Setup
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            if (recording) {
              const res = await stopSessionRecording(sessionId);
              if (res.error) setError(res.error);
              else setStartedAt(null);
              return;
            }
            const res = await startSessionRecording(sessionId);
            if (res.error) setError(res.error);
            else setStartedAt(new Date().toISOString());
          })
        }
        title={recording ? 'Stop recording' : 'Record this class'}
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50',
          recording
            ? 'bg-red-600 text-white hover:bg-red-500'
            : 'bg-white/10 text-white hover:bg-white/20',
        )}
      >
        {recording ? (
          <>
            <PiStopFill className="h-4 w-4" aria-hidden />
            <span className="tabular-nums">{elapsed(startedAt)}</span>
          </>
        ) : (
          <>
            <PiRecordFill className="h-4 w-4 text-red-500" aria-hidden />
            Record
          </>
        )}
      </button>

      {error && (
        <span className="max-w-[16rem] truncate text-xs font-semibold text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
