'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, type AuthFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { inputClassLg, labelClassLg } from '@/lib/ui';

const initial: AuthFormState = { error: null };

export function LoginForm() {
  const [state, action] = useActionState(login, initial);
  return (
    <form action={action} className="mt-8 space-y-6">
      <FormError message={state.error} />
      <div className="space-y-2">
        <label htmlFor="email" className={labelClassLg}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClassLg}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className={labelClassLg}>
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-signal-700 hover:text-signal-600"
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
          size="lg"
        />
      </div>
      <SubmitButton size="xl" className="w-full" pendingLabel="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
