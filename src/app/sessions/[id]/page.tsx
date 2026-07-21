import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
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
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">This class has ended</h1>
          <Link
            href={`/courses/${course.id}`}
            className="mt-4 inline-block text-indigo-600 hover:underline"
          >
            Back to {course.title}
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-xl font-bold">{course.title}</h1>
          <Link
            href={`/courses/${course.id}`}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← course page
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
