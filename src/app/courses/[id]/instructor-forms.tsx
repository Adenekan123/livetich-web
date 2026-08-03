'use client';

import { useActionState } from 'react';
import { addSection, type ActionState } from '@/app/actions/courses';
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
