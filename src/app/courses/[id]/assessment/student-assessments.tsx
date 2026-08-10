'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { PiCheckCircle } from 'react-icons/pi';
import { markRemediationDone } from '@/app/actions/assessment';
import { btn, cardClass, cn } from '@/lib/ui';
import type { AssessmentSummary, AssignedRemediation } from '@/lib/types';

export function StudentAssessments({
  courseId,
  assessments,
  remediation,
}: {
  courseId: string;
  assessments: AssessmentSummary[];
  remediation: AssignedRemediation[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pendingTasks = remediation.filter((r) => r.status === 'PENDING');
  const doneTasks = remediation.filter((r) => r.status === 'DONE');

  return (
    <div className="mt-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
        Assessments
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-500">
        A short quiz after each class. Miss a topic and we&apos;ll give you
        practice to catch up.
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Remediation first — it's the actionable "catch up" work. */}
      {pendingTasks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-neutral-900">
            Practice to catch up
          </h2>
          <div className="mt-3 space-y-3">
            {pendingTasks.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      {r.task.section.title}
                    </span>
                    <p className="mt-1.5 font-semibold text-amber-900">
                      {r.task.title}
                    </p>
                    {r.task.instructions && (
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-amber-800">
                        {r.task.instructions}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setError(null);
                      start(async () => {
                        const res = await markRemediationDone(courseId, r.id);
                        if (res.error) setError(res.error);
                      });
                    }}
                    disabled={pending}
                    className={cn(btn('primary', 'sm'), 'shrink-0')}
                  >
                    Mark done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quiz list */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-neutral-900">Your quizzes</h2>
        {assessments.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
            No quizzes yet — one appears here after each live class.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {assessments.map((a) => {
              const taken = a.attempt?.submittedAt != null;
              return (
                <div
                  key={a.id}
                  className={cn(
                    cardClass,
                    'flex flex-wrap items-center justify-between gap-3 p-4',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-950">
                      {a.topic ?? 'Class quiz'}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {a.questionCount} question{a.questionCount === 1 ? '' : 's'}
                      {taken && a.attempt && (
                        <>
                          <span className="mx-1.5 text-neutral-300">·</span>
                          Scored {a.attempt.score}/{a.attempt.total}
                        </>
                      )}
                    </p>
                  </div>
                  {taken ? (
                    <Link
                      href={`/courses/${courseId}/assessment/${a.id}`}
                      className={btn('secondary', 'sm')}
                    >
                      Review
                    </Link>
                  ) : (
                    <Link
                      href={`/courses/${courseId}/assessment/${a.id}`}
                      className={btn('primary', 'sm')}
                    >
                      Take quiz
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {doneTasks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-neutral-900">Completed practice</h2>
          <ul className="mt-3 space-y-2">
            {doneTasks.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 text-sm text-neutral-500"
              >
                <PiCheckCircle className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-neutral-700">
                  {r.task.title}
                </span>
                <span className="text-neutral-300">·</span>
                {r.task.section.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
