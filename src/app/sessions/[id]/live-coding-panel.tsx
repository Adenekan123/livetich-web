'use client';

import { useCallback, useEffect, useState } from 'react';
import { PiCode, PiCheckCircle, PiArrowUUpLeft, PiPlay } from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { cn } from '@/lib/ui';
import type { CodingPointEntry } from '@/lib/realtime-contract';

/** A live coding task in the room, as announced over `coding:task`. */
export interface LiveCodingTask {
  assignmentId: string;
  title: string;
  language: string | null;
  requirementCount: number;
}

/** One submission's changed state, from a `coding:submission` (staff) event. */
export interface LiveCodingReview {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  attemptNumber: number;
  status: string;
  provisionalScore: number | null;
  finalScore: number | null;
  aiConfidence: string | null;
}

/** A launchable task, from GET /coding/teaching filtered to this room's course. */
interface Launchable {
  id: string;
  title: string;
  kind: 'LIVE' | 'ASSIGNMENT';
  courseId: string;
  language: string | null;
  status: string;
}

/** Statuses that still want the instructor's eyes. */
const AWAITING = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'AI_REVIEWED',
  'NEEDS_REVIEW',
]);

function statusLabel(s: string): string {
  return (
    {
      CODING: 'Coding',
      SUBMITTED: 'Submitted',
      UNDER_REVIEW: 'Reviewing',
      AI_REVIEWED: 'AI reviewed',
      NEEDS_REVIEW: 'Needs review',
      PASSED: 'Passed',
      FAILED: 'Failed',
      RETURNED: 'Returned',
    }[s] ?? s
  );
}

function statusTone(s: string): string {
  if (s === 'PASSED') return 'text-emerald-300 bg-emerald-500/10';
  if (s === 'FAILED') return 'text-rose-300 bg-rose-500/10';
  if (s === 'NEEDS_REVIEW' || s === 'RETURNED')
    return 'text-amber-300 bg-amber-500/10';
  if (s === 'CODING') return 'text-neutral-400 bg-white/5';
  return 'text-sky-300 bg-sky-500/10';
}

