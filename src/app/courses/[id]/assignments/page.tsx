import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { isPluginEnabled, PLUGIN_CODE_INSTRUCTION } from '@/lib/plugins';
import type {
  AssignmentTracking,
  CourseDetail,
  Enrollment,
  LiveSession,
  StudentAssignment,
  StudentGroup,
  StudentRef,
} from '@/lib/types';
import { AssignmentsSection } from '../assignments-section';
import { AssignmentLab } from '../assignment-lab';

export const metadata = { title: 'Assignment lab — livetich' };

/** A session, labelled for the "attach to session" picker. */
function sessionLabel(s: LiveSession): string {
  const when = new Date(s.scheduledAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const status =
    s.status === 'ENDED' ? 'Ended' : s.status === 'LIVE' ? 'Live' : 'Scheduled';
  return `${when} · ${status}`;
}

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

  const isOwner = user.role === 'INSTRUCTOR' && user.sub === course.instructorId;
  const canManage = isOwner || user.role === 'ORG_ADMIN';

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

        {canManage ? (
          <ManagerLab courseId={id} token={token} />
        ) : (
          <StudentAssignments courseId={id} token={token} />
        )}
      </main>
    </>
  );
}

/** Instructor/admin dashboard: tracking + groups + sessions in one surface. */
async function ManagerLab({
  courseId,
  token,
}: {
  courseId: string;
  token: string;
}) {
  const [tracking, groups, students, sessions] = await Promise.all([
    api<AssignmentTracking[]>(`/courses/${courseId}/assignments/tracking`, {
      token,
    }),
    api<StudentGroup[]>(`/courses/${courseId}/groups`, { token }),
    api<{ student: StudentRef }[]>(`/courses/${courseId}/students`, { token }),
    api<LiveSession[]>(`/sessions?courseId=${courseId}`, { token }),
  ]);

  const roster = students.map((s) => s.student);
  const sessionOptions = sessions.map((s) => ({
    id: s.id,
    label: sessionLabel(s),
  }));

  return (
    <AssignmentLab
      courseId={courseId}
      tracking={tracking}
      groups={groups}
      roster={roster}
      sessions={sessionOptions}
    />
  );
}

/** Student view: the assignments they can submit to. */
async function StudentAssignments({
  courseId,
  token,
}: {
  courseId: string;
  token: string;
}) {
  const enrollments = await api<Enrollment[]>('/courses/enrolled', { token });
  const isEnrolled = enrollments.some((e) => e.courseId === courseId);
  const assignments = await api<StudentAssignment[]>(
    `/courses/${courseId}/assignments`,
    { token },
  );
  // The code-language picker is a Code Instruction surface — off by default.
  const codeInstruction = await isPluginEnabled(PLUGIN_CODE_INSTRUCTION, token);

  return (
    <AssignmentsSection
      courseId={courseId}
      canManage={false}
      isEnrolled={isEnrolled}
      assignments={assignments}
      codeInstruction={codeInstruction}
    />
  );
}
