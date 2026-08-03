'use client';

import { useActionState } from 'react';
import {
  gradeSubmission,
  type AssignmentActionState,
} from '@/app/actions/assignments';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass } from '@/lib/ui';

const initial: AssignmentActionState = { error: null };

export function GradeForm({
  submissionId,
  courseId,
  assignmentId,
  grade,
  feedback,
  maxPoints,
}: {
  submissionId: string;
  courseId: string;
  assignmentId: string;
  grade: number | null;
  feedback: string | null;
  maxPoints: number | null;
}) {
  const [state, action] = useActionState(gradeSubmission, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Grade{maxPoints ? ` / ${maxPoints}` : ''}
        </label>
        <input
          name="grade"
          type="number"
          min={0}
          max={maxPoints ?? undefined}
          defaultValue={grade ?? ''}
          required
          className={`${inputClass} w-24`}
        />
      </div>
      <input
        name="feedback"
        defaultValue={feedback ?? ''}
        placeholder="Feedback (optional)"
        className={`${inputClass} min-w-[12rem] flex-1`}
      />
      <SubmitButton size="sm" pendingLabel="Saving…">
        {grade != null ? 'Update' : 'Grade'}
      </SubmitButton>
      {state.ok && <span className="text-xs font-medium text-neutral-600">✓</span>}
      <FormError message={state.error} />
    </form>
  );
}