async function authFetch(path: string, init?: RequestInit) {
  const token = await getRealtimeToken();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token ?? ''}`,
    },
  });
}

/**
 * The live coding-task panel. Everyone sees the points board; the instructor
 * also gets a Start-a-task picker and quick Pass / Return decisions. Full review
 * (files, AI findings, inline feedback) still lives in the VS Code plugin.
 */
export function LiveCodingPanel({
  sessionId,
  courseId,
  isInstructor,
  task,
  points,
  reviews,
}: {
  sessionId: string;
  courseId: string;
  isInstructor: boolean;
  task: LiveCodingTask | null;
  points: CodingPointEntry[];
  reviews: LiveCodingReview[];
}) {
  const [picking, setPicking] = useState(false);
  const [launchable, setLaunchable] = useState<Launchable[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openPicker = useCallback(async () => {
    setPicking(true);
    setError(null);
    setLaunchable(null);
    try {
      const res = await authFetch('/coding/teaching');
      if (!res.ok) throw new Error(`Couldn't load tasks (${res.status})`);
      const all = (await res.json()) as Launchable[];
      setLaunchable(
        all.filter(
          (t) =>
            t.courseId === courseId &&
            t.kind === 'LIVE' &&
            t.status !== 'CLOSED',
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLaunchable([]);
    }
  }, [courseId]);

  const launch = useCallback(
    async (assignmentId: string) => {
      setBusy(assignmentId);
      setError(null);
      try {
        const res = await authFetch(
          `/coding/assignments/${assignmentId}/launch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          },
        );
        if (!res.ok) throw new Error(`Couldn't start task (${res.status})`);
        setPicking(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [sessionId],
  );

  const decide = useCallback(
    async (submissionId: string, decision: 'PASS' | 'RETURN' | 'FAIL') => {
      setBusy(submissionId);
      setError(null);
      try {
        const res = await authFetch(
          `/coding/submissions/${submissionId}/decision`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision }),
          },
        );
        if (!res.ok) throw new Error(`Couldn't save (${res.status})`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  // Close the picker on Escape for keyboard users.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  const awaiting = reviews.filter((r) => AWAITING.has(r.status));

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      {/* Header + start (instructor) */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-signal-400">
          <PiCode className="h-3.5 w-3.5" /> Coding task
        </h3>
        {isInstructor && (
          <button
            type="button"
            onClick={openPicker}
            className="text-xs font-semibold text-signal-400 transition hover:text-signal-300"
          >
            {task ? 'Switch task' : '+ Start a task'}
          </button>
        )}
      </div>

      {/* Live task banner */}
      {task ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            <span className="text-sm font-semibold text-white">
              {task.title}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {[task.language, `${task.requirementCount} requirements`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {!isInstructor && (
            <p className="mt-2 text-xs text-neutral-400">
              Open it in your editor — Livetich&nbsp;→&nbsp;Coding — to submit.
            </p>
          )}
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-neutral-500">
          {isInstructor
            ? 'No task running. Start one to track the room live.'
            : 'No coding task is live right now.'}
        </p>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {/* Points board — everyone */}
      {points.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Standings
          </h4>
          <ol className="mt-2 space-y-0.5">
            {points.map((row, i) => (
              <li
                key={row.studentId}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              >
                <span className="w-5 text-center text-sm text-neutral-500">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm text-neutral-200">
                  {row.name}
                </span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                    statusTone(row.status),
                  )}
                >
                  {statusLabel(row.status)}
                </span>
                <span className="w-9 text-right font-mono text-sm font-semibold text-white">
                  {row.score != null ? row.score : '—'}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Instructor: quick review cards. Full review is in the plugin. */}
      {isInstructor && awaiting.length > 0 && (
        <div className="border-t border-white/10 pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Awaiting your review
          </h4>
          <div className="mt-2 space-y-2">
            {awaiting.map((r) => {
              const score = r.finalScore ?? r.provisionalScore;
              return (
                <div
                  key={r.submissionId}
                  className="rounded-xl border border-white/10 bg-white/5 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm font-medium text-white">
                      {r.studentName}
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400">
                      #{r.attemptNumber}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                        statusTone(r.status),
                      )}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400">
                    {score != null ? `AI score ${score}` : 'Not scored yet'}
                    {r.aiConfidence ? ` · confidence ${r.aiConfidence}` : ''}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy === r.submissionId}
                      onClick={() => decide(r.submissionId, 'PASS')}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <PiCheckCircle className="h-3.5 w-3.5" /> Pass
                    </button>
                    <button
                      type="button"
                      disabled={busy === r.submissionId}
                      onClick={() => decide(r.submissionId, 'RETURN')}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      <PiArrowUUpLeft className="h-3.5 w-3.5" /> Return
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">
            Files, AI findings and inline feedback are in the VS Code plugin.
          </p>
        </div>
      )}

      {/* Task picker */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center">
          <div className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-[var(--room-panel)] p-4 shadow-2xl md:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Start a coding task
              </h3>
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Close
              </button>
            </div>
            {launchable === null ? (
              <p className="py-6 text-center text-xs text-neutral-500">Loading…</p>
            ) : launchable.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-500">
                No live-kind tasks for this class yet. Create one in the plugin
                (Teaching → New coding task).
              </p>
            ) : (
              <ul className="space-y-1.5">
                {launchable.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={busy === t.id}
                      onClick={() => launch(t.id)}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10 disabled:opacity-50"
                    >
                      <PiCode className="h-4 w-4 text-signal-400" />
                      <span className="flex-1 truncate text-sm text-white">
                        {t.title}
                      </span>
                      <span className="flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-1 text-xs font-semibold text-neutral-900">
                        <PiPlay className="h-3 w-3" /> Start
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
