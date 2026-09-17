'use client';

import type { TajweedAnnotation, TajweedPart } from '@/lib/realtime-contract';
import { graphemes, indexByAyah, partsIn, splitWords } from '@/lib/tajweed';
import { btn } from '@/lib/ui';
import { marksKeyOf, markColor, markLabel, TajweedAyah } from '@/app/sessions/[id]/tajweed-ayah';

export interface SheetSurah {
  number: number;
  transliteration: string;
  ayahs: string[];
}

const noop = () => {};
const NO_PARTS: TajweedPart[] = [];

function toArabicNumerals(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

/**
 * The pieces one mark holds in one ayah, from the text itself.
 *
 * A mark may reach into the next ayah, and it is printed under each ayah it
 * touches — so the excerpt shows what it holds here, not the whole mark.
 */
function excerpt(
  text: string,
  mark: TajweedAnnotation,
  surah: number,
  ayah: number,
): string {
  const here = partsIn(mark, surah, ayah);
  if (!here.length || here.some((p) => p.wordIndex === null)) return '';
  const words = splitWords(text);
  return here
    .map((p) => {
      const word = words[p.wordIndex!] ?? '';
      return p.letterIndex === null ? word : (graphemes(word)[p.letterIndex] ?? '');
    })
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
  // Keyed by ayah, so a mark that spans two of them is printed under each —
  // under the verse it actually marks, never under whichever came first.
  const groups = [...indexByAyah(annotations)]
    .map(([key, marks]) => {
      const [surah, ayah] = key.split(':').map(Number);
      return { key, surah, ayah, marks };
    })
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
                  picked={NO_PARTS}
                  pointed={NO_PARTS}
                  anchor={false}
                  interactive={false}
                  numeral={`﴿${toArabicNumerals(g.ayah)}﴾`}
                  onPart={noop}
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
                        {excerpt(text, m, g.surah, g.ayah)}
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
