import { notFound, redirect } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import { isPluginEnabled, PLUGIN_ISLAMIC_EDUCATION } from '@/lib/plugins';
import { TAJWEED_RULE_KEYS, TAJWEED_RULES, type TajweedAnnotation } from '@/lib/realtime-contract';
import type { TajweedProgressRow } from '@/lib/tajweed';
import type { CourseDetail } from '@/lib/types';
import { TajweedSheet, type SheetSurah } from '../../tajweed-sheet';

/**
 * One student's Tajweed corrections, ready to print. The API decides who may
 * see it — staff for anyone in the course, a student only for themselves — so
 * a link to someone else's sheet is simply not found.
 */
export default async function StudentSheetPage(props: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id, studentId } = await props.params;
  const [user, token] = await Promise.all([getCurrentUser(), getToken()]);
  if (!user || !token) redirect('/login');
  if (!(await isPluginEnabled(PLUGIN_ISLAMIC_EDUCATION, token))) notFound();

  let course: CourseDetail;
  let corrections: TajweedAnnotation[];
  let progress: TajweedProgressRow[];
  try {
    [course, { corrections }, progress] = await Promise.all([
      api<CourseDetail>(`/courses/${id}`, { token }),
      api<{ corrections: TajweedAnnotation[] }>(
        `/courses/${id}/tajweed/students/${encodeURIComponent(studentId)}/corrections`,
        { token },
      ),
      api<TajweedProgressRow[]>(`/courses/${id}/tajweed/progress`, { token }),
    ]);
  } catch (e) {
    if (e instanceof ApiError && [403, 404].includes(e.status)) notFound();
    throw e;
  }
  const row = progress.find((r) => r.student.id === studentId);
  if (!row) notFound();

  const surahs = await Promise.all(
    [...new Set(corrections.map((a) => a.surahNumber))].map((n) =>
      api<SheetSurah>(`/quran/surahs/${n}`, { token }),
    ),
  );
  const rules = TAJWEED_RULE_KEYS.filter((k) => row.byRule[k]);

  return (
    <TajweedSheet
      kicker="Tajweed correction sheet"
      title={row.student.name}
      subtitle={course.title}
      annotations={corrections}
      surahs={surahs}
      summary={
        rules.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2 text-sm">
            {rules.map((rule) => (
              <li key={rule} className="rounded-full bg-neutral-100 px-3 py-1">
                <span className="font-semibold">{TAJWEED_RULES[rule].label}</span>
                {row.byRule[rule]!.issues > 0 && ` · ${row.byRule[rule]!.issues} to work on`}
                {row.byRule[rule]!.correct > 0 && ` · ${row.byRule[rule]!.correct} correct`}
              </li>
            ))}
          </ul>
        )
      }
    />
  );
}
