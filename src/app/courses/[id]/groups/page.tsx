import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type { CourseDetail, Enrollment, StudentGroup } from '@/lib/types';
import { GroupsManager } from './groups-manager';

/** Roster row from GET /courses/:id/students (manager-scoped enrollments). */
type RosterRow = Enrollment & {
  student: { id: string; name: string; email: string };
};

export default async function GroupsPage(props: {
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

  const isOwner = user.role === 'INSTRUCTOR' && user.sub === course.instructorId;
  const canManage = isOwner || user.role === 'ORG_ADMIN';
  if (!canManage) notFound();

  const [groups, roster] = await Promise.all([
    api<StudentGroup[]>(`/courses/${id}/groups`, { token }),
    api<RosterRow[]>(`/courses/${id}/students`, { token }),
  ]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
        >
          ← {course.title}
        </Link>
        <div className="mt-4">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
            Student groups
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Group students to target assignments at part of the class — a level,
            a project team, or students who need extra practice. A student can be
            in several groups.
          </p>
        </div>
        <GroupsManager
          courseId={id}
          groups={groups}
          roster={roster.map((r) => r.student)}
        />
      </main>
    </>
  );
}
