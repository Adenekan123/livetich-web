import Link from 'next/link';
import type { ManagedAssignment, StudentAssignment } from '@/lib/types';
import { AddAssignmentForm } from './add-assignment-form';
import { SubmitAssignmentForm } from './submit-assignment-form';

type Row = StudentAssignment | ManagedAssignment;

function dueLabel(dueAt: string | null): string | null {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AssignmentsSection({
  courseId,
  canManage,
  isEnrolled,
  assignments,
  groups = [],
  codeInstruction = false,
}: {
  courseId: string;
  canManage: boolean;
  isEnrolled: boolean;
  assignments: Row[];
  groups?: { id: string; name: string; memberCount: number }[];
  /** Code Instruction pack on — surfaces the code-language picker on submit. */
  codeInstruction?: boolean;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Assignments</h2>
        {canManage && <AddAssignmentForm courseId={courseId} groups={groups} />}
      </div>

      {assignments.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-6 text-sm text-neutral-500">
          No assignments yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {assignments.map((a) => {
            const due = dueLabel(a.dueAt);
            return (
              <div
                key={a.id}
                className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-neutral-950">{a.title}</h3>
                      {a.group && (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                          {a.group.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {due ? `Due ${due}` : 'No due date'}
                      {a.maxPoints != null && (
                        <>
                          <span className="mx-1.5 text-neutral-300">·</span>
                          {a.maxPoints} pts
                        </>
                      )}
                    </p>
                  </div>
                  {canManage && 'submissionCount' in a && (
                    <Link
                      href={`/courses/${courseId}/assignments/${a.id}`}
                      className="shrink-0 text-sm font-semibold text-signal-700 hover:text-signal-600"
                    >
                      {a.submissionCount} submission{a.submissionCount === 1 ? '' : 's'} →
                    </Link>
                  )}
                </div>

                {a.instructions && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">
                    {a.instructions}
                  </p>
                )}

                {!canManage &&
                  ('mySubmission' in a ? (
                    isEnrolled ? (
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
                    )
                  ) : null)}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
