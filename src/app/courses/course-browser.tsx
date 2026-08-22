'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { btn, cn } from '@/lib/ui';
import type { ClassItem, CohortStatus } from './catalog-lib';
import { NewProgramButton } from './new-program-modal';

type Role = 'STUDENT' | 'INSTRUCTOR' | 'ORG_ADMIN';

/* Admin/full-catalog filters, framed around a cohort's lifecycle. */
const ADMIN_FILTERS = ['All', 'Enrolling', 'Live now', 'In progress', 'Completed'] as const;
type AdminFilter = (typeof ADMIN_FILTERS)[number];

/* Student filters, framed around the student's own relationship to a cohort. */
const STUDENT_FILTERS = ['My programs', 'New programs', 'Past programs'] as const;
type StudentFilter = (typeof STUDENT_FILTERS)[number];

function inAdminFilter(c: ClassItem, f: AdminFilter): boolean {
  switch (f) {
    case 'All':
      return true;
    case 'Enrolling':
      return c.status === 'ENROLLING' || c.status === 'STARTING_SOON' || c.status === 'OPEN';
    case 'Live now':
      return c.isLive;
    case 'In progress':
      return c.status === 'IN_PROGRESS';
    case 'Completed':
      return c.status === 'COMPLETED';
  }
}

function inStudentFilter(c: ClassItem, f: StudentFilter): boolean {
  switch (f) {
    case 'My programs':
      // Enrolled and the cohort hasn't finished yet.
      return c.enrolled && c.status !== 'COMPLETED';
    case 'New programs':
      // Not enrolled and still joinable.
      return (
        !c.enrolled &&
        (c.status === 'ENROLLING' ||
          c.status === 'STARTING_SOON' ||
          c.status === 'OPEN' ||
          c.status === 'LIVE')
      );
    case 'Past programs':
      return c.status === 'COMPLETED';
  }
}

/* ---------- Icons (hairline, 1.5px) ---------- */

const iconCls = 'h-3.5 w-3.5 shrink-0';
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className={iconCls} aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className={iconCls} aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CapIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className={iconCls} aria-hidden>
    <path d="M12 4 2 9l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M6 11v4c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ---------- Status pill (monochrome; energy from weight + the live pulse) ---------- */

function StatusPill({ status, label }: { status: CohortStatus; label: string }) {
  if (status === 'LIVE') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
        <span className="animate-live h-1.5 w-1.5 rounded-full bg-white" />
        {label}
      </span>
    );
  }
  const styles: Record<Exclude<CohortStatus, 'LIVE'>, string> = {
    STARTING_SOON: 'bg-accent-100 text-accent-700',
    ENROLLING: 'border border-neutral-300 bg-white text-neutral-800',
    OPEN: 'border border-neutral-300 bg-white text-neutral-800',
    IN_PROGRESS: 'bg-signal-50 text-signal-800',
    COMPLETED: 'bg-neutral-100 text-neutral-400',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
        styles[status],
      )}
    >
      {status === 'ENROLLING' && <span className="h-1.5 w-1.5 rounded-full bg-signal-600" />}
      {label}
    </span>
  );
}

/* ---------- One cohort card ---------- */

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-neutral-600">
      <span className="text-neutral-400">{icon}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

