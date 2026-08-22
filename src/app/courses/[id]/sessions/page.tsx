import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type { CourseDetail, LiveSession } from '@/lib/types';
import { SessionList } from '../session-list';

export default async function SessionHistoryPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');

  let course: CourseDetail;
  try {
    course = await api<CourseDetail>(`/courses/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const sessions = await api<LiveSession[]>(`/sessions?courseId=${id}`, {
    token,
  });

  return (
    <>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
        >
          ← {course.title}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-neutral-950">
          Session history
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every live session held for this program.
        </p>
        {sessions.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-5 py-8 text-center text-sm text-neutral-500">
            No sessions have run yet.
          </p>
        ) : (
          <SessionList sessions={sessions} />
        )}
      </main>
    </>
  );
}
