'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  PiCaretDownBold,
  PiCheckBold,
  PiChalkboardTeacherBold,
  PiCalendarBlank,
  PiMagnifyingGlass,
  PiPlusBold,
} from 'react-icons/pi';
import type { CourseBatch } from '@/lib/types';
import { formatCadence, tzShort } from '../catalog-lib';
import { AddBatchButton } from './add-batch-modal';
import { cn } from '@/lib/ui';

interface CohortSwitcherProps {
  variant?: 'header' | 'cockpit';
  programId: string;
  programDays?: number[] | null;
  programTime?: string | null;
  programTimezone?: string | null;
  batches: CourseBatch[];
  activeCohortId?: string | null;
  enrolledCourseIds: Set<string>;
  currentUserId?: string;
  canManage: boolean;
  defaultWeeks: number | null;
  defaultTimezone: string | null;
  className?: string;
}

export function CohortSwitcher({
  variant = 'header',
  programId,
  programDays,
  programTime,
  programTimezone,
  batches,
  activeCohortId,
  enrolledCourseIds,
  currentUserId,
  canManage,
  defaultWeeks,
  defaultTimezone,
  className,
}: CohortSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  if (batches.length === 0) return null;

  const isProgramActive = !activeCohortId || activeCohortId === programId || activeCohortId === 'base';
  const activeCohort = activeCohortId && activeCohortId !== 'base' && activeCohortId !== programId
    ? batches.find((b) => b.id === activeCohortId)
    : null;
  const activeLabel = activeCohort
    ? activeCohort.title.includes(' — ')
      ? activeCohort.title.slice(activeCohort.title.indexOf(' — ') + 3)
      : activeCohort.title
    : 'Program Schedule';

  const activeCadence = activeCohort
    ? formatCadence(activeCohort.meetingDays, activeCohort.meetingTime)
    : formatCadence(programDays, programTime);
  const activeTz = tzShort(
    activeCohort ? activeCohort.timezone : programTimezone,
    activeCohort ? activeCohort.startDate : null,
  );
  const isCurrentLive = Boolean(activeCohort?.liveSessionId);

  function handleSelect(batchId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (batchId && batchId !== 'base' && batchId !== programId) {
      params.set('cohort', batchId);
    } else {
      params.set('cohort', 'base');
    }
    const q = params.toString();
    const href = q ? `${pathname}?${q}` : pathname;
    startTransition(() => {
      router.push(href, { scroll: false });
    });
    setOpen(false);
    setQuery('');
  }

  // Filter batches if search query typed
  const filteredBatches = batches.filter((b) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const label = (b.title.includes(' — ') ? b.title.slice(b.title.indexOf(' — ') + 3) : b.title).toLowerCase();
    const cadence = (formatCadence(b.meetingDays, b.meetingTime) ?? '').toLowerCase();
    return label.includes(q) || cadence.includes(q);
  });

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      {/* TRIGGER BUTTON */}
      {variant === 'header' ? (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            'group inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs transition-all',
            open
              ? 'border-signal-600 bg-signal-50/70 text-signal-900 ring-2 ring-signal-500/20'
              : 'border-neutral-200/90 bg-white text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50/70',
            isPending && 'opacity-70',
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {isCurrentLive ? (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
          ) : (
            <PiCalendarBlank className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-600" aria-hidden />
          )}

          <span className="font-bold text-neutral-900">{activeLabel}</span>

          {activeCadence && (
            <span className="hidden text-neutral-500 sm:inline">
              · {activeCadence}
              {activeTz ? <span className="text-neutral-400"> ({activeTz})</span> : null}
            </span>
          )}

          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-600">
            {batches.length}
          </span>

          <PiCaretDownBold
            className={cn('h-3 w-3 text-neutral-400 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden
          />
        </button>
      ) : (
        /* Cockpit Rail Variant */
        <div className="rounded-2xl border border-neutral-200/90 bg-white p-3.5 shadow-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-neutral-400">
              Active Cohort
            </span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-neutral-500">
              {batches.length} available
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-all',
              open
                ? 'border-signal-600 bg-signal-50/60 ring-2 ring-signal-500/20'
                : 'border-neutral-200 bg-neutral-50/60 hover:border-neutral-300 hover:bg-white',
              isPending && 'opacity-70',
            )}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isCurrentLive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide text-white">
                    Live
                  </span>
                )}
                <span className="truncate text-xs font-bold text-neutral-900">
                  {activeLabel}
                </span>
                {isProgramActive && (
                  <span className="rounded bg-neutral-200/70 px-1 py-0.2 font-mono text-[9px] font-semibold text-neutral-600">
                    Base
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                {activeCadence ?? 'Schedule TBA'}
                {activeCadence && activeTz ? ` (${activeTz})` : ''}
              </p>
            </div>

            <PiCaretDownBold
              className={cn('h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200', open && 'rotate-180')}
              aria-hidden
            />
          </button>
        </div>
      )}

      {/* DROPDOWN POPOVER */}
      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-fade-up sm:w-96',
            variant === 'cockpit' ? 'left-0 right-0 w-full' : 'left-0 sm:left-auto sm:right-auto',
          )}
        >
          {/* Quick Filter (if >= 4 batches) */}
          {batches.length >= 4 && (
            <div className="p-1">
              <div className="relative">
                <PiMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Filter cohorts by name or schedule…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-3 text-xs text-neutral-800 placeholder-neutral-400 focus:border-signal-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-signal-600"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 p-1">
            {/* Base Program Schedule Option */}
            {(!query || 'program schedule'.includes(query.toLowerCase())) && (
              <div className="pb-1">
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className={cn(
                    'group flex w-full items-start justify-between gap-3 rounded-xl p-2.5 text-left transition-colors',
                    isProgramActive
                      ? 'bg-signal-50 text-signal-950 font-medium'
                      : 'hover:bg-neutral-50 text-neutral-700',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900 group-hover:text-signal-900">
                        Program Schedule
                      </span>
                      <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-neutral-600">
                        Base
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {formatCadence(programDays, programTime) ?? 'Schedule to be announced'}
                      {programTimezone ? (
                        <span className="text-neutral-400"> ({tzShort(programTimezone)})</span>
                      ) : null}
                    </p>
                  </div>
                  {isProgramActive && (
                    <PiCheckBold className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-700" aria-hidden />
                  )}
                </button>
              </div>
            )}

            {/* Individual Cohorts */}
            <div className="pt-1 space-y-0.5">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Cohorts &amp; Intakes ({batches.length})
              </div>

              {filteredBatches.map((b) => {
                const isSelected = b.id === activeCohortId;
                const isLive = Boolean(b.liveSessionId);
                const isEnrolled = enrolledCourseIds.has(b.id);
                const isInstructor = currentUserId && b.instructor?.id === currentUserId;
                const cadence = formatCadence(b.meetingDays, b.meetingTime);
                const tz = tzShort(b.timezone, b.startDate);
                const label = b.title.includes(' — ')
                  ? b.title.slice(b.title.indexOf(' — ') + 3)
                  : b.title;

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelect(b.id)}
                    className={cn(
                      'group flex w-full items-start justify-between gap-3 rounded-xl p-2.5 text-left transition-colors',
                      isSelected
                        ? 'bg-signal-50 text-signal-950 font-medium'
                        : 'hover:bg-neutral-50 text-neutral-700',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-bold text-neutral-900 group-hover:text-signal-900">
                          {label}
                        </span>

                        {isLive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide text-white">
                            <span className="h-1 w-1 rounded-full bg-white animate-live" />
                            Live
                          </span>
                        )}

                        {isEnrolled && (
                          <span className="inline-flex items-center rounded-full bg-signal-100 px-1.5 py-0.2 text-[9px] font-bold text-signal-800">
                            Enrolled
                          </span>
                        )}

                        {isInstructor && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-100 px-1.5 py-0.2 text-[9px] font-bold text-accent-800">
                            <PiChalkboardTeacherBold className="h-2.5 w-2.5" />
                            Teaching
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                        <span className="truncate">
                          {cadence ?? 'Schedule TBA'}
                          {cadence && tz ? ` (${tz})` : ''}
                        </span>
                        <span className="shrink-0 text-neutral-400 font-mono text-[10px]">
                          · {b._count.enrollments} {b._count.enrollments === 1 ? 'student' : 'students'}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <PiCheckBold className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-700" aria-hidden />
                    )}
                  </button>
                );
              })}

              {filteredBatches.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-neutral-400">
                  No matching cohorts found.
                </p>
              )}
            </div>
          </div>

          {/* Quick Add Action for Admins */}
          {canManage && (
            <div className="border-t border-neutral-100 p-1.5 pt-1">
              <AddBatchButton
                programId={programId}
                defaultWeeks={defaultWeeks}
                defaultTimezone={defaultTimezone}
                defaultTime={programTime}
                defaultDays={programDays}
                trigger={(openModal) => (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openModal();
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                  >
                    <PiPlusBold className="h-3 w-3" />
                    Add new cohort
                  </button>
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