function CohortCard({ c }: { c: ClassItem }) {
  const dim = c.status === 'COMPLETED';
  return (
    <div
      className={cn(
        'group flex flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md',
        dim && 'opacity-70 hover:opacity-100',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-signal-700 text-sm font-bold tracking-tight text-white"
          aria-hidden
        >
          {c.monogram}
        </span>
        <StatusPill status={c.status} label={c.statusLabel} />
      </div>

      {/* Title + provenance */}
      <div className="mt-4">
        <Link
          href={`/courses/${c.courseId}`}
          className="line-clamp-2 font-display text-lg font-extrabold leading-tight tracking-tight text-neutral-950 hover:underline"
        >
          {c.title}
        </Link>
        <p className="mt-1.5 truncate text-sm text-neutral-500">
          {c.instructor}
          <span className="mx-1.5 text-neutral-300">·</span>
          {c.category}
          {c.level && (
            <>
              <span className="mx-1.5 text-neutral-300">·</span>
              {c.level}
            </>
          )}
        </p>
      </div>

      {/* Schedule block */}
      <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm">
        {c.scheduleLabel ? (
          <MetaRow icon={<CalendarIcon />}>
            {c.scheduleLabel}
            {c.tzLabel && <span className="text-neutral-400"> {c.tzLabel}</span>}
          </MetaRow>
        ) : (
          <MetaRow icon={<CalendarIcon />}>
            <span className="text-neutral-400">Schedule to be announced</span>
          </MetaRow>
        )}

        <MetaRow icon={<ClockIcon />}>
          {c.durationLabel ?? 'Self-paced length'}
          {c.startText &&
            (c.status === 'ENROLLING' ||
              c.status === 'STARTING_SOON' ||
              c.status === 'OPEN') && (
              <span className="text-neutral-400"> · starts {c.startText}</span>
            )}
          {c.status === 'IN_PROGRESS' && c.statusHint && (
            <span className="text-neutral-400"> · {c.statusHint}</span>
          )}
        </MetaRow>

        <MetaRow icon={<CapIcon />}>Certificate on completion</MetaRow>
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-neutral-400">
          {c.enrollments} {c.enrollments === 1 ? 'student' : 'students'}
        </span>
        {c.isLive && c.liveSessionId ? (
          <Link href={`/sessions/${c.liveSessionId}`} className={btn('primary', 'sm')}>
            Join live
          </Link>
        ) : (
          <Link href={`/courses/${c.courseId}`} className={btn('secondary', 'sm')}>
            {c.status === 'COMPLETED' ? 'View' : 'View program'}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------- Shared building blocks ---------- */

function PageHeader({
  classes,
  canCreate,
  subtitle,
}: {
  classes: ClassItem[];
  canCreate: boolean;
  subtitle: string;
}) {
  const liveCount = classes.filter((c) => c.isLive).length;
  const enrollingCount = classes.filter(
    (c) => c.status === 'ENROLLING' || c.status === 'STARTING_SOON' || c.status === 'OPEN',
  ).length;
  return (
    <div className="pt-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-950 sm:text-4xl">
          Programs
        </h1>
        {canCreate && <NewProgramButton />}
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-500">{subtitle}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {liveCount > 0 && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-900">
            <span className="animate-live h-1.5 w-1.5 rounded-full bg-rose-500" />
            {liveCount} in session now
          </span>
        )}
        <span className="text-neutral-500">
          <span className="font-semibold text-neutral-800">{enrollingCount}</span> enrolling
        </span>
        <span className="text-neutral-500">
          <span className="font-semibold text-neutral-800">{classes.length}</span> total
        </span>
      </div>
    </div>
  );
}

function SearchBox({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
        <SearchIcon />
      </span>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search programs or instructors…"
        aria-label="Search programs"
        className="w-full rounded-full border border-neutral-300 bg-white py-2 pl-10 pr-4 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-signal-600 focus:outline-none focus:ring-4 focus:ring-signal-600/15"
      />
    </div>
  );
}

function CategoryChips({
  categories,
  cat,
  setCat,
}: {
  categories: string[];
  cat: string;
  setCat: (v: string) => void;
}) {
  if (categories.length <= 2) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {categories.map((c) => {
        const active = c === cat;
        return (
          <button
            key={c}
            onClick={() => setCat(c)}
            aria-pressed={active}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              active
                ? 'border-signal-700 bg-signal-700 text-white'
                : 'border-neutral-200 text-neutral-600 hover:border-signal-400 hover:text-signal-700',
            )}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function FilterTabs<T extends string>({
  filters,
  active,
  onChange,
}: {
  filters: readonly T[];
  active: T;
  onChange: (f: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-full border border-neutral-200 bg-neutral-100 p-0.5 text-sm font-medium">
      {filters.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          aria-pressed={active === f}
          className={cn(
            'rounded-full px-3.5 py-1.5 transition',
            active === f
              ? 'bg-white text-neutral-950 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-900',
          )}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function CardGrid({ items }: { items: ClassItem[] }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <CohortCard key={c.courseId} c={c} />
      ))}
    </div>
  );
}

function EmptyCatalog({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
      <p className="font-display text-lg font-bold text-neutral-950">
        {canCreate ? 'No programs yet' : 'No programs published yet'}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
        {canCreate
          ? 'Create your first program to set a schedule, enroll students, and run it live.'
          : 'Your school hasn’t published any live programs yet. Check back soon — you’ll see them here the moment they open.'}
      </p>
      {canCreate && (
        <div className="mt-5 flex justify-center">
          <NewProgramButton />
        </div>
      )}
    </div>
  );
}

function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white text-neutral-400 ring-1 ring-neutral-200">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <p className="mt-3 font-semibold text-neutral-950">No programs match</p>
      <p className="mt-1 text-sm text-neutral-500">Try a different search or filter.</p>
      <button onClick={onClear} className={btn('secondary', 'sm', 'mt-4')}>
        Clear filters
      </button>
    </div>
  );
}

/** Apply the shared search + category filter (role-independent). */
function useSearched(classes: ClassItem[], query: string, cat: string): ClassItem[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes.filter((c) => {
      if (cat !== 'All' && c.category !== cat) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.instructor.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [classes, query, cat]);
}

/* ---------- Browser (role-aware router) ---------- */

export function CourseBrowser({
  classes,
  role,
  currentUserId,
  canCreate = false,
}: {
  classes: ClassItem[];
  role: Role;
  currentUserId: string;
  canCreate?: boolean;
}) {
  if (role === 'STUDENT') return <StudentBrowser classes={classes} />;
  if (role === 'INSTRUCTOR')
    return <InstructorBrowser classes={classes} currentUserId={currentUserId} />;
  return <AdminBrowser classes={classes} canCreate={canCreate} />;
}

/* ---------- Org admin: full catalog, all lifecycle filters (unchanged) ---------- */

function AdminBrowser({ classes, canCreate }: { classes: ClassItem[]; canCreate: boolean }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [filter, setFilter] = useState<AdminFilter>('All');

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(classes.map((c) => c.category))).sort()],
    [classes],
  );
  const searched = useSearched(classes, query, cat);
  const filtered = useMemo(
    () => searched.filter((c) => inAdminFilter(c, filter)),
    [searched, filter],
  );

  return (
    <div>
      <PageHeader
        classes={classes}
        canCreate={canCreate}
        subtitle="Cohort-based classes your students join on a fixed weekly schedule. Every program runs live for a set number of weeks and ends with a verifiable certificate."
      />

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs filters={ADMIN_FILTERS} active={filter} onChange={setFilter} />
        <SearchBox query={query} setQuery={setQuery} />
      </div>

      <CategoryChips categories={categories} cat={cat} setCat={setCat} />

      <p className="mt-6 text-sm font-semibold text-neutral-950">
        {filter === 'All' ? 'All programs' : filter}
        <span className="ml-2 font-medium text-neutral-400">{filtered.length}</span>
      </p>

      {filtered.length > 0 ? (
        <CardGrid items={filtered} />
      ) : classes.length === 0 ? (
        <EmptyCatalog canCreate={canCreate} />
      ) : (
        <NoMatch
          onClear={() => {
            setQuery('');
            setCat('All');
            setFilter('All');
          }}
        />
      )}
    </div>
  );
}

/* ---------- Student: My / New / Past programs ---------- */

function StudentBrowser({ classes }: { classes: ClassItem[] }) {
  const hasEnrolled = classes.some((c) => c.enrolled && c.status !== 'COMPLETED');
  const defaultFilter: StudentFilter = hasEnrolled ? 'My programs' : 'New programs';

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [filter, setFilter] = useState<StudentFilter>(defaultFilter);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(classes.map((c) => c.category))).sort()],
    [classes],
  );
  const searched = useSearched(classes, query, cat);
  const filtered = useMemo(
    () => searched.filter((c) => inStudentFilter(c, filter)),
    [searched, filter],
  );

  return (
    <div>
      <PageHeader
        classes={classes}
        canCreate={false}
        subtitle="Live cohort classes on a fixed weekly schedule. Join a new program or pick up one you’re enrolled in — each ends with a verifiable certificate."
      />

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs filters={STUDENT_FILTERS} active={filter} onChange={setFilter} />
        <SearchBox query={query} setQuery={setQuery} />
      </div>

      <CategoryChips categories={categories} cat={cat} setCat={setCat} />

      <p className="mt-6 text-sm font-semibold text-neutral-950">
        {filter}
        <span className="ml-2 font-medium text-neutral-400">{filtered.length}</span>
      </p>

      {filtered.length > 0 ? (
        <CardGrid items={filtered} />
      ) : classes.length === 0 ? (
        <EmptyCatalog canCreate={false} />
      ) : (
        <NoMatch
          onClear={() => {
            setQuery('');
            setCat('All');
            setFilter(defaultFilter);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Instructor: their assigned programs first, then the rest ---------- */

function InstructorBrowser({
  classes,
  currentUserId,
}: {
  classes: ClassItem[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(classes.map((c) => c.category))).sort()],
    [classes],
  );
  const searched = useSearched(classes, query, cat);

  const mine = useMemo(
    () => searched.filter((c) => c.instructorId === currentUserId),
    [searched, currentUserId],
  );
  const rest = useMemo(
    () => searched.filter((c) => c.instructorId !== currentUserId),
    [searched, currentUserId],
  );

  return (
    <div>
      <PageHeader
        classes={classes}
        canCreate={false}
        subtitle="The cohort classes you teach, plus the rest of your school’s catalog. Each program runs live on a fixed weekly schedule and ends with a verifiable certificate."
      />

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBox query={query} setQuery={setQuery} />
      </div>

      <CategoryChips categories={categories} cat={cat} setCat={setCat} />

      {classes.length === 0 ? (
        <EmptyCatalog canCreate={false} />
      ) : mine.length === 0 && rest.length === 0 ? (
        <NoMatch
          onClear={() => {
            setQuery('');
            setCat('All');
          }}
        />
      ) : (
        <div className="mt-6 space-y-8">
          {mine.length > 0 && (
            <section>
              <p className="text-sm font-semibold text-neutral-950">
                Your programs
                <span className="ml-2 font-medium text-neutral-400">{mine.length}</span>
              </p>
              <CardGrid items={mine} />
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <p className="text-sm font-semibold text-neutral-950">
                More in your school
                <span className="ml-2 font-medium text-neutral-400">{rest.length}</span>
              </p>
              <CardGrid items={rest} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
