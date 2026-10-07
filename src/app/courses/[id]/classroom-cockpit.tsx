'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  PiCaretDownBold,
  PiCheckBold,
  PiChalkboardTeacherBold,
  PiMagnifyingGlass,
  PiPlusBold,
  PiArrowRightBold,
  PiEyeBold,
  PiArrowClockwiseBold,
} from 'react-icons/pi';
import type { CourseBatch, CourseDetail, Role } from '@/lib/types';
import { formatCadence, tzShort, formatDateRange, formatDurationLong, deriveCohort } from '../catalog-lib';
import { AddBatchButton } from './add-batch-modal';
import { EditProgramButton } from './edit-program-modal';
import { joinLiveSession, enroll } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { btn, cn } from '@/lib/ui';

interface ClassroomCockpitProps {
  course: CourseDetail;
  activeCohort: CourseBatch | null;
  activeCourseForEdit: CourseDetail;
  batches: CourseBatch[];
  effectiveId: string;
  user: { sub: string; role: Role } | null;
  isAdmin: boolean;
  isOwnerOfActiveCohort: boolean;
  isEnrolledInActiveCohort: boolean;
  sessionStatus: {
    joinableNow: boolean;
    isLive: boolean;
    nextAt: string | null;
  };
  hasAssessment: boolean;
  enrolledIds: Set<string>;
}

