'use client';

import { useActionState, useState } from 'react';
import { register, type AuthFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { cn, inputClass, labelClass } from '@/lib/ui';

const initial: AuthFormState = { error: null };

const ROLES = [
  { value: 'STUDENT', emoji: '🎯', title: 'Learn', hint: 'Join live classes' },
  { value: 'INSTRUCTOR', emoji: '🎓', title: 'Teach', hint: 'Host live classes' },
] as const;

export function RegisterForm() {
  const [state, action] = useActionState(register, initial);
  const [role, setRole] = useState<string>('STUDENT');

  return (
    <form action={action} className="mt-8 space-y-5">
      <FormError message={state.error} />

      <fieldset className="space-y-2">
        <legend className={labelClass}>I want to…</legend>
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map((r) => {
            const active = role === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                aria-pressed={active}
                className={cn(
                  'rounded-xl border p-3.5 text-left transition duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20',
                  active
                    ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10'
                    : 'border-slate-300 hover:border-slate-400',
                )}
              >
                <span className="text-xl">{r.emoji}</span>
                <p className="mt-1.5 text-sm font-semibold text-slate-900">
                  {r.title}
                </p>
                <p className="text-xs text-slate-500">{r.hint}</p>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="name" className={labelClass}>
          Full name
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="name"
          placeholder="Ada Lovelace"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={inputClass}
        />
      </div>

      <SubmitButton size="lg" className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
