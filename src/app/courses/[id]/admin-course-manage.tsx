'use client';

import { useState, useTransition } from 'react';
import { PiChalkboardTeacher, PiPlus, PiUsers, PiX } from 'react-icons/pi';
import {
  addStudentToCourse,
  assignInstructor,
  removeStudentFromCourse,
  type ActionState,
} from '@/app/actions/courses';
import { avatarColor, btn, cardClass, cn, initials } from '@/lib/ui';
import type { OrgMember } from '@/lib/types';

interface CourseStudent {
  id: string;
  name: string;
  email: string;
}

const selectClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-900/5';

/**
 * Admin-only inline management for a program: assign the instructor and add or
 * remove enrolled students, without leaving the program page. Every mutation is
 * a server action that revalidates this route, so the lists refresh in place.
 */
export function AdminCourseManage({
  courseId,
  currentInstructorId,
  currentInstructorName,
  instructors,
  students,
  orgStudents,
}: {
  courseId: string;
  currentInstructorId: string | null;
  currentInstructorName: string | null;
  instructors: OrgMember[];
  students: CourseStudent[];
  orgStudents: OrgMember[];
}) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-neutral-900">Manage program</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <InstructorManager
          courseId={courseId}
          currentInstructorId={currentInstructorId}
          currentInstructorName={currentInstructorName}
          instructors={instructors}
        />
        <StudentManager
          courseId={courseId}
          students={students}
          orgStudents={orgStudents}
        />
      </div>
    </section>
  );
}

function InstructorManager({
  courseId,
  currentInstructorId,
  currentInstructorName,
  instructors,
}: {
  courseId: string;
  currentInstructorId: string | null;
  currentInstructorName: string | null;
  instructors: OrgMember[];
}) {
  const [choice, setChoice] = useState(currentInstructorId ?? '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = choice !== (currentInstructorId ?? '');

  const save = () => {
    setError(null);
    start(async () => {
      const res: ActionState = await assignInstructor(courseId, choice || null);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className={cn(cardClass, 'p-5')}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-900 text-white">
          <PiChalkboardTeacher className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">Instructor</h3>
      </div>
      <p className="mt-3 text-sm text-neutral-500">
        {currentInstructorName ? (
          <>
            Currently teaching:{' '}
            <span className="font-medium text-neutral-800">
              {currentInstructorName}
            </span>
          </>
        ) : (
          'No instructor assigned yet.'
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className={cn(selectClass, 'max-w-xs flex-1')}
          aria-label="Instructor"
        >
          <option value="">— Unassigned —</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={!dirty || pending}
          className={btn('primary', 'sm')}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {instructors.length === 0 && (
        <p className="mt-2 text-xs text-neutral-400">
          No instructors in your organization yet — invite one from Account.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function StudentManager({
  courseId,
  students,
  orgStudents,
}: {
  courseId: string;
  students: CourseStudent[];
  orgStudents: OrgMember[];
}) {
  const [choice, setChoice] = useState('');
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enrolledIds = new Set(students.map((s) => s.id));
  const available = orgStudents.filter((s) => !enrolledIds.has(s.id));

  const add = () => {
    if (!choice) return;
    setError(null);
    start(async () => {
      const res = await addStudentToCourse(courseId, choice);
      if (res.error) setError(res.error);
      else setChoice('');
    });
  };

  const remove = (studentId: string) => {
    setError(null);
    setBusyId(studentId);
    start(async () => {
      const res = await removeStudentFromCourse(courseId, studentId);
      if (res.error) setError(res.error);
      setBusyId(null);
    });
  };

  return (
    <div className={cn(cardClass, 'p-5')}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-900 text-white">
          <PiUsers className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">
          Students
          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
            {students.length}
          </span>
        </h3>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className={cn(selectClass, 'max-w-xs flex-1')}
          aria-label="Add a student"
          disabled={available.length === 0}
        >
          <option value="">
            {available.length === 0
              ? 'All students enrolled'
              : 'Add a student…'}
          </option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.email}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={!choice || pending}
          className={btn('primary', 'sm')}
        >
          <PiPlus className="h-4 w-4" /> Add
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {students.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-sm text-neutral-500">
          No students enrolled yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100">
          {students.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white',
                  avatarColor(s.id),
                )}
                aria-hidden
              >
                {initials(s.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-neutral-800">
                  {s.name}
                </span>
                <span className="block truncate text-xs text-neutral-400">
                  {s.email}
                </span>
              </span>
              <button
                onClick={() => remove(s.id)}
                disabled={pending && busyId === s.id}
                aria-label={`Remove ${s.name}`}
                title="Remove from program"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
              >
                <PiX className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
