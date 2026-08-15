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
import { AudioSubmit } from './audio-submit';

const initial: AssignmentActionState = { error: null };

/** Languages a student can tag a code submission with (mirrors the API set). */
const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX / TSX' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
] as const;

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

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-neutral-500">Language</label>
        <select
          name="language"
          defaultValue={submission?.language ?? ''}
          className={`${inputClass} h-9 w-auto py-0 text-sm`}
        >
          <option value="">Plain text</option>
          {CODE_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">
          pick a language to submit code
        </span>
      </div>
      <textarea
        name="content"
        rows={8}
        defaultValue={submission?.content ?? ''}
        placeholder="Type or paste your submission (code or text)…"
        spellCheck={false}
        className={`${inputClass} resize-y font-mono text-[13px] leading-relaxed`}
      />
      <input
        name="fileUrl"
        defaultValue={submission?.fileUrl?.startsWith('/api/files/') ? '' : (submission?.fileUrl ?? '')}
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

      {/* Record or upload a recitation audio / file (uploads immediately). */}
      <AudioSubmit
        assignmentId={assignmentId}
        existing={
          submission
            ? { fileUrl: submission.fileUrl, fileMimeType: submission.fileMimeType }
            : null
        }
      />
    </form>
  );
}
