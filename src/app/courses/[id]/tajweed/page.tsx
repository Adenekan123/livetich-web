import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { isPluginEnabled, PLUGIN_ISLAMIC_EDUCATION } from '@/lib/plugins';
import type { CourseDetail } from '@/lib/types';
import { TajweedWorkspace } from './tajweed-workspace';

export default async function TajweedPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { id } = await props.params;
  const { lesson } = await props.searchParams;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');

  // Tajweed is an Islamic Education pack feature; a deep link 404s when it's off.
  if (!(await isPluginEnabled(PLUGIN_ISLAMIC_EDUCATION, token))) notFound();

  let course: CourseDetail;
  try {
    course = await api<CourseDetail>(`/courses/${id}`, { token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const isOwner = user.role === 'INSTRUCTOR' && user.sub === course.instructorId;
  const canManage = isOwner || user.role === 'ORG_ADMIN';
  const sections = [...course.sections].sort((a, b) => a.order - b.order);

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-10 sm:px-6">
      <Link
        href={`/courses/${id}`}
        className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
      >
        ← {course.title}
      </Link>
      <div className="mt-4">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-neutral-950">
          Tajweed
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          {canManage
            ? 'Prepare the Tajweed marks for each lesson before class, and see what you have recorded for each student.'
            : 'The Tajweed corrections your teacher recorded while you recited.'}
        </p>
      </div>

      <TajweedWorkspace
        courseId={id}
        sections={sections}
        canManage={canManage}
        initialLesson={lesson ?? null}
      />
    </main>
  );
}
