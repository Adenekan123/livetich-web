'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { PiRecordFill, PiStopFill } from 'react-icons/pi';
import {
  sessionRecordingState,
  startSessionRecording,
  stopSessionRecording,
} from '@/app/actions/recordings';
import { btn, cn } from '@/lib/ui';
import { playRecordingTone } from './recording-sound';

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
  const [confirmSilent, setConfirmSilent] = useState(false);
  const [, setTick] = useState(0);
  const [pending, start] = useTransition();
  // The poll loop reschedules itself outside React's cycle, so it reads the
  // current state through a ref rather than a captured value.
  const startedAtRef = useRef<string | null>(null);
  // The failure the instructor has already acknowledged, so it does not come
  // back on the next poll.
  const dismissedRef = useRef<string | null>(null);
  /** Which failure the visible message belongs to. */
  const lastFailureIdRef = useRef<string | null>(null);
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
        // Surface a failure only while it is still the latest thing that
        // happened. Left unconditional, a single old failure sat behind the
        // button forever — including after a later recording succeeded, which
        // says the opposite of the truth.
        if (state.recording) {
          setError(null);
        } else if (state.last?.status === 'FAILED') {
          lastFailureIdRef.current = state.last.id;
          if (state.last.id !== dismissedRef.current) {
            setError(state.last.error ?? 'The last recording failed');
          }
        } else {
          setError(null);
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

  const begin = async () => {
    const res = await startSessionRecording(sessionId);
    if (res.error) setError(res.error);
    else {
      setStartedAt(new Date().toISOString());
      playRecordingTone('start');
    }
  };

  if (!available) {
    return (
      <button
        type="button"
        disabled
        aria-label="Recording unavailable — needs setup"
        title="Recording needs cloud storage configured for this deployment. An administrator sets R2 credentials on the API."
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-white/35"
      >
        <PiRecordFill className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Setup</span>
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
              else {
                setStartedAt(null);
                // Only on success: a chime after a failed stop would say the
                // opposite of what happened.
                playRecordingTone('stop');
              }
              return;
            }
            // Asked again here rather than trusting the poll: the microphone
            // can be switched off in the half minute between two of them, and
            // this is the moment the answer has to be right.
            try {
              const fresh = await sessionRecordingState(sessionId);
              if (!fresh.micLive) {
                setConfirmSilent(true);
                return;
              }
            } catch {
              // If we cannot tell, do not stand in the way of recording.
            }
            await begin();
          })
        }
        aria-label={recording ? 'Stop recording' : 'Record this class'}
        title={recording ? 'Stop recording' : 'Record this class'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50',
          recording
            ? 'bg-red-600 text-white hover:bg-red-500'
            : 'bg-white/10 text-neutral-200 hover:bg-white/15',
        )}
      >
        {recording ? (
          <>
            {/* A steady square reads as "stop"; the pulse says it is live. */}
            <PiStopFill className="h-3.5 w-3.5 animate-pulse" aria-hidden />
            <span className="tabular-nums">{elapsed(startedAt)}</span>
          </>
        ) : (
          <>
            <PiRecordFill className="h-3.5 w-3.5 text-red-500" aria-hidden />
            <span className="hidden sm:inline">Record</span>
          </>
        )}
      </button>

      {confirmSilent && (
        <div
          className="fixed inset-0 z-[700] grid place-items-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Your microphone is off"
          onClick={() => setConfirmSilent(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-neutral-900">
              Your microphone is off
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              This recording will have no sound — the board and the screen will
              be captured, but nothing you say. Turn your microphone on first if
              the lesson needs your voice.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSilent(false)}
                className={cn(btn('primary', 'sm'))}
              >
                Turn on my mic first
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setConfirmSilent(false);
                    await begin();
                  })
                }
                className={cn(btn('ghost', 'sm'), 'text-neutral-500')}
              >
                Record without sound
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <button
          type="button"
          title={`${error} — click to dismiss`}
          onClick={() => {
            dismissedRef.current = lastFailureIdRef.current;
            setError(null);
          }}
          className="max-w-[10rem] truncate text-left text-[11px] font-semibold text-red-400 hover:text-red-300"
        >
          {error}
        </button>
      )}
    </div>
  );
}
