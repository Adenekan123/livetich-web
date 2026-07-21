import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type {
  Certificate,
  CourseListItem,
  Enrollment,
} from '@/lib/types';
import { CertificateDownload } from './certificate-download';
import { CreateCourseForm } from './create-course-form';

export const metadata = { title: 'Dashboard — livetich' };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const token = (await getToken())!;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold">Welcome back, {user.name}</h1>
        {user.role === 'INSTRUCTOR' ? (
          <InstructorDashboard instructorId={user.sub} />
        ) : (
          <StudentDashboard token={token} />
        )}
      </main>
    </>
  );
}

async function InstructorDashboard({ instructorId }: { instructorId: string }) {
  const all = await api<CourseListItem[]>('/courses');
  const mine = all.filter((c) => c.instructorId === instructorId);
  return (
    <div className="mt-8 grid gap-10 md:grid-cols-[2fr_1fr]">
      <section>
        <h2 className="text-lg font-semibold">Your courses</h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            You haven&apos;t created a course yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {mine.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  className="block rounded-md border border-slate-200 bg-white px-4 py-3 text-sm hover:border-indigo-300"
                >
                  <span className="font-medium">{c.title}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {c._count.sections} sections · {c._count.enrollments} enrolled
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-lg font-semibold">New course</h2>
        <CreateCourseForm />
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
    <div className="mt-8 grid gap-10 md:grid-cols-2">
      <section>
        <h2 className="text-lg font-semibold">Your courses</h2>
        {enrollments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            Not enrolled yet —{' '}
            <Link href="/courses" className="text-indigo-600 hover:underline">
              browse courses
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {enrollments.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/courses/${e.courseId}`}
                  className="block rounded-md border border-slate-200 bg-white px-4 py-3 text-sm hover:border-indigo-300"
                >
                  <span className="font-medium">{e.course.title}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    by {e.course.instructor.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-lg font-semibold">Your certificates</h2>
        {certificates.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            None yet — finish a course to earn one.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {certificates.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <p className="font-medium">🎓 {c.course?.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Issued {new Date(c.issuedAt).toLocaleDateString()} · code{' '}
                  <span className="font-mono">{c.verificationCode}</span>
                </p>
                <div className="mt-2 flex gap-3 text-xs">
                  <CertificateDownload
                    certificateId={c.id}
                    ready={Boolean(c.pdfUrl)}
                  />
                  <a
                    className="text-indigo-600 hover:underline"
                    href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/certificates/verify/${c.verificationCode}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Verify link
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