export function ClassroomCockpit({
  course,
  activeCohort,
  activeCourseForEdit,
  batches,
  effectiveId,
  user,
  isAdmin,
  isOwnerOfActiveCohort,
  isEnrolledInActiveCohort,
  sessionStatus,
  hasAssessment,
  enrolledIds,
}: ClassroomCockpitProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [openDropdown, setOpenDropdown] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const [joinPending, startJoinTransition] = useTransition();
  const [joinError, setJoinError] = useState<string | null>(null);
  const [confirmGoLiveOpen, setConfirmGoLiveOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!openDropdown) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenDropdown(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openDropdown]);

  // Cohort & schedule values
  const hasBatches = batches.length > 0;
  const isBaseProgramActive = !activeCohort;
  const activeLabel = activeCohort
    ? activeCohort.title.includes(' — ')
      ? activeCohort.title.slice(activeCohort.title.indexOf(' — ') + 3)
      : activeCohort.title
    : hasBatches
      ? `${course.title} (Base Program)`
      : course.title;

  const effectiveMeetingDays = activeCohort?.meetingDays ?? course.meetingDays;
  const effectiveMeetingTime = activeCohort?.meetingTime ?? course.meetingTime;
  const effectiveTimezone = activeCohort?.timezone ?? course.timezone;
  const effectiveStartDate = activeCohort?.startDate ?? course.startDate;
  const effectiveDurationWeeks = activeCohort?.durationWeeks ?? course.durationWeeks;

  const cadence = formatCadence(effectiveMeetingDays, effectiveMeetingTime);
  const tz = tzShort(effectiveTimezone, effectiveStartDate);
  const duration = formatDurationLong(effectiveDurationWeeks);
  const dateRange = effectiveStartDate ? formatDateRange(effectiveStartDate, effectiveDurationWeeks) : null;
  const cohortState = deriveCohort(effectiveStartDate, effectiveDurationWeeks, sessionStatus.isLive);

  // Format next session date
  const whenFormatted = ((): string | null => {
    if (!sessionStatus.nextAt) return null;
    const opts: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    try {
      return new Date(sessionStatus.nextAt).toLocaleString(undefined, {
        ...opts,
        timeZone: effectiveTimezone ?? undefined,
      });
    } catch {
      try {
        return new Date(sessionStatus.nextAt).toLocaleString(undefined, opts);
      } catch {
        return null;
      }
    }
  })();

  function handleCohortSelect(batchId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (batchId && batchId !== 'base' && batchId !== course.id) {
      params.set('cohort', batchId);
    } else {
      params.set('cohort', 'base');
    }
    const q = params.toString();
    const href = q ? `${pathname}?${q}` : pathname;
    startTransition(() => {
      router.push(href, { scroll: false });
    });
    setOpenDropdown(false);
    setQuery('');
  }

  function handleJoin(mode?: 'teach') {
    setJoinError(null);
    startJoinTransition(async () => {
      const res = await joinLiveSession(effectiveId, mode);
      if (res?.error) setJoinError(res.error);
    });
  }

  function onInstructorJoin() {
    if (isOwnerOfActiveCohort && !sessionStatus.isLive && !hasAssessment) {
      setConfirmGoLiveOpen(true);
      return;
    }
    handleJoin('teach');
  }

  // Base program schedule and status derivations
  const baseCadence = formatCadence(course.meetingDays, course.meetingTime);
  const baseTz = tzShort(course.timezone, course.startDate);
  const isBaseLive = isBaseProgramActive && sessionStatus.isLive;
  const isBaseEnrolled = enrolledIds.has(course.id);
  const isBaseInstructor = Boolean(user && course.instructorId === user.sub);

  // Filter cohorts if search query typed
  const qFilter = query.trim().toLowerCase();
  const matchesBase =
    !qFilter ||
    'base program initial'.includes(qFilter) ||
    course.title.toLowerCase().includes(qFilter) ||
    (baseCadence ?? '').toLowerCase().includes(qFilter);

  const filteredBatches = batches.filter((b) => {
    if (!qFilter) return true;
    const label = (b.title.includes(' — ') ? b.title.slice(b.title.indexOf(' — ') + 3) : b.title).toLowerCase();
    const c = (formatCadence(b.meetingDays, b.meetingTime) ?? '').toLowerCase();
    return label.includes(qFilter) || c.includes(qFilter);
  });

  const enrolledCount = activeCohort
    ? activeCohort._count.enrollments
    : course._count.enrollments;

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm space-y-4">
      {/* 1. Cockpit Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-extrabold tracking-tight text-neutral-950">
          Classroom Cockpit
        </h2>
        {sessionStatus.isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-live" />
            Live Now
          </span>
        ) : (
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-neutral-500">
            {batches.length > 0 ? `${batches.length + 1} batches` : 'Single batch'}
          </span>
        )}
      </div>

      {/* 2. Integrated Batch Dropdown Switcher */}
      {batches.length > 0 && (
        <div ref={dropdownRef} className="relative">
          <label className="block mb-1 text-[10.5px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
            Active Batch
          </label>
          <button
            type="button"
            onClick={() => setOpenDropdown((prev) => !prev)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-all',
              openDropdown
                ? 'border-signal-600 bg-signal-50/50 ring-2 ring-signal-500/20'
                : 'border-neutral-200 bg-neutral-50/60 hover:border-neutral-300 hover:bg-white',
              isPending && 'opacity-70',
            )}
            aria-haspopup="listbox"
            aria-expanded={openDropdown}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-bold text-neutral-900">
                  {activeLabel}
                </span>
                {isBaseProgramActive && (
                  <span className="rounded bg-neutral-200/80 px-1 py-0.2 font-mono text-[9px] font-semibold text-neutral-600">
                    Base
                  </span>
                )}
                {((activeCohort && Boolean(activeCohort.liveSessionId)) ||
                  (isBaseProgramActive && sessionStatus.isLive)) && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase">
                    Live
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                {cadence ?? 'Schedule TBA'}
                {cadence && tz ? ` (${tz})` : ''}
              </p>
            </div>
            <PiCaretDownBold
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform duration-200',
                openDropdown && 'rotate-180',
              )}
              aria-hidden
            />
          </button>

          {/* Dropdown Popover */}
          {openDropdown && (
            <div
              role="listbox"
              className="absolute left-0 right-0 z-50 mt-1.5 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-fade-up"
            >
              {batches.length >= 3 && (
                <div className="p-1">
                  <div className="relative">
                    <PiMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Filter batches…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-3 text-xs text-neutral-800 placeholder-neutral-400 focus:border-signal-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-signal-600"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto divide-y divide-neutral-100 p-1">
                {/* Base Program (Initial Program) */}
                {matchesBase && (
                  <div className="pb-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      Base Program
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCohortSelect('base')}
                      className={cn(
                        'group flex w-full items-start justify-between gap-2.5 rounded-xl p-2.5 text-left transition-colors',
                        isBaseProgramActive
                          ? 'bg-signal-50 text-signal-950 font-medium'
                          : 'hover:bg-neutral-50 text-neutral-700',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-neutral-900 group-hover:text-signal-900">
                            {course.title}
                          </span>
                          <span className="rounded bg-neutral-200/80 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-neutral-600">
                            Base / Initial
                          </span>
                          {isBaseLive && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wide text-white">
                              <span className="h-1 w-1 rounded-full bg-white animate-live" />
                              Live
                            </span>
                          )}
                          {isBaseEnrolled && (
                            <span className="rounded-full bg-signal-100 px-1.5 py-0.2 text-[9px] font-bold text-signal-800">
                              Enrolled
                            </span>
                          )}
                          {isBaseInstructor && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-100 px-1.5 py-0.2 text-[9px] font-bold text-accent-800">
                              <PiChalkboardTeacherBold className="h-2.5 w-2.5" />
                              Teaching
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
                          {baseCadence ?? 'Schedule TBA'}
                          {baseCadence && baseTz ? ` (${baseTz})` : ''} · {course._count.enrollments}{' '}
                          {course._count.enrollments === 1 ? 'student' : 'students'}
                          {course.instructor?.name && <> · {course.instructor.name}</>}
                        </div>
                      </div>
                      {isBaseProgramActive && (
                        <PiCheckBold className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-700" aria-hidden />
                      )}
                    </button>
                  </div>
                )}

                {/* Additional Batches */}
                <div className="pt-1 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Additional Batches ({batches.length})
                  </div>

                  {filteredBatches.map((b) => {
                    const isSelected = b.id === activeCohort?.id;
                    const isLive = Boolean(b.liveSessionId);
                    const isEnrolled = enrolledIds.has(b.id);
                    const isInstructor = user && b.instructor?.id === user.sub;
                    const c = formatCadence(b.meetingDays, b.meetingTime);
                    const bTz = tzShort(b.timezone, b.startDate);
                    const label = b.title.includes(' — ')
                      ? b.title.slice(b.title.indexOf(' — ') + 3)
                      : b.title;

                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleCohortSelect(b.id)}
                        className={cn(
                          'group flex w-full items-start justify-between gap-2.5 rounded-xl p-2.5 text-left transition-colors',
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
                              <span className="rounded-full bg-signal-100 px-1.5 py-0.2 text-[9px] font-bold text-signal-800">
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
                          <div className="mt-0.5 text-[11px] text-neutral-500 truncate">
                            {c ?? 'Schedule TBA'}
                            {c && bTz ? ` (${bTz})` : ''} · {b._count.enrollments}{' '}
                            {b._count.enrollments === 1 ? 'student' : 'students'}
                            {b.instructor?.name && <> · {b.instructor.name}</>}
                          </div>
                        </div>
                        {isSelected && (
                          <PiCheckBold className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal-700" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Hero Session Stage Container (Dark / Emerald Cockpit Stage) */}
      <div
        style={
          sessionStatus.isLive
            ? undefined
            : {
                background:
                  'radial-gradient(ellipse at 92% 18%, rgba(33, 98, 78, 0.65) 0%, rgba(27, 65, 54, 0.35) 45%, transparent 75%), linear-gradient(108deg, #1e2227 0%, #1b3a34 45%, #1c5446 100%)',
              }
        }
        className={cn(
          'relative overflow-hidden rounded-xl p-4 shadow-sm transition-all text-white',
          sessionStatus.isLive
            ? 'bg-gradient-to-br from-neutral-900 via-neutral-900 to-rose-950 border border-rose-900/40'
            : 'border border-emerald-900/40',
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            {sessionStatus.isLive
              ? 'Class In Session'
              : whenFormatted
              ? 'Next Session'
              : 'Session Schedule'}
          </p>
          {!sessionStatus.joinableNow && (
            <button
              onClick={() => router.refresh()}
              title="Refresh session status"
              className="text-neutral-400 hover:text-white transition-colors"
            >
              <PiArrowClockwiseBold className="h-3 w-3" />
            </button>
          )}
        </div>

        <p className="text-sm font-bold text-white tracking-tight">
          {sessionStatus.isLive
            ? 'The live room is open'
            : whenFormatted
            ? whenFormatted
            : 'No upcoming session scheduled'}
        </p>

        <p className="mt-1 text-xs text-neutral-400">
          {sessionStatus.isLive
            ? 'Class is in progress. Enter now to participate.'
            : isOwnerOfActiveCohort || isAdmin
            ? 'You can enter as instructor to start the room.'
            : isEnrolledInActiveCohort
            ? 'Your instructor will open the room shortly.'
            : 'Enrol to join the live room.'}
        </p>

        {/* Action Buttons based on User Role */}
        <div className="mt-3.5 space-y-2">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => handleJoin('teach')}
                disabled={joinPending}
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-bold text-neutral-950 transition-all shadow-xs',
                  sessionStatus.isLive
                    ? 'bg-rose-500 hover:bg-rose-400 text-white'
                    : 'bg-signal-500 hover:bg-signal-400 text-neutral-950',
                  joinPending && 'opacity-60 cursor-not-allowed',
                )}
              >
                {joinPending ? 'Connecting…' : 'Join as instructor'}
                <PiArrowRightBold className="h-3 w-3" />
              </button>

              <button
                type="button"
                onClick={() => handleJoin()}
                disabled={joinPending}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 px-3 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <PiEyeBold className="h-3.5 w-3.5" />
                Shadow join (unseen)
              </button>
            </>
          ) : isOwnerOfActiveCohort ? (
            <button
              type="button"
              onClick={onInstructorJoin}
              disabled={joinPending}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-xs font-bold text-neutral-950 transition-all shadow-xs',
                sessionStatus.isLive
                  ? 'bg-rose-500 hover:bg-rose-400 text-white'
                  : sessionStatus.joinableNow
                  ? 'bg-signal-500 hover:bg-signal-400'
                  : 'bg-neutral-700 hover:bg-neutral-600 text-white',
                joinPending && 'opacity-60 cursor-not-allowed',
              )}
            >
              {joinPending
                ? 'Opening room…'
                : sessionStatus.isLive
                ? 'Rejoin class'
                : sessionStatus.joinableNow
                ? 'Go live now'
                : 'Start practice session'}
              <PiArrowRightBold className="h-3 w-3" />
            </button>
          ) : isEnrolledInActiveCohort ? (
            sessionStatus.joinableNow ? (
              <button
                type="button"
                onClick={() => handleJoin()}
                disabled={joinPending}
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-xs font-bold transition-all shadow-xs',
                  sessionStatus.isLive
                    ? 'bg-rose-500 hover:bg-rose-400 text-white animate-live'
                    : 'bg-signal-500 hover:bg-signal-400 text-neutral-950',
                  joinPending && 'opacity-60 cursor-not-allowed',
                )}
              >
                {joinPending ? 'Joining…' : 'Join live class'}
                <PiArrowRightBold className="h-3 w-3" />
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-lg bg-neutral-900 p-2 text-xs text-neutral-400 border border-neutral-800">
                <span>Class opens at schedule</span>
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className="font-medium text-signal-400 hover:underline"
                >
                  Check again
                </button>
              </div>
            )
          ) : user?.role === 'STUDENT' ? (
            <form action={enroll.bind(null, effectiveId)}>
              <SubmitButton
                variant="primary"
                size="md"
                className="w-full text-xs font-bold"
                pendingLabel="Enrolling…"
              >
                {activeCohort ? `Enroll in ${activeLabel}` : 'Enroll in program'}
              </SubmitButton>
            </form>
          ) : (
            <p className="text-center text-xs text-neutral-400 py-1">
              Sign in to join this class
            </p>
          )}

          {joinError && (
            <p className="text-xs text-rose-400 text-center">{joinError}</p>
          )}
        </div>
      </div>

      {/* 4. Integrated Cohort Facts & Metadata */}
      <dl className="divide-y divide-neutral-100 text-xs">
        <div className="flex items-start justify-between py-2">
          <dt className="text-neutral-500">Schedule</dt>
          <dd className="font-semibold text-neutral-900 text-right">
            {cadence ?? 'To be announced'}
            {cadence && tz ? <span className="block text-[11px] font-normal text-neutral-400">{tz}</span> : null}
          </dd>
        </div>

        <div className="flex items-start justify-between py-2">
          <dt className="text-neutral-500">Duration</dt>
          <dd className="font-semibold text-neutral-900 text-right">
            {duration ?? 'Self-paced'}
          </dd>
        </div>

        <div className="flex items-start justify-between py-2">
          <dt className="text-neutral-500">
            {cohortState.status === 'COMPLETED' ? 'Ran' : 'Dates'}
          </dt>
          <dd className="font-semibold text-neutral-900 text-right">
            {dateRange ?? 'To be scheduled'}
          </dd>
        </div>

        <div className="flex items-start justify-between py-2">
          <dt className="text-neutral-500">Enrolled</dt>
          <dd className="font-semibold text-neutral-900 text-right">
            {enrolledCount} {enrolledCount === 1 ? 'student' : 'students'}
          </dd>
        </div>

        <div className="flex items-start justify-between py-2">
          <dt className="text-neutral-500">Certificate</dt>
          <dd className="font-semibold text-neutral-900 text-right">
            On completion
            <span className="block text-[11px] font-normal text-neutral-400">Verifiable</span>
          </dd>
        </div>
      </dl>

      {/* 5. Footer Actions: Edit Batch & Add Batch (if batches exist), or Edit Program & Add Batch (if no batches) */}
      {isAdmin && (
        <div className="pt-2 border-t border-neutral-100 flex items-center gap-2">
          <EditProgramButton
            key={hasBatches ? activeCourseForEdit.id : course.id}
            course={hasBatches ? activeCourseForEdit : course}
            parentTitle={course.title}
            label={activeCohort ? 'Edit batch' : 'Edit program'}
            className={cn(btn('secondary', 'sm'), 'flex-1 text-center justify-center')}
          />
          <AddBatchButton
            programId={course.id}
            defaultWeeks={course.durationWeeks}
            defaultTimezone={course.timezone}
            defaultTime={course.meetingTime}
            defaultDays={course.meetingDays}
            className={cn(btn('secondary', 'sm'), 'flex-1 text-center justify-center')}
          >
            + Add batch
          </AddBatchButton>
        </div>
      )}

      {/* Instructor assessment warning confirm modal */}
      {confirmGoLiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/60 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
          >
            <h3 className="font-display text-lg font-extrabold tracking-tight text-neutral-950">
              Go live without an assessment?
            </h3>
            <p className="mt-2 text-xs text-neutral-600">
              This program has no post-class assessment questions configured.
              You can add questions from the Assessments lab first, or continue anyway.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmGoLiveOpen(false)}
                className={btn('secondary', 'sm')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmGoLiveOpen(false);
                  handleJoin('teach');
                }}
                className={btn('primary', 'sm')}
              >
                Go live anyway →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
