'use client';

import { useActionState } from 'react';
import { createCourse, type ActionState } from '@/app/actions/courses';
import { SubmitButton } from '@/components/submit-button';

const initial: ActionState = { error: null };

export function CreateCourseForm() {
  const [state, action] = useActionState(createCourse, initial);
  return (
    <form action={action} className="mt-3 space-y-3">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <input
        name="title"
        required
        placeholder="Course title"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <textarea
        name="description"
        rows={3}
        placeholder="What will students learn?"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <SubmitButton>Create course</SubmitButton>
    </form>
  );
}
