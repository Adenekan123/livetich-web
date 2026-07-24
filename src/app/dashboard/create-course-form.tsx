'use client';

import { useActionState } from 'react';
import { createCourse, type ActionState } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';

const initial: ActionState = { error: null };

export function CreateCourseForm() {
  const [state, action] = useActionState(createCourse, initial);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <div className="space-y-1.5">
        <label htmlFor="title" className={labelClass}>
          Course title
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder="e.g. Intro to Live Streaming"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="description" className={labelClass}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="What will students learn?"
          className={`${inputClass} resize-none`}
        />
      </div>
      <SubmitButton className="w-full" pendingLabel="Creating…">
        Create course
      </SubmitButton>
    </form>
  );
}
