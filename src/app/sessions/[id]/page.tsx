import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { btn } from '@/lib/ui';
import type { CourseDetail, LiveSession } from '@/lib/types';
import { ClassRoom } from './class-room';

export default async function SessionPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  let session: LiveSession;
  try {
    session = await api<LiveSession>(`/sessions/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const course = await api<CourseDetail>(`/courses/${session.courseId}`);

  if (session.status === 'ENDED') {
    return (
      <>
        <Header />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <span className="text-4xl">🎬</span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            This class has ended
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            The live session for {course.title} is over. Recordings and
            certificates appear on the course page.
          </p>
          <Link
            href={`/courses/${course.id}`}
            className={btn('primary', 'md', 'mt-6')}
          >
            Back to course
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
              <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-500" />
              LIVE
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {course.title}
            </h1>
          </div>
          <Link
            href={`/courses/${course.id}`}
            className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← Course page
          </Link>
        </div>
        <ClassRoom
          sessionId={id}
          me={{ userId: user.sub, name: user.name, role: user.role }}
        />
      </main>
    </>
  );
}
