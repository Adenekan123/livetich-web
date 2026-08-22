import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type { CatalogCourse, Enrollment } from '@/lib/types';
import { coursesToClasses } from './catalog-lib';
import { CourseBrowser } from './course-browser';

export const metadata = { title: 'Programs — livetich' };

export default async function CoursesPage() {
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');

  let courses: CatalogCourse[] = [];
  // Which cohorts this student is enrolled in — derived from the existing
  // /courses/enrolled endpoint (same one the student dashboard uses), so we
  // don't need an `enrolled` flag on the catalog payload. Empty for non-students.
  let enrolledIds: string[] = [];
  let failed = false;
  try {
    if (user.role === 'STUDENT') {
      const [cat, enrolled] = await Promise.all([
        api<CatalogCourse[]>('/courses', { token }),
        api<Enrollment[]>('/courses/enrolled', { token }),
      ]);
      courses = cat;
      enrolledIds = enrolled.map((e) => e.courseId);
    } else {
      courses = await api<CatalogCourse[]>('/courses', { token });
    }
  } catch {
    failed = true;
  }

  const classes = coursesToClasses(courses, enrolledIds);

  return (
    <>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-16 sm:px-6">
        {failed ? (
          <div className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-14 text-center">
            <p className="text-3xl">📡</p>
            <p className="mt-3 font-semibold text-neutral-950">
              Couldn&apos;t reach the catalog
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              The livetich API isn&apos;t responding. Make sure it&apos;s running,
              then refresh.
            </p>
          </div>
        ) : (
          <CourseBrowser
            classes={classes}
            role={user.role}
            currentUserId={user.sub}
            canCreate={user.role === 'ORG_ADMIN'}
          />
        )}
      </main>
    </>
  );
}
