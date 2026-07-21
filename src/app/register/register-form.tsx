'use client';

import { useActionState } from 'react';
import { register, type AuthFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';

const initial: AuthFormState = { error: null };

export function RegisterForm() {
  const [state, action] = useActionState(register, initial);
  return (
    <form action={action} className="mt-6 space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <label className="block text-sm">
        <span className="text-slate-700">Name</span>
        <input
          name="name"
          required
          autoComplete="name"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">I want to</span>
        <select
          name="role"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
        >
          <option value="STUDENT">Learn — join live classes</option>
          <option value="INSTRUCTOR">Teach — host live classes</option>
        </select>
      </label>
      <SubmitButton>Sign up</SubmitButton>
    </form>
  );
}
