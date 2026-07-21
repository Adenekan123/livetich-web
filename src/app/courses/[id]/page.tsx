import Link from 'next/link';
import { notFound } from 'next/navigation';
import { enroll, unenroll } from '@/app/actions/courses';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type {
  Certificate,
  CourseDetail,
  Enrollment,
  LiveSession,
} from '@/lib/types';
import { SubmitButton } from '@/components/submit-button';
import { InstructorPanel } from './instructor-panel';
import { SessionList } from './session-list';

export default async function CoursePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);

  let course: CourseDetail;
  try {
    course = await api<CourseDetail>(`/courses/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const sessions = await api<LiveSession[]>(`/sessions?courseId=${id}`);

  const isOwner = user?.role === 'INSTRUCTOR' && user.sub === course.instructorId;
  let isEnrolled = false;
  if (user?.role === 'STUDENT' && token) {
    const enrollments = await api<Enrollment[]>('/courses/enrolled', { token });
    isEnrolled = enrollments.some((e) => e.courseId === id);
  }

  let myCertificate: Certificate | undefined;
  if (isEnrolled && token) {
    const certs = await api<Certificate[]>('/certificates/mine', { token });
    myCertificate = certs.find((c) => c.courseId === id);
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Taught by {course.instructor.name} · {course._count.enrollments}{' '}
              enrolled
            </p>
            {course.description && (
              <p className="mt-3 max-w-2xl text-slate-700">
                {course.description}
              </p>
            )}
          </div>
          {user?.role === 'STUDENT' && (
            <form action={isEnrolled ? unenroll.bind(null, id) : enroll.bind(null, id)}>
              <SubmitButton
                className={
                  isEnrolled
                    ? 'rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50'
                    : undefined
                }
              >
                {isEnrolled ? 'Unenroll' : 'Enroll'}
              </SubmitButton>
            </form>
          )}
          {!user && (
            <Link
              href="/login"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Log in to enroll
            </Link>
          )}
        </div>

        {myCertificate && (
          <p className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            🎓 You hold a certificate for this course (code{' '}
            <span className="font-mono">{myCertificate.verificationCode}</span>
            ). See your{' '}
            <Link href="/dashboard" className="underline">
              dashboard
            </Link>{' '}
            to download it.
          </p>
        )}

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Sections</h2>
          {course.sections.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No sections yet.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {course.sections.map((s) => (
                <li
                  key={s.id}
                  className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm"
                >
                  <span className="mr-2 text-slate-400">{s.order}.</span>
                  {s.title}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Live sessions</h2>
          <SessionList
            sessions={sessions}
            courseId={id}
            isOwner={isOwner}
            canJoin={isOwner || isEnrolled}
          />
        </section>

        {isOwner && <InstructorPanel course={course} />}
      </main>
    </>
  );
}
