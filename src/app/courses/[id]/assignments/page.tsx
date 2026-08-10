import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type {
  CourseDetail,
  Enrollment,
  ManagedAssignment,
  StudentAssignment,
  StudentGroup,
} from '@/lib/types';
import { AssignmentsSection } from '../assignments-section';

export default async function AssignmentsPage(props: {
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

  const isOwner =
    user.role === 'INSTRUCTOR' && user.sub === course.instructorId;
  const canManage = isOwner || user.role === 'ORG_ADMIN';
  let isEnrolled = false;
  if (user.role === 'STUDENT') {
    const enrollments = await api<Enrollment[]>('/courses/enrolled', { token });
    isEnrolled = enrollments.some((e) => e.courseId === id);
  }

  const assignments = await api<(StudentAssignment | ManagedAssignment)[]>(
    `/courses/${id}/assignments`,
    { token },
  );

  // Managers can target an assignment at a group; students never see this.
  const groups = canManage
    ? (await api<StudentGroup[]>(`/courses/${id}/groups`, { token })).map(
        (g) => ({ id: g.id, name: g.name, memberCount: g._count.members }),
      )
    : [];

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
        <AssignmentsSection
          courseId={id}
          canManage={canManage}
          isEnrolled={isEnrolled}
          assignments={assignments}
          groups={groups}
        />
      </main>
    </>
  );
}
