import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { CourseCard } from '@/components/course-card';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { avatarColor, cardClass, cn, initials } from '@/lib/ui';
import type { Certificate, CourseListItem, Enrollment } from '@/lib/types';
import { CertificateDownload } from './certificate-download';
import { CreateCourseForm } from './create-course-form';

export const metadata = { title: 'Dashboard - livetich' };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const token = (await getToken())!;
  const isInstructor = user.role === 'INSTRUCTOR';

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'grid h-12 w-12 place-items-center rounded-full text-base font-semibold text-white',
              avatarColor(user.sub),
            )}
            aria-hidden
          >
            {initials(user.name)}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Welcome back, {user.name.split(' ')[0]}
            </h1>
            <p className="text-sm text-slate-500">
              {isInstructor
                ? 'Manage your courses and go live with your cohort.'
                : 'Jump back into a class or find something new to learn.'}
            </p>
          </div>
        </div>

        {isInstructor ? (
          <InstructorDashboard instructorId={user.sub} />
        ) : (
          <StudentDashboard token={token} />
        )}
      </main>
    </>
  );
}

function SectionHeading({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {title}
      {count !== undefined && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {count}
        </span>
      )}
    </h2>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

async function InstructorDashboard({ instructorId }: { instructorId: string }) {
  const all = await api<CourseListItem[]>('/courses');
  const mine = all.filter((c) => c.instructorId === instructorId);
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1.9fr_1fr]">
      <section>
        <SectionHeading title="Your courses" count={mine.length} />
        {mine.length === 0 ? (
          <EmptyState>
            You haven&apos;t created a course yet. Use the panel on the right to
            launch your first one.
          </EmptyState>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {mine.map((c) => (
              <CourseCard
                key={c.id}
                href={`/courses/${c.id}`}
                title={c.title}
                description={c.description}
                meta={[
                  `${c._count.sections} sections`,
                  `${c._count.enrollments} enrolled`,
                ]}
              />
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionHeading title="New course" />
        <div className={cn(cardClass, 'mt-4 p-5')}>
          <CreateCourseForm />
        </div>
      </section>
    </div>
  );
}

async function StudentDashboard({ token }: { token: string }) {
  const [enrollments, certificates] = await Promise.all([
    api<Enrollment[]>('/courses/enrolled', { token }),
    api<Certificate[]>('/certificates/mine', { token }),
  ]);
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-2">
      <section>
        <SectionHeading title="Your courses" count={enrollments.length} />
        {enrollments.length === 0 ? (
          <EmptyState>
            You&apos;re not enrolled in anything yet.{' '}
            <Link
              href="/courses"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Browse courses →
            </Link>
          </EmptyState>
        ) : (
          <div className="mt-4 grid gap-4">
            {enrollments.map((e) => (
              <CourseCard
                key={e.id}
                href={`/courses/${e.courseId}`}
                title={e.course.title}
                meta={[`Taught by ${e.course.instructor.name}`]}
              />
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionHeading title="Certificates" count={certificates.length} />
        {certificates.length === 0 ? (
          <EmptyState>
            None yet. Finish a course to earn a verifiable certificate.
          </EmptyState>
        ) : (
          <div className="mt-4 grid gap-4">
            {certificates.map((c) => (
              <div key={c.id} className={cn(cardClass, 'p-5')}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-base text-white">
                    🎓
                  </span>
                  <p className="font-semibold text-slate-900">
                    {c.course?.title ?? 'Certificate'}
                  </p>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Issued {new Date(c.issuedAt).toLocaleDateString()} · code{' '}
                  <span className="font-mono text-slate-700">
                    {c.verificationCode}
                  </span>
                </p>
                <div className="mt-4 flex items-center gap-4 text-sm font-medium">
                  <CertificateDownload
                    certificateId={c.id}
                    ready={Boolean(c.pdfUrl)}
                  />
                  <a
                    className="text-slate-500 hover:text-slate-900"
                    href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/certificates/verify/${c.verificationCode}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Verify ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
