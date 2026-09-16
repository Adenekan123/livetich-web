'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TAJWEED_RULE_KEYS } from '@/lib/realtime-contract';
import {
  ruleColor,
  ruleLabel,
  tajweedProgress,
  type TajweedProgressRow,
} from '@/lib/tajweed';
import type { Section } from '@/lib/types';
import { btn, cardClass, cn, inputClass } from '@/lib/ui';
import { QuranReader } from '@/app/sessions/[id]/quran-reader';
import { useTajweed } from '@/app/sessions/[id]/use-tajweed';

type Tab = 'prep' | 'progress';

/**
 * The course's Tajweed page: preparing lessons (staff) and progress.
 *
 * Preparing uses the very same mushaf and toolbar as the live class, in Lesson
 * mode only — so what a teacher learns in one place works in the other, and a
 * lesson prepared here is exactly what the class sees when it runs.
 */
export function TajweedWorkspace({
  courseId,
  sections,
  canManage,
  initialLesson,
}: {
  courseId: string;
  sections: Section[];
  canManage: boolean;
  initialLesson: string | null;
}) {
  const [tab, setTab] = useState<Tab>(canManage ? 'prep' : 'progress');

  return (
    <>
      {canManage && (
        <div
          role="tablist"
          aria-label="Tajweed"
          className="mt-6 inline-flex rounded-full bg-neutral-100 p-1"
        >
          {(
            [
              ['prep', 'Prepare lessons'],
              ['progress', 'Progress'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-semibold transition',
                tab === key
                  ? 'bg-white text-neutral-950 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === 'prep' && canManage ? (
        <LessonPrep courseId={courseId} sections={sections} initialLesson={initialLesson} />
      ) : (
        <Progress courseId={courseId} canManage={canManage} />
      )}
    </>
  );
}

function LessonPrep({
  courseId,
  sections,
  initialLesson,
}: {
  courseId: string;
  sections: Section[];
  initialLesson: string | null;
}) {
  const [sectionId, setSectionId] = useState<string | null>(
    sections.some((s) => s.id === initialLesson) ? initialLesson : (sections[0]?.id ?? null),
  );

  if (!sections.length || !sectionId) {
    return (
      <div className={cn(cardClass, 'mt-6 max-w-2xl p-6')}>
        <h2 className="text-base font-semibold text-neutral-950">No lessons yet</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Tajweed marks are prepared for a lesson in the curriculum. Add a lesson
          first, then come back to mark it.
        </p>
        <Link href={`/courses/${courseId}`} className={btn('secondary', 'sm', 'mt-4')}>
          Go to the curriculum
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm font-medium text-neutral-700">
          Lesson
          <select
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            className={cn(inputClass, 'mt-1 w-auto min-w-[16rem]')}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.order}. {s.title}
              </option>
            ))}
          </select>
        </label>
        <Link
          href={`/courses/${courseId}/tajweed/print/lesson/${sectionId}`}
          target="_blank"
          className={btn('secondary', 'md')}
        >
          Print lesson sheet
        </Link>
      </div>
      <p className="max-w-2xl text-sm text-neutral-500">
        Tap a word, then a rule. Everything you mark here is saved with this
        lesson and appears on the mushaf whenever a class runs it.
      </p>
      {/* Keyed on the lesson, so switching lessons starts clean rather than
          merging one lesson's marks into another's. */}
      <LessonMushaf key={sectionId} courseId={courseId} sectionId={sectionId} />
    </div>
  );
}

function LessonMushaf({ courseId, sectionId }: { courseId: string; sectionId: string }) {
  const tajweed = useTajweed({
    courseId,
    sectionId,
    canEdit: true,
    enabled: true,
    initialMode: 'LESSON',
  });
  const [pos, setPos] = useState<{ surah: number; ayah: number } | null>(null);
  // Until the teacher turns the page, open where the lesson's marks already are.
  const first = tajweed.lesson[0];
  const shown =
    pos ?? (first ? { surah: first.surahNumber, ayah: first.ayahNumber } : { surah: 1, ayah: 1 });

  return (
    <div className="h-[72vh] min-h-[30rem]">
      <QuranReader
        surah={shown.surah}
        ayah={shown.ayah}
        isInstructor
        onNavigate={(surah, ayah) => setPos({ surah, ayah })}
        tajweed={tajweed}
        tajweedModes={['LESSON']}
        startAnnotating
      />
    </div>
  );
}

/**
 * Counts of what the teacher recorded, per student and rule. Deliberately not a
 * score: a count of issues heard says where to listen next, and the teacher —
 * not a formula — decides what it means.
 */
function Progress({ courseId, canManage }: { courseId: string; canManage: boolean }) {
  const [rows, setRows] = useState<TajweedProgressRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    tajweedProgress(courseId)
      .then((r) => {
        if (current) setRows(r);
      })
      .catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e.message : 'Could not load progress');
      });
    return () => {
      current = false;
    };
  }, [courseId]);

  if (error) {
    return <p className="mt-6 text-sm text-red-600">{error}</p>;
  }
  if (!rows) {
    return <p className="mt-6 text-sm text-neutral-500">Loading…</p>;
  }
  if (!rows.length) {
    return <p className="mt-6 text-sm text-neutral-500">No students are enrolled yet.</p>;
  }

  return (
    <div className="mt-6">
      <p className="max-w-2xl text-sm text-neutral-500">
        {canManage
          ? 'What you recorded while each student recited: issues heard and correct recitations, per rule. Counts, not grades.'
          : 'What your teacher recorded while you recited, per rule.'}
      </p>
      <div className={cn(cardClass, 'mt-3 overflow-x-auto')}>
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Recorded</th>
              <th className="px-4 py-3">By rule</th>
              <th className="px-4 py-3">Last</th>
              <th className="px-4 py-3">
                <span className="sr-only">Correction sheet</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student.id} className="border-b border-neutral-100 align-top last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-950">{r.student.name}</td>
                <td className="px-4 py-3 tabular-nums text-neutral-700">{r.total}</td>
                <td className="px-4 py-3">
                  <RuleTally row={r} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                  {r.lastAt
                    ? new Date(r.lastAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {r.total > 0 && (
                    <Link
                      href={`/courses/${courseId}/tajweed/print/student/${r.student.id}`}
                      target="_blank"
                      className="text-sm font-semibold text-signal-700 hover:underline"
                    >
                      Correction sheet
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RuleTally({ row }: { row: TajweedProgressRow }) {
  const rules = TAJWEED_RULE_KEYS.filter((k) => row.byRule[k]);
  if (!rules.length) {
    return <span className="text-neutral-400">Nothing recorded yet</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {rules.map((rule) => {
        const t = row.byRule[rule]!;
        return (
          <li
            key={rule}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-2 py-0.5 text-xs ring-1 ring-neutral-200"
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: ruleColor(rule) }}
            />
            <span className="font-medium text-neutral-800">{ruleLabel(rule, null)}</span>
            {t.issues > 0 && <span className="text-amber-700">{t.issues} to work on</span>}
            {t.correct > 0 && <span className="text-emerald-700">{t.correct} correct</span>}
          </li>
        );
      })}
    </ul>
  );
}
