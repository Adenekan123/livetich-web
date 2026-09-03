'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { enroll, unenroll } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { btn } from '@/lib/ui';

/**
 * Student enrolment control. Enrolling is a single primary action. Once
 * enrolled, the state reads as a non-destructive status chip — leaving is a
 * separate, quieter button behind a confirm modal, so a returning student can't
 * drop the cohort by clicking what looks like a status badge. The confirm uses
 * the app's shared ConfirmDialog (matching logout / delete) instead of a native
 * browser popup.
 */
export function EnrollActions({
  courseId,
  isEnrolled,
}: {
  courseId: string;
  isEnrolled: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, startLeave] = useTransition();

  if (!isEnrolled) {
    return (
      <form action={enroll.bind(null, courseId)}>
        <SubmitButton variant="primary" size="lg" pendingLabel="Enrolling…">
          Enroll in cohort
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-signal-50 px-4 py-2 text-sm font-semibold text-signal-700 ring-1 ring-inset ring-signal-200">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="m5 10.5 3.2 3.2L15 6.8"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        You&apos;re enrolled
      </span>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={leaving}
        className={btn('ghost', 'sm')}
      >
        {leaving ? 'Leaving…' : 'Leave cohort'}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          startLeave(async () => {
            await unenroll(courseId);
            router.refresh();
          });
        }}
        pending={leaving}
        title="Leave this cohort?"
        message="You’ll lose your place and any class reminders. You can re-enrol while enrolment is still open."
        confirmLabel="Leave cohort"
        cancelLabel="Stay enrolled"
        variant="danger"
      />
    </div>
  );
}
