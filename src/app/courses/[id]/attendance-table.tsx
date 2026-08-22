'use client';

import { useMemo, useState } from 'react';
import type { TableColumn } from 'react-data-table-component';
import { API_URL } from '@/lib/api';
import { getRealtimeToken } from '@/lib/client-token';
import { cardClass, cn, labelClass } from '@/lib/ui';
import { DataTable } from '@/components/data-table';
import type { CourseAttendance } from '@/lib/types';

type AttendanceRow = CourseAttendance['rows'][number];

const STATUS_LABEL: Record<CourseAttendance['sessions'][number]['status'], string> = {
  SCHEDULED: 'Scheduled',
  LIVE: 'Live now',
  ENDED: 'Ended',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatJoined(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function sessionLabel(s: CourseAttendance['sessions'][number]): string {
  const when = formatWhen(s.scheduledAt);
  return s.sectionTitle ? `${when} · ${s.sectionTitle}` : when;
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
    <path
      d="m5 13 4 4L19 7"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const attendanceColumns: TableColumn<AttendanceRow>[] = [
  {
    id: 'name',
    name: 'Student',
    selector: (r) => r.name,
    sortable: true,
    grow: 2,
    cell: (r) => (
      <span
        className={cn(
          'font-medium',
          r.present ? 'text-neutral-900' : 'text-neutral-400',
        )}
      >
        {r.name}
      </span>
    ),
  },
  {
    id: 'status',
    name: 'Status',
    selector: (r) => (r.present ? 1 : 0),
    sortable: true,
    cell: (r) =>
      r.present ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          <CheckIcon />
          Present
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
          Absent
        </span>
      ),
  },
  {
    id: 'joined',
    name: 'Joined',
    selector: (r) => r.joinedAt ?? '',
    sortable: true,
    right: true,
    cell: (r) => (
      <span className="tabular-nums text-neutral-600">
        {r.present && r.joinedAt ? formatJoined(r.joinedAt) : '—'}
      </span>
    ),
  },
];

/**
 * Class attendance for a course. The server passes the default (latest) session's
 * attendance; changing the session filter re-fetches client-side with the user's
 * bearer token (the cookie is httpOnly, so we mint one via getRealtimeToken).
 */
export function AttendanceTable({
  courseId,
  initial,
}: {
  courseId: string;
  initial: CourseAttendance;
}) {
  const [data, setData] = useState<CourseAttendance>(initial);
  const [selected, setSelected] = useState<string | null>(initial.sessionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Newest first, regardless of the order the API returns.
  const sessions = useMemo(
    () =>
      [...data.sessions].sort(
        (a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt),
      ),
    [data.sessions],
  );

  const presentCount = data.rows.filter((r) => r.present).length;

  async function load(sessionId: string) {
    setLoading(true);
    setError(null);
    setSelected(sessionId);
    try {
      const token = await getRealtimeToken();
      const res = await fetch(
        `${API_URL}/sessions/course/${courseId}/attendance?sessionId=${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${token ?? ''}` }, cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`Attendance request failed (${res.status})`);
      setData((await res.json()) as CourseAttendance);
    } catch {
      setError('Could not load attendance for that session. Please try again.');
      // Keep the selection in sync with what's actually shown.
      setSelected(data.sessionId);
    } finally {
      setLoading(false);
    }
  }

  if (sessions.length === 0) {
    return (
      <section className={cn(cardClass, 'mt-6 p-8 text-center')}>
        <h2 className="font-display text-lg font-semibold text-neutral-900">
          No sessions yet
        </h2>
        <p className="mt-1.5 text-sm text-neutral-500">
          Attendance appears here once this course has held its first session.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <label htmlFor="attendance-session" className={labelClass}>
            Session
          </label>
          <select
            id="attendance-session"
            value={selected ?? ''}
            disabled={loading}
            onChange={(e) => load(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-950 shadow-sm transition focus:border-signal-600 focus:outline-none focus:ring-4 focus:ring-signal-600/15 disabled:opacity-60"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionLabel(s)} — {STATUS_LABEL[s.status]}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-neutral-500" aria-live="polite">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent" />
              Loading…
            </span>
          ) : (
            <>
              <span className="font-semibold text-neutral-900">{presentCount}</span>
              {' of '}
              <span className="font-semibold text-neutral-900">{data.rows.length}</span>
              {' present'}
            </>
          )}
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <div
        className={cn(
          cardClass,
          'mt-4 overflow-hidden px-2 py-1 transition-opacity sm:px-3',
          loading && 'pointer-events-none opacity-50',
        )}
      >
        <DataTable
          columns={attendanceColumns}
          data={data.rows}
          defaultSortFieldId="name"
          noDataText="No students are enrolled for this session yet."
        />
      </div>
    </section>
  );
}
