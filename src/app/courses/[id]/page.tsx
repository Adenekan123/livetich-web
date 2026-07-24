import Link from 'next/link';
import { notFound } from 'next/navigation';
import { enroll, unenroll } from '@/app/actions/courses';
import { Header } from '@/components/header';
import { SubmitButton } from '@/components/submit-button';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { btn } from '@/lib/ui';
import type {
  Certificate,
  CourseDetail,
  Enrollment,
  LiveSession,
} from '@/lib/types';
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

  const liveNow = sessions.some((s) => s.status === 'LIVE');

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {/* Course header */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Link href="/courses" className="hover:text-slate-700">
                Courses
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-slate-400">Course</span>
            </div>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight text-slate-900">
              {course.title}
              {liveNow && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                  <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-500" />
                  LIVE NOW
                </span>
              )}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Taught by{' '}
              <span className="font-medium text-slate-700">
                {course.instructor.name}
              </span>{' '}
              · {course._count.enrollments} enrolled
            </p>
            {course.description && (
              <p className="mt-4 text-slate-700">{course.description}</p>
            )}
          </div>

          <div className="shrink-0">
            {user?.role === 'STUDENT' && (
              <form
                action={
                  isEnrolled ? unenroll.bind(null, id) : enroll.bind(null, id)
                }
              >
                <SubmitButton
                  variant={isEnrolled ? 'secondary' : 'primary'}
                  size="lg"
                  pendingLabel={isEnrolled ? 'Leaving…' : 'Enrolling…'}
                >
                  {isEnrolled ? 'Enrolled ✓' : 'Enroll now'}
                </SubmitButton>
              </form>
            )}
            {!user && (
              <Link href="/login" className={btn('primary', 'lg')}>
                Log in to enroll
              </Link>
            )}
          </div>
        </div>

        {myCertificate && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800">
            <span className="text-lg leading-none">🎓</span>
            <p>
              You hold a certificate for this course (code{' '}
              <span className="font-mono">{myCertificate.verificationCode}</span>
              ). Download it from your{' '}
              <Link href="/dashboard" className="font-medium underline">
                dashboard
              </Link>
              .
            </p>
          </div>
        )}

        {/* Live sessions */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Live sessions</h2>
          <SessionList
            sessions={sessions}
            courseId={id}
            isOwner={isOwner}
            canJoin={isOwner || isEnrolled}
          />
        </section>

        {/* Curriculum */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">Curriculum</h2>
          {course.sections.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-6 text-sm text-slate-500">
              No sections yet.
            </p>
          ) : (
            <ol className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {course.sections.map((s) => (
                <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                    {s.order}
                  </span>
                  <span className="text-sm text-slate-800">{s.title}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {isOwner && <InstructorPanel course={course} />}
      </main>
    </>
  );
}
