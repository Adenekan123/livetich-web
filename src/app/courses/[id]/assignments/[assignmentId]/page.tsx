import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { avatarColor, cardClass, cn, initials } from '@/lib/ui';
import type { Assignment, Submission } from '@/lib/types';
import { GradeForm } from '../../grade-form';

export const metadata = { title: 'Submissions — livetich' };

export default async function AssignmentSubmissionsPage(props: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await props.params;
  const token = await getToken();
  if (!token) redirect('/login');

  type Data = {
    assignment: Assignment;
    submissions: Submission[];
    enrolledCount: number;
  };
  let data: Data;
  try {
    data = await api<Data>(`/assignments/${assignmentId}/submissions`, { token });
  } catch (e) {
    // Not the manager (or gone) — bounce back to the course.
    if (e instanceof ApiError) redirect(`/courses/${id}`);
    throw e;
  }

  const { assignment, submissions, enrolledCount } = data;
  const graded = submissions.filter((s) => s.grade != null).length;
  const dueLabel = assignment.dueAt
    ? new Date(assignment.dueAt).toLocaleString()
    : null;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Course
        </Link>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-neutral-950">
          {assignment.title}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {dueLabel ? `Due ${dueLabel}` : 'No due date'}
          {assignment.maxPoints != null && (
            <>
              <span className="mx-1.5 text-neutral-300">·</span>
              {assignment.maxPoints} pts
            </>
          )}
          <span className="mx-1.5 text-neutral-300">·</span>
          {submissions.length}/{enrolledCount} submitted · {graded} graded
        </p>
        {assignment.instructions && (
          <p className="mt-3 whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            {assignment.instructions}
          </p>
        )}

        <div className="mt-8 space-y-4">
          {submissions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-12 text-center text-sm text-neutral-500">
              No submissions yet.
            </p>
          ) : (
            submissions.map((s) => (
              <div key={s.id} className={cn(cardClass, 'p-5')}>
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
                      avatarColor(s.student?.id ?? s.studentId),
                    )}
                    aria-hidden
                  >
                    {initials(s.student?.name ?? '?')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {s.student?.name ?? 'Student'}
                    </p>
                    <p className="truncate text-xs text-neutral-400">
                      Submitted {new Date(s.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  {s.grade != null && (
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
                      {s.grade}
                      {assignment.maxPoints != null ? `/${assignment.maxPoints}` : ''} pts
                    </span>
                  )}
                </div>

                {s.content && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
                    {s.content}
                  </p>
                )}
                {s.fileUrl && (
                  <a
                    href={s.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm font-medium text-signal-700 hover:text-signal-600"
                  >
                    Open attachment ↗
                  </a>
                )}

                <GradeForm
                  submissionId={s.id}
                  courseId={id}
                  assignmentId={assignmentId}
                  grade={s.grade}
                  feedback={s.feedback}
                  maxPoints={assignment.maxPoints}
                />
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
}
