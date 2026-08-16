import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { isPluginEnabled, PLUGIN_TEST_PREP } from '@/lib/plugins';
import type { CourseDetail, ExamAvailableRow, ExamListRow } from '@/lib/types';
import { ExamManager } from './exam-manager';
import { ExamTaker } from './exam-taker';

export const metadata = { title: 'Test Prep — livetich' };

export default async function ExamsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');

  // Test Prep is an add-on pack; a deep link 404s when it's off.
  if (!(await isPluginEnabled(PLUGIN_TEST_PREP, token))) notFound();

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
      <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-10 sm:px-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
        >
          ← {course.title}
        </Link>

        {canManage ? (
          <ExamManager
            courseId={id}
            exams={await api<ExamListRow[]>(`/courses/${id}/exams`, { token })}
          />
        ) : (
          <ExamTaker
            courseId={id}
            exams={await api<ExamAvailableRow[]>(
              `/courses/${id}/exams/available`,
              { token },
            )}
          />
        )}
      </main>
    </>
  );
}
