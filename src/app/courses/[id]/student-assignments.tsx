'use client';

import { useMemo, useState } from 'react';
import type { StudentAssignment } from '@/lib/types';
import { cardClass, cn } from '@/lib/ui';
import { SubmitAssignmentForm } from './submit-assignment-form';

type Tab = 'current' | 'past';

function dueLabel(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  return new Date(dueAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Current  = not yet due AND not submitted.
 * Past     = due date passed OR already submitted/graded.
 * A missing due date counts as "not yet due" (never overdue).
 */
function isPast(a: StudentAssignment, now: number): boolean {
  if (a.mySubmission) return true;
  if (a.dueAt && new Date(a.dueAt).getTime() < now) return true;
  return false;
}

type Status =
  | { kind: 'graded'; label: string }
  | { kind: 'submitted'; label: string }
  | { kind: 'overdue'; label: string }
  | { kind: 'due'; label: string };

function statusOf(a: StudentAssignment, now: number): Status {
  const sub = a.mySubmission;
  if (sub && sub.grade != null) {
    const score =
      a.maxPoints != null ? `${sub.grade}/${a.maxPoints}` : `${sub.grade}`;
    return { kind: 'graded', label: `Graded · ${score}` };
  }
  if (sub) return { kind: 'submitted', label: 'Submitted' };
  if (a.dueAt && new Date(a.dueAt).getTime() < now) {
    return { kind: 'overdue', label: 'Overdue' };
  }
  return { kind: 'due', label: 'Not submitted' };
}

const STATUS_STYLE: Record<Status['kind'], string> = {
  graded: 'bg-signal-50 text-signal-700 ring-signal-600/20',
  submitted: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
  overdue: 'bg-red-50 text-red-700 ring-red-600/20',
  due: 'bg-accent-50 text-accent-700 ring-accent-600/20',
};

/**
 * Student assignment feed for a single course, split into exactly two tabs:
 * Current (actionable) and Past (done or overdue).
 */
export function StudentAssignments({
  courseId,
  isEnrolled,
  assignments,
  now,
  codeInstruction = false,
}: {
  courseId: string;
  isEnrolled: boolean;
  assignments: StudentAssignment[];
  /** Server "now" (epoch ms) so due/overdue is deterministic across hydration. */
  now: number;
  codeInstruction?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('current');

  const { current, past } = useMemo(() => {
    const c: StudentAssignment[] = [];
    const p: StudentAssignment[] = [];
    for (const a of assignments) (isPast(a, now) ? p : c).push(a);
    // Current: soonest due first (no-due last). Past: most recent first.
    c.sort((x, y) => (x.dueAt ? new Date(x.dueAt).getTime() : Infinity) -
      (y.dueAt ? new Date(y.dueAt).getTime() : Infinity));
    p.sort((x, y) => (y.dueAt ? new Date(y.dueAt).getTime() : 0) -
      (x.dueAt ? new Date(x.dueAt).getTime() : 0));
    return { current: c, past: p };
  }, [assignments, now]);

  const rows = tab === 'current' ? current : past;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'current', label: 'Current', count: current.length },
    { key: 'past', label: 'Past', count: past.length },
  ];

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-neutral-900">Assignments</h2>

      <div
        role="tablist"
        aria-label="Assignments"
        className="mt-4 flex gap-1 border-b border-neutral-200"
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                'relative -mb-px inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition',
                active
                  ? 'border-b-2 border-signal-600 text-signal-700'
                  : 'border-b-2 border-transparent text-neutral-500 hover:text-neutral-900',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                  active
                    ? 'bg-signal-100 text-signal-700'
                    : 'bg-neutral-100 text-neutral-500',
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
          {tab === 'current'
            ? 'Nothing due right now. You are all caught up.'
            : 'No past assignments yet.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((a) => {
            const status = statusOf(a, now);
            return (
              <li key={a.id} className={cn(cardClass, 'p-4')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-neutral-950">
                        {a.title}
                      </h3>
                      {a.group && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                          {a.group.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      Due {dueLabel(a.dueAt)}
                      {a.maxPoints != null && (
                        <>
                          <span className="mx-1.5 text-neutral-300">·</span>
                          {a.maxPoints} pts
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
                      STATUS_STYLE[status.kind],
                    )}
                  >
                    {status.label}
                  </span>
                </div>

                {a.instructions && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">
                    {a.instructions}
                  </p>
                )}

                {isEnrolled ? (
                  <SubmitAssignmentForm
                    courseId={courseId}
                    assignmentId={a.id}
                    submission={a.mySubmission}
                    codeInstruction={codeInstruction}
                  />
                ) : (
                  <p className="mt-2 text-xs text-neutral-400">
                    Enroll in this program to submit.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
