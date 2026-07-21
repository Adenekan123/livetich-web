'use client';

import { useActionState } from 'react';
import {
  addSection,
  issueCertificate,
  scheduleSession,
  type ActionState,
} from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import type { Section } from '@/lib/types';

const initial: ActionState = { error: null };

const inputCls = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const smallSubmit =
  'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50';

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  );
}

export function AddSectionForm({ courseId }: { courseId: string }) {
  const [state, action] = useActionState(addSection, initial);
  return (
    <form action={action} className="mt-2 space-y-2">
      <ErrorNote error={state.error} />
      <input type="hidden" name="courseId" value={courseId} />
      <input
        name="title"
        required
        placeholder="Section title"
        className={inputCls}
      />
      <SubmitButton className={smallSubmit}>Add section</SubmitButton>
    </form>
  );
}

export function ScheduleSessionForm({
  courseId,
  sections,
}: {
  courseId: string;
  sections: Section[];
}) {
  const [state, action] = useActionState(scheduleSession, initial);
  return (
    <form action={action} className="mt-2 space-y-2">
      <ErrorNote error={state.error} />
      <input type="hidden" name="courseId" value={courseId} />
      <input
        name="scheduledAt"
        type="datetime-local"
        required
        className={inputCls}
      />
      {sections.length > 0 && (
        <select name="sectionId" className={inputCls} defaultValue="">
          <option value="">No specific section</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.order}. {s.title}
            </option>
          ))}
        </select>
      )}
      <SubmitButton className={smallSubmit}>Schedule</SubmitButton>
    </form>
  );
}

export function IssueCertificateForm({
  courseId,
  students,
}: {
  courseId: string;
  students: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(issueCertificate, initial);
  return (
    <form action={action} className="mt-2 space-y-2">
      <ErrorNote error={state.error} />
      <input type="hidden" name="courseId" value={courseId} />
      <select name="studentId" required className={inputCls}>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <SubmitButton className={smallSubmit}>Issue certificate</SubmitButton>
    </form>
  );
}
