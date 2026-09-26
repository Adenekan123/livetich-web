import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { isPluginEnabled, PLUGIN_ISLAMIC_EDUCATION } from '@/lib/plugins';
import type { TajweedAnnotation } from '@/lib/realtime-contract';
import type { CourseDetail } from '@/lib/types';
import { TajweedSheet, type SheetSurah } from '../../tajweed-sheet';

/** A lesson's Tajweed marks, ready to print or save as PDF. */
export default async function LessonSheetPage(props: {
  params: Promise<{ id: string; sectionId: string }>;
}) {
  const { id, sectionId } = await props.params;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');
  if (!(await isPluginEnabled(PLUGIN_ISLAMIC_EDUCATION, token))) notFound();

  let course: CourseDetail;
  let annotations: TajweedAnnotation[];
  try {
    course = await api<CourseDetail>(`/courses/${id}`, { token });
    ({ lesson: annotations } = await api<{ lesson: TajweedAnnotation[] }>(
      `/courses/${id}/tajweed/annotations?sectionId=${encodeURIComponent(sectionId)}`,
      { token },
    ));
  } catch (e) {
    if (e instanceof ApiError && [403, 404].includes(e.status)) notFound();
    throw e;
  }
  const section = course.sections.find((s) => s.id === sectionId);
  if (!section) notFound();

  const surahs = await Promise.all(
    [...new Set(annotations.map((a) => a.surahNumber))].map((n) =>
      api<SheetSurah>(`/quran/surahs/${n}`, { token }),
    ),
  );

  return (
    <TajweedSheet
      kicker="Tajweed lesson sheet"
      title={section.title}
      subtitle={course.title}
      annotations={annotations}
      surahs={surahs}
    />
  );
}
