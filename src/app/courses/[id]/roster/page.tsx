import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type { CourseAttendance, CourseDetail } from '@/lib/types';
import { AttendanceTable } from '../attendance-table';

export default async function RosterPage(props: {
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

  // Attendance is for the org-admin or the instructor who owns this course.
  const isOwner = user.sub === course.instructorId;
  const isAdmin = user.role === 'ORG_ADMIN';
  if (!isAdmin && !isOwner) redirect(`/courses/${id}`);

  // Default view: the latest session (the endpoint defaults when sessionId is omitted).
  let attendance: CourseAttendance;
  try {
    attendance = await api<CourseAttendance>(
      `/sessions/course/${id}/attendance`,
      { token },
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) redirect(`/courses/${id}`);
    throw e;
  }

  return (
    <>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
        >
          ← {course.title}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
          Class attendance
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Who joined each session for {course.title}.
        </p>
        <AttendanceTable courseId={id} initial={attendance} />
      </main>
    </>
  );
}
