import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type { Certificate, CourseDetail, OrgMember } from '@/lib/types';
import { CourseRosterPanel, type RosterRow } from '../course-roster-panel';

export default async function RosterPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');
  // Roster management is admin-only.
  if (user.role !== 'ORG_ADMIN') redirect(`/courses/${id}`);

  let course: CourseDetail;
  try {
    course = await api<CourseDetail>(`/courses/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const [roster, orgStudents, certs] = await Promise.all([
    api<RosterRow[]>(`/courses/${id}/students`, { token }),
    api<OrgMember[]>('/organizations/students', { token }),
    api<Certificate[]>(`/certificates/course/${id}`, { token }),
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
        <CourseRosterPanel
          courseId={id}
          enrolled={roster}
          allStudents={orgStudents}
          certifiedIds={certs.map((c) => c.studentId)}
        />
      </main>
    </>
  );
}
