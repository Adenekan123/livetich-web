'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { btn } from '@/lib/ui';
import type { AssessmentSummary } from '@/lib/types';

/**
 * The class-end assessment gate. After a student leaves a live class an
 * assessment materializes; taking it is not optional. This mounts for
 * enrolled students and, if it finds a pending (unsubmitted) assessment,
 * renders an UN-CLOSABLE modal — no close button, no Escape, no backdrop
 * dismiss. The only way forward is to start the assessment.
 *
 * Detection is client-side (GET /courses/:courseId/assessment/mine) so the
 * gate re-checks whenever the student lands back on the program page after a
 * class, without a full server round-trip owning the block.
 */
export function AssessmentGate({ courseId }: { courseId: string }) {
  const [pending, setPending] = useState<AssessmentSummary | null>(null);
  const startRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getRealtimeToken();
        if (!token) return;
        const res = await fetch(
          `${API_URL}/courses/${courseId}/assessment/mine`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as AssessmentSummary[];
        // Pending = the student has no submitted attempt yet. Oldest first so
        // a backlog is cleared in the order it accrued.
        const outstanding = rows
          .filter((a) => !a.attempt || a.attempt.submittedAt === null)
          .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
        if (!cancelled) setPending(outstanding[0] ?? null);
      } catch {
        // A failed check must never trap the student — leave the gate closed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // Move focus to the single action and lock body scroll while gated.
  useEffect(() => {
    if (!pending) return;
    startRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4 backdrop-blur-sm"
      // No onClick dismiss: the backdrop is inert on purpose.
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="assessment-gate-title"
        aria-describedby="assessment-gate-desc"
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:p-7"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-700">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
          Assessment due
        </span>
        <h2
          id="assessment-gate-title"
          className="mt-4 font-display text-xl font-extrabold tracking-tight text-neutral-950"
        >
          Complete your class assessment
        </h2>
        <p id="assessment-gate-desc" className="mt-2 text-sm text-neutral-600">
          You have an assessment{pending.topic ? ` on ${pending.topic}` : ''}{' '}
          waiting from your last class
          {pending.questionCount > 0
            ? ` — ${pending.questionCount} question${pending.questionCount === 1 ? '' : 's'}`
            : ''}
          . Take it now to keep your progress and points up to date.
        </p>
        <div className="mt-6">
          <Link
            ref={startRef}
            href={`/courses/${courseId}/assessment/${pending.id}`}
            className={btn('primary', 'lg', 'w-full')}
          >
            Start assessment →
          </Link>
        </div>
      </div>
    </div>
  );
}
