'use client';

import { useActionState } from 'react';
import {
  addSection,
  issueCertificate,
  scheduleSession,
  type ActionState,
} from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass } from '@/lib/ui';

const initial: ActionState = { error: null };

export function AddSectionForm({ courseId }: { courseId: string }) {
  const [state, action] = useActionState(addSection, initial);
  return (
    <form action={action} className="mt-3 space-y-2.5">
      <FormError message={state.error} />
      <input type="hidden" name="courseId" value={courseId} />
      <input
        name="title"
        required
        placeholder="Section title"
        className={inputClass}
      />
      <SubmitButton size="sm">Add section</SubmitButton>
    </form>
  );
}

export function ScheduleSessionForm({
  courseId,
  sections,
}: {
  courseId: string;
  sections: { id: string; order: number; title: string }[];
}) {
  const [state, action] = useActionState(scheduleSession, initial);
  return (
    <form action={action} className="mt-3 space-y-2.5">
      <FormError message={state.error} />
      <input type="hidden" name="courseId" value={courseId} />
      <input
        name="scheduledAt"
        type="datetime-local"
        required
        className={inputClass}
      />
      {sections.length > 0 && (
        <select name="sectionId" className={inputClass} defaultValue="">
          <option value="">No specific section</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.order}. {s.title}
            </option>
          ))}
        </select>
      )}
      <SubmitButton size="sm">Schedule session</SubmitButton>
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
    <form action={action} className="mt-3 space-y-2.5">
      <FormError message={state.error} />
      <input type="hidden" name="courseId" value={courseId} />
      <select name="studentId" required className={inputClass}>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <SubmitButton size="sm">Issue certificate</SubmitButton>
    </form>
  );
}
