'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, type AuthFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { inputClass, labelClass } from '@/lib/ui';

const initial: AuthFormState = { error: null };

export function LoginForm() {
  const [state, action] = useActionState(login, initial);
  return (
    <form action={action} className="mt-8 space-y-5">
      <FormError message={state.error} />
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
        <div className="flex items-center justify-between">
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-signal-700 hover:text-signal-600"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </div>
      <SubmitButton size="lg" className="w-full" pendingLabel="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
