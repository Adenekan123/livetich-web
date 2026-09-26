import { TAJWEED_RULES, type TajweedRule } from '@/lib/realtime-contract';
import type { HifzTajweedCorrection } from '@/lib/types';
import { cn } from '@/lib/ui';

const OUTCOME_LABEL: Record<string, string> = {
  CORRECT: 'Correct',
  REPEAT: 'Repeat',
  PRONUNCIATION: 'Pronunciation',
  NOTE: 'Note',
};

function labelOf(c: HifzTajweedCorrection): string {
  const rule =
    c.rule === 'custom'
      ? (c.customLabel ?? 'Note')
      : c.rule && c.rule in TAJWEED_RULES
        ? TAJWEED_RULES[c.rule as TajweedRule].label
        : null;
  if (c.outcome === 'TAJWEED_ISSUE') return `${rule ?? 'Tajweed'} issue`;
  return (c.outcome && OUTCOME_LABEL[c.outcome]) || rule || 'Note';
}

/**
 * The Tajweed corrections the teacher marked while hearing a recitation, shown
 * with that recitation. The note, when there is one, is a tap or hover away so
 * the list stays one line.
 */
export function TajweedCorrectionChips({
  corrections,
}: {
  corrections: HifzTajweedCorrection[] | undefined;
}) {
  if (!corrections?.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Tajweed corrections">
      {corrections.map((c) => (
        <li
          key={c.id}
          title={c.note ?? undefined}
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium ring-1',
            c.outcome === 'CORRECT'
              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
              : 'bg-amber-50 text-amber-900 ring-amber-200',
          )}
        >
          Ayah {c.ayahNumber} · {labelOf(c)}
          {c.note ? <span className="text-neutral-500"> — {c.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}
