import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type {
  AssessmentQuestion,
  AssessmentSummary,
  AssignedRemediation,
  CourseDetail,
  CourseDocument,
  Enrollment,
  RemediationTask,
} from '@/lib/types';
import { AuthoringPanel } from './authoring-panel';
import { StudentAssessments } from './student-assessments';

export default async function AssessmentPage(props: {
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
          await renderAuthoring(id, token, course)
        ) : (
          await renderStudent(id, token)
        )}
      </main>
    </>
  );
}

async function renderAuthoring(
  courseId: string,
  token: string,
  course: CourseDetail,
) {
  const [questions, tasks, documents] = await Promise.all([
    api<AssessmentQuestion[]>(`/courses/${courseId}/assessment/questions`, {
      token,
    }),
    api<RemediationTask[]>(`/courses/${courseId}/assessment/tasks`, { token }),
    api<CourseDocument[]>(`/courses/${courseId}/assessment/documents`, {
      token,
    }),
  ]);
  return (
    <>
      <div className="mt-4">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
          Class-end assessment
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Build a multiple-choice question bank per topic and the remediation
          tasks to assign when a student misses that topic. When a live session
          ends, students get a quiz from the bank — miss a topic and its tasks
          are assigned automatically.
        </p>
      </div>
      <AuthoringPanel
        courseId={courseId}
        sections={course.sections}
        questions={questions}
        tasks={tasks}
        documents={documents}
      />
    </>
  );
}

async function renderStudent(courseId: string, token: string) {
  // Only enrolled students have assessments; guard against a stray visit.
  const enrollments = await api<Enrollment[]>('/courses/enrolled', { token });
  if (!enrollments.some((e) => e.courseId === courseId)) notFound();

  const [assessments, remediation] = await Promise.all([
    api<AssessmentSummary[]>(`/courses/${courseId}/assessment/mine`, { token }),
    api<AssignedRemediation[]>(`/courses/${courseId}/remediation/mine`, {
      token,
    }),
  ]);
  return (
    <StudentAssessments
      courseId={courseId}
      assessments={assessments}
      remediation={remediation}
    />
  );
}
