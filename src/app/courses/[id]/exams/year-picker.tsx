'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { alocYears } from '@/app/actions/exams';
import { cn, inputClass } from '@/lib/ui';

/**
 * Year field for the ALOC import: a searchable list of the years that subject
 * and exam type can actually be imported for.
 *
 * Deliberately a combobox and not a `<select>`. The suggestions come from the
 * questions already in the shared pool, which makes every one of them safe —
 * but also makes the list a subset of what ALOC holds, since a year nobody has
 * imported yet cannot be in it. A plain dropdown would therefore quietly take
 * away years that work, so anything the instructor types is accepted too and
 * the list is only ever a shortcut.
 *
 * The years load when the field is opened rather than when the subject
 * changes. Looking up an unseen pair costs a credit to seed, so loading on
 * change would spend one for every subject somebody scrolled past on the way
 * to the one they wanted.
 */
export function YearPicker({
  value,
  onChange,
  subject,
  examType,
}: {
  value: string;
  onChange: (year: string) => void;
  subject: string;
  examType: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Whether the instructor has typed since opening. Opening the field puts the
  // current year in the box, and treating that as a search term filtered the
  // list down to the year already chosen — opening the picker on 2019 offered
  // 2019 and nothing else, which looks like a subject with one year of
  // questions. The full list shows until they actually type.
  const [typed, setTyped] = useState(false);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Which pair the loaded years belong to, so reopening the field after a
  // change refetches but reopening it otherwise does not.
  const pair = `${subject}/${examType}`;
  const loadedFor = useRef<string | null>(null);
  // The pair as it stands *now*, which a reply that has been in flight across
  // a change cannot know: its own `pair` is the one captured when it was sent.
  // Synced in an effect rather than during render — it is only ever read from
  // a click or an awaited reply, both of which happen after the commit.
  const latestPair = useRef(pair);
  useEffect(() => {
    latestPair.current = pair;
  }, [pair]);

  // Close on an outside click — a panel that outlives the field it belongs to
  // ends up floating over whatever the instructor looks at next.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function openAndLoad() {
    setQuery(value);
    setTyped(false);
    setOpen(true);
    if (loadedFor.current === pair) return;
    setLoading(true);
    try {
      const list = await alocYears(subject, examType);
      // Drop a reply the instructor has already moved on from, which would
      // otherwise show one subject's years under another's name.
      if (latestPair.current !== pair) return;
      setYears(list);
      loadedFor.current = pair;
    } finally {
      if (latestPair.current === pair) setLoading(false);
    }
  }

  const matches = useMemo(
    () =>
      typed && query ? years.filter((y) => String(y).includes(query)) : years,
    [years, query, typed],
  );

  const pick = (year: string) => {
    onChange(year);
    setQuery('');
    setTyped(false);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={open ? query : value}
        onChange={(e) => {
          // Digits only, and never more than a year's worth of them.
          const next = e.target.value.replace(/\D/g, '').slice(0, 4);
          setQuery(next);
          setTyped(true);
          onChange(next);
        }}
        onFocus={openAndLoad}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && matches.length === 1) {
            e.preventDefault();
            pick(String(matches[0]));
          }
        }}
        placeholder="any"
        inputMode="numeric"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Year"
        className={cn(inputClass, 'mt-1 w-24')}
      />

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Available years"
          className="absolute z-20 mt-1 max-h-56 w-36 overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => pick('')}
            className={cn(
              'block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100',
              value === '' ? 'font-semibold text-neutral-900' : 'text-neutral-600',
            )}
          >
            Any year
          </button>

          {loading && (
            <p className="px-3 py-1.5 text-xs text-neutral-400">Loading years…</p>
          )}

          {!loading &&
            matches.map((y) => (
              <button
                key={y}
                type="button"
                role="option"
                aria-selected={value === String(y)}
                onClick={() => pick(String(y))}
                className={cn(
                  'block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100',
                  value === String(y)
                    ? 'font-semibold text-neutral-900'
                    : 'text-neutral-600',
                )}
              >
                {y}
              </button>
            ))}

          {/* Two different kinds of nothing, and the instructor needs to tell
              them apart: a pair ALOC has never answered for, versus a typed
              year that is merely absent from the suggestions and may still
              work. */}
          {!loading && matches.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-neutral-400">
              {years.length === 0
                ? 'No years known for this subject yet — type one to try it.'
                : `No match for “${query}”. Import it anyway to try.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
