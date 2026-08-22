import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { AssessmentTake } from '@/lib/types';
import { TakeQuiz } from '../take-quiz';

export default async function TakeAssessmentPage(props: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  const { id, assessmentId } = await props.params;
  const token = await getToken();
  if (!token) redirect('/login');

  let take: AssessmentTake;
  try {
    take = await api<AssessmentTake>(`/assessments/${assessmentId}`, { token });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      notFound();
    }
    throw e;
  }

  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href={`/courses/${id}/assessment`}
          className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
        >
          ← Assessments
        </Link>
        <TakeQuiz courseId={id} assessmentId={assessmentId} take={take} />
      </main>
    </>
  );
}
