'use client';

import type { TajweedAnnotation } from '@/lib/realtime-contract';
import { indexByAyah, splitWords } from '@/lib/tajweed';
import { btn } from '@/lib/ui';
import { marksKeyOf, markColor, markLabel, TajweedAyah } from '@/app/sessions/[id]/tajweed-ayah';

export interface SheetSurah {
  number: number;
  transliteration: string;
  ayahs: string[];
}

const noop = () => {};

function toArabicNumerals(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

/** The marked words of one annotation, from the text itself. */
function excerpt(text: string, a: TajweedAnnotation): string {
  if (a.selection === 'AYAH' || a.wordStart === null) return '';
  return splitWords(text)
    .slice(a.wordStart, (a.wordEnd ?? a.wordStart) + 1)
    .join(' ');
}

/**
 * A printable Tajweed sheet — a lesson's marks, or one student's corrections.
 *
 * Printing is the browser's: its Print dialog saves a PDF, and it shapes the
 * Arabic exactly as the mushaf does on screen, which a server-drawn PDF could
 * not. The structured annotations stay the record; this is only a view of them.
 */
export function TajweedSheet({
  kicker,
  title,
  subtitle,
  annotations,
  surahs,
  summary,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  annotations: TajweedAnnotation[];
  surahs: SheetSurah[];
  summary?: React.ReactNode;
}) {
  const texts = new Map(surahs.map((s) => [s.number, s]));
  const groups = [...indexByAyah(annotations)]
    .map(([key, marks]) => ({ key, surah: marks[0].surahNumber, ayah: marks[0].ayahNumber, marks }))
    .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);

  return (
    <main
      data-tajweed-sheet
      className="mx-auto w-full max-w-3xl flex-1 bg-white px-6 py-10 text-neutral-950 [print-color-adjust:exact] print:max-w-none print:px-0 print:py-0"
    >
      {/* On paper, the sheet and nothing else: the app's navigation and chrome
          around this page are hidden, and the sheet takes the page from the
          top-left, whatever layout it sits in on screen. */}
      <style>
        {
          '@media print { body * { visibility: hidden; } [data-tajweed-sheet], [data-tajweed-sheet] * { visibility: visible; } [data-tajweed-sheet] { position: absolute; left: 0; top: 0; width: 100%; } }'
        }
      </style>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{kicker}</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="text-sm text-neutral-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className={btn('primary', 'md', 'print:hidden')}
        >
          Print or save as PDF
        </button>
      </div>

      {summary}

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-500">Nothing has been marked yet.</p>
      ) : (
        groups.map((g) => {
          const surah = texts.get(g.surah);
          const text = surah?.ayahs[g.ayah - 1] ?? '';
          return (
            <section key={g.key} className="mt-8 break-inside-avoid">
              <h2 className="text-sm font-semibold text-neutral-700">
                {surah?.transliteration ?? `Surah ${g.surah}`} {g.ayah}
              </h2>
              <p
                dir="rtl"
                lang="ar"
                className="font-quran mt-3 text-right text-3xl leading-[2.6] text-neutral-950"
              >
                <TajweedAyah
                  surah={g.surah}
                  ayah={g.ayah}
                  text={text}
                  marks={g.marks}
                  marksKey={marksKeyOf(g.marks)}
                  selection={null}
                  anchor={false}
                  interactive={false}
                  numeral={`﴿${toArabicNumerals(g.ayah)}﴾`}
                  onWord={noop}
                  onAyah={null}
                  onMark={noop}
                />
              </p>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {g.marks.map((m) => (
                    <tr key={m.id} className="border-t border-neutral-100">
                      <td
                        className="w-44 py-1.5 pr-3 align-top font-semibold"
                        style={{ color: markColor(m) }}
                      >
                        {markLabel(m)}
                      </td>
                      <td dir="rtl" lang="ar" className="font-quran w-40 py-1.5 pr-3 align-top text-lg">
                        {excerpt(text, m)}
                      </td>
                      <td className="py-1.5 align-top text-neutral-700">{m.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })
      )}
    </main>
  );
}
