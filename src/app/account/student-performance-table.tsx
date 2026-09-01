'use client';

import { useMemo, type ReactNode } from 'react';
import type { TableColumn } from 'react-data-table-component';
import { DataTable } from '@/components/data-table';
import { avatarColor, cardClass, cn, initials } from '@/lib/ui';
import type { StudentStat } from '@/lib/types';

/** A right-aligned mono numeric cell, muted when the value is a zero/none. */
function num(value: string | number, muted?: boolean): ReactNode {
  return (
    <span
      className={cn(
        'font-mono text-sm',
        muted ? 'text-neutral-400' : 'text-neutral-800',
      )}
    >
      {value}
    </span>
  );
}

/** Attendance/assignment ratios sort by fraction; untracked (0 total) sorts last. */
const ratio = (done: number, total: number) => (total > 0 ? done / total : -1);

function buildColumns(
  showPrograms: boolean,
  rowActions?: Record<string, ReactNode>,
): TableColumn<StudentStat>[] {
  const columns: TableColumn<StudentStat>[] = [
    {
      id: 'name',
      name: 'Student',
      sortable: true,
      grow: 2,
      selector: (s) => s.name.toLowerCase(),
      cell: (s) => (
        <div className="flex items-center gap-2.5 py-1">
          <span
            className={cn(
              'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
              avatarColor(s.id),
            )}
            aria-hidden
          >
            {initials(s.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{s.name}</p>
            <p className="truncate text-xs text-neutral-400">{s.email}</p>
          </div>
        </div>
      ),
    },
  ];

  if (showPrograms) {
    columns.push({
      id: 'programs',
      name: 'Programs',
      sortable: true,
      right: true,
      selector: (s) => s.enrolledCourseIds.length,
      cell: (s) => num(s.enrolledCourseIds.length),
    });
  }

  columns.push(
    {
      id: 'points',
      name: 'Points',
      sortable: true,
      right: true,
      selector: (s) => s.points,
      cell: (s) => num(s.points),
    },
    {
      id: 'interactions',
      name: 'Interactions',
      sortable: true,
      right: true,
      selector: (s) => s.interactions,
      cell: (s) => num(s.interactions),
    },
    {
      id: 'attendance',
      name: 'Attendance',
      sortable: true,
      right: true,
      selector: (s) => ratio(s.attended, s.held),
      cell: (s) =>
        num(s.held > 0 ? `${s.attended}/${s.held}` : s.attended, s.attended === 0),
    },
    {
      id: 'assignments',
      name: 'Assignments',
      sortable: true,
      right: true,
      selector: (s) => ratio(s.assignmentsSubmitted, s.assignmentsTotal),
      cell: (s) =>
        num(
          s.assignmentsTotal > 0
            ? `${s.assignmentsSubmitted}/${s.assignmentsTotal}`
            : '—',
          s.assignmentsSubmitted === 0,
        ),
    },
  );

  if (rowActions) {
    columns.push({
      id: 'actions',
      name: '',
      right: true,
      // Two buttons ("Manage programs" + Disable/Enable) need room; without a
      // floor the column collapses to RDT's default width and the labels wrap.
      grow: 0,
      minWidth: '280px',
      cell: (s) => <>{rowActions[s.id]}</>,
    });
  }

  return columns;
}

/**
 * Student roster with performance. Points, interactions (chat + quiz answers),
 * and attendance come from real data; assignment submissions have no model yet,
 * so that column shows not-tracked rather than fabricated numbers.
 *
 * A table earns its keep by letting the instructor rank a cohort, so every
 * metric column is sortable (default: points, highest first). Row actions are
 * passed as pre-rendered nodes keyed by student id — this is a Client Component,
 * so a function render-prop can't cross the boundary from the server.
 */
export function StudentPerformanceTable({
  students,
  showPrograms = false,
  emptyLabel = 'No students yet.',
  rowActions,
}: {
  students: StudentStat[];
  scoped?: boolean;
  showPrograms?: boolean;
  emptyLabel?: string;
  rowActions?: Record<string, ReactNode>;
}) {
  const columns = useMemo(
    () => buildColumns(showPrograms, rowActions),
    [showPrograms, rowActions],
  );

  return (
    <>
      <div className={cn(cardClass, 'mt-6 overflow-hidden px-2 py-1 sm:px-3')}>
        <DataTable
          columns={columns}
          data={students}
          defaultSortFieldId="points"
          defaultSortAsc={false}
          noDataText={emptyLabel}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Points are earned in live sessions; interactions count chat messages and
        quiz/buzzer answers; attendance counts live sessions joined out of
        sessions held; assignments show submissions out of assignments set. Click
        a column to sort.
      </p>
    </>
  );
}
