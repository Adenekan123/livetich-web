'use client';

import { useActionState } from 'react';
import {
  submitAssignment,
  type AssignmentActionState,
} from '@/app/actions/assignments';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass } from '@/lib/ui';
import type { Submission } from '@/lib/types';

const initial: AssignmentActionState = { error: null };

export function SubmitAssignmentForm({
  courseId,
  assignmentId,
  submission,
}: {
  courseId: string;
  assignmentId: string;
  submission: Submission | null;
}) {
  const [state, action] = useActionState(submitAssignment, initial);
  const graded = submission?.grade != null;

  return (
    <form action={action} className="mt-3 space-y-2.5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <FormError message={state.error} />

      {graded && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
          <span className="font-semibold text-neutral-900">Graded: {submission!.grade} pts</span>
          {submission!.feedback && (
            <p className="mt-0.5 text-neutral-600">{submission!.feedback}</p>
          )}
        </div>
      )}

      <textarea
        name="content"
        rows={3}
        defaultValue={submission?.content ?? ''}
        placeholder="Type your submission…"
        className={`${inputClass} resize-none`}
      />
      <input
        name="fileUrl"
        defaultValue={submission?.fileUrl ?? ''}
        placeholder="…or paste a file link (Google Drive, GitHub, etc.)"
        className={inputClass}
      />
      <div className="flex items-center gap-3">
        <SubmitButton size="sm" pendingLabel="Submitting…">
          {submission ? 'Update submission' : 'Submit'}
        </SubmitButton>
        {submission && !graded && (
          <span className="text-xs text-neutral-400">
            Submitted {new Date(submission.submittedAt).toLocaleString()}
          </span>
        )}
        {state.ok && <span className="text-xs font-medium text-neutral-600">✓ Saved</span>}
      </div>
    </form>
  );
}
