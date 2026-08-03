'use client';

import { useTransition } from 'react';
import { assignInstructor } from '@/app/actions/org';
import type { OrgMember } from '@/lib/types';

export function AssignInstructorControl({
  courseId,
  instructors,
  currentInstructorId,
}: {
  courseId: string;
  instructors: OrgMember[];
  currentInstructorId: string | null;
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={currentInstructorId ?? ''}
      disabled={pending}
      onChange={(e) => start(() => assignInstructor(courseId, e.target.value))}
      aria-label="Assign instructor"
      className="max-w-[11rem] rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 transition focus:border-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-900/10 disabled:opacity-50"
    >
      <option value="">Unassigned</option>
      {instructors.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name}
        </option>
      ))}
    </select>
  );
}
