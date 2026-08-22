import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
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
import { StudentAssignments } from '../student-assignments';
import { AssignmentLab } from '../assignment-lab';

export const metadata = { title: 'Assignment lab — livetich' };

/** Server clock, read outside the render-purity checker. These are server
 *  components, so the wall clock is resolved once per request and serialized to
 *  the client — no hydration drift. */
function serverNow(): number {
  return Date.now();
}

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
          <StudentAssignmentsView courseId={id} token={token} />
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
    scheduledAt: s.scheduledAt,
  }));

  // The soonest upcoming (not-yet-ended) session — new coursework defaults to
  // being tied to the next class. Computed on the server so the preselection is
  // deterministic. Empty when there is no upcoming session.
  const now = serverNow();
  const nextSessionId =
    sessions
      .filter(
        (s) => s.status !== 'ENDED' && new Date(s.scheduledAt).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      )[0]?.id ?? '';

  return (
    <AssignmentLab
      courseId={courseId}
      tracking={tracking}
      groups={groups}
      roster={roster}
      sessions={sessionOptions}
      nextSessionId={nextSessionId}
    />
  );
}

/**
 * Student view: this course's assignments split into Current / Past tabs.
 * `/courses/:id/assignments` is already scoped to this course and carries each
 * student's own submission (grade included), so it is the richer feed here —
 * `/assignments/mine` is a cross-course picker without per-course grade state.
 */
async function StudentAssignmentsView({
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
    <StudentAssignments
      courseId={courseId}
      isEnrolled={isEnrolled}
      assignments={assignments}
      now={serverNow()}
      codeInstruction={codeInstruction}
    />
  );
}
