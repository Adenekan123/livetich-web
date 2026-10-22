'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PiCode,
  PiCheckCircle,
  PiArrowUUpLeft,
  PiPlay,
  PiPlus,
} from 'react-icons/pi';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [launchable, setLaunchable] = useState<Launchable[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newLanguage, setNewLanguage] = useState('JavaScript');
  const [newRequirements, setNewRequirements] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [newKind, setNewKind] = useState<'LIVE' | 'ASSIGNMENT'>('LIVE');
  const [dueAt, setDueAt] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

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

  const createAndLaunch = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const requirements = newRequirements
        .split('\n')
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text) => ({ text, mandatory: true }));
      if (requirements.length === 0) {
        setError('Add at least one requirement so students know what to build.');
        return;
      }
      if (requirements.some((requirement) => requirement.text.length < 3)) {
        setError('Each requirement needs at least 3 characters.');
        return;
      }

      setBusy('create');
      setError(null);
      try {
        const res = await authFetch(`/coding/courses/${courseId}/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: newKind,
            sessionId,
            title: newTitle.trim(),
            language: newLanguage.trim() || undefined,
            workspacePath: workspacePath.trim() || undefined,
            dueAt:
              newKind === 'ASSIGNMENT' && dueAt
                ? new Date(dueAt).toISOString()
                : undefined,
            requirements,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { message?: string | string[] }
            | null;
          const message = Array.isArray(body?.message)
            ? body.message.join(' ')
            : body?.message;
          throw new Error(message || `Couldn't create the exercise (${res.status})`);
        }
        setNotice(
          newKind === 'LIVE'
            ? 'Exercise launched. Students can open it from the Coding panel.'
            : 'Homework posted for this class. Students can find it in their Coding list.',
        );
        window.setTimeout(() => setNotice(null), 7000);
        setCreating(false);
        setPicking(false);
        setNewTitle('');
        setNewRequirements('');
        setWorkspacePath('');
        setDueAt('');
        setNewKind('LIVE');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [courseId, dueAt, newKind, newLanguage, newRequirements, newTitle, sessionId, workspacePath],
  );

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
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () =>
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
    const first = focusable()?.[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPicking(false);
        setCreating(false);
        return;
      }
      if (e.key === 'Tab') {
        const items = focusable();
        if (!items?.length) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
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
            className="min-h-11 rounded-lg px-3 text-xs font-semibold text-signal-400 transition hover:bg-white/5 hover:text-signal-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400"
          >
            {task ? 'Switch task' : '+ Start a task'}
          </button>
        )}
      </div>

      {/* Live task banner */}
      {notice && (
        <p role="status" className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs leading-relaxed text-emerald-200">
          {notice}
        </p>
      )}
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
              <>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-3">
                <p className="text-xs leading-relaxed text-neutral-300">
                  Work in the shared editor or continue in your local IDE. The
                  task will be waiting in Livetich&apos;s Coding view.
                </p>
                <a
                  href={`vscode://UsmanAdenekan.livetich/join?sessionId=${encodeURIComponent(sessionId)}`}
                  className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-signal-500 px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-signal-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-300"
                >
                  <PiCode className="h-4 w-4" /> Open this class in VS Code
                </a>
                <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
                  On a laptop, snap VS Code beside this class window to code along.
                </p>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
              Open it in your editor — Livetich&nbsp;→&nbsp;Coding — to submit.
            </p>
              </>
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
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coding-task-picker-title"
            className="max-h-[90dvh] w-full max-w-sm overflow-y-auto overscroll-contain rounded-t-2xl border border-white/10 bg-[var(--room-panel)] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl md:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 id="coding-task-picker-title" className="text-sm font-semibold text-white">
                {creating ? 'Create coding work' : 'Start a coding task'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPicking(false);
                  setCreating(false);
                  setError(null);
                }}
                aria-label="Close coding task picker"
                className="min-h-11 min-w-11 rounded-lg px-3 text-xs text-neutral-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400"
              >
                Close
              </button>
            </div>
            {creating ? (
              <form className="space-y-3" onSubmit={createAndLaunch}>
                <p className="text-xs leading-relaxed text-neutral-400">
                  Turn today’s lesson into practice now or homework for later.
                  Students can work in the shared editor or continue in their
                  local IDE.
                </p>
                <fieldset className="space-y-1.5">
                  <legend className="text-xs font-medium text-neutral-300">When should students do it?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={newKind === 'LIVE'}
                      onClick={() => setNewKind('LIVE')}
                      className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400 ${newKind === 'LIVE' ? 'border-signal-400/50 bg-signal-400/10 text-signal-200' : 'border-white/10 text-neutral-400 hover:bg-white/5'}`}
                    >
                      <span className="block font-semibold">Practice now</span>
                      <span className="mt-0.5 block text-[11px] opacity-75">Starts in this class</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={newKind === 'ASSIGNMENT'}
                      onClick={() => setNewKind('ASSIGNMENT')}
                      className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400 ${newKind === 'ASSIGNMENT' ? 'border-signal-400/50 bg-signal-400/10 text-signal-200' : 'border-white/10 text-neutral-400 hover:bg-white/5'}`}
                    >
                      <span className="block font-semibold">Homework</span>
                      <span className="mt-0.5 block text-[11px] opacity-75">Keep working after class</span>
                    </button>
                  </div>
                </fieldset>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-neutral-300">Exercise name</span>
                  <input
                    autoFocus
                    required
                    minLength={3}
                    maxLength={200}
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="Build a React counter"
                    className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/30"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-neutral-300">Language or framework</span>
                  <input
                    value={newLanguage}
                    onChange={(event) => setNewLanguage(event.target.value)}
                    placeholder="JavaScript, React, Python…"
                    maxLength={60}
                    className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/30"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-neutral-300">What students should build</span>
                  <textarea
                    required
                    rows={4}
                    value={newRequirements}
                    onChange={(event) => setNewRequirements(event.target.value)}
                    placeholder={'One requirement per line, for example:\nShow the current count\nAdd buttons to increase and decrease it'}
                    className="w-full resize-y rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm leading-relaxed text-white placeholder:text-neutral-500 focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/30"
                  />
                  <span className="block text-[11px] text-neutral-500">Each line becomes a checklist item.</span>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-neutral-300">Student project folder <span className="font-normal text-neutral-500">(optional)</span></span>
                  <input
                    value={workspacePath}
                    onChange={(event) => setWorkspacePath(event.target.value)}
                    placeholder="live-exercises/react-counter"
                    maxLength={255}
                    pattern="^(?!/)(?!.*\.\.)[A-Za-z0-9._/-]+$"
                    title="Use a relative path inside the student's course repository."
                    className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/30"
                  />
                  <span className="block text-[11px] leading-relaxed text-neutral-500">If students have a course GitHub workspace, this tells them where to keep the exercise.</span>
                </label>
                {newKind === 'ASSIGNMENT' && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-neutral-300">Due date <span className="font-normal text-neutral-500">(optional)</span></span>
                    <input
                      type="datetime-local"
                      value={dueAt}
                      onChange={(event) => setDueAt(event.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-white focus:border-signal-400 focus:outline-none focus:ring-2 focus:ring-signal-400/30"
                    />
                  </label>
                )}
                {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy === 'create' || newTitle.trim().length < 3 || !newRequirements.trim()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-signal-500 px-3 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-signal-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-300"
                  >
                    <PiPlay className="h-3.5 w-3.5" />
                    {busy === 'create'
                      ? newKind === 'LIVE' ? 'Launching…' : 'Posting…'
                      : newKind === 'LIVE' ? 'Create and launch' : 'Post homework'}
                  </button>
                  <button
                    type="button"
                    disabled={busy === 'create'}
                    onClick={() => {
                      setCreating(false);
                      setError(null);
                    }}
                    className="min-h-10 rounded-lg px-3 py-2 text-xs font-medium text-neutral-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                  >
                    Back to tasks
                  </button>
                </div>
              </form>
            ) : launchable === null ? (
              <p className="py-6 text-center text-xs text-neutral-500">Loading…</p>
            ) : launchable.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-500">
                No saved live exercises for this class yet. Create one below;
                it will also be available for future classes.
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
            {!creating && launchable !== null && (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setError(null);
                }}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-signal-400/30 bg-signal-400/10 px-3 py-2.5 text-sm font-semibold text-signal-300 transition hover:bg-signal-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400"
              >
                <PiPlus className="h-4 w-4" /> Create exercise or homework
              </button>
            )}
            {!creating && error && <p role="alert" className="mt-2 text-xs text-rose-400">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
