'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';
import { login, type AuthFormState } from '@/app/actions/auth';
import { clearRealtimeToken } from '@/lib/client-token';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { Turnstile } from '@/components/turnstile';
import { inputClassLg, labelClassLg } from '@/lib/ui';

const initial: AuthFormState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, initial);
  // Drop any realtime token cached in this tab from a previous session. logout
  // deletes the cookie and client-navigates here WITHOUT a full reload, so the
  // in-memory cache would otherwise survive — and the next user's sockets would
  // authenticate as the previous user (the "instructor will join you soon" even
  // though they're present, until the 12-min TTL lapsed / logins were retried).
  useEffect(() => {
    clearRealtimeToken();
  }, []);
  return (
    <form action={action} className="mt-8 space-y-6">
      <FormError message={state.error} />
      {next && <input type="hidden" name="next" value={next} />}
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
      <Turnstile />
      <SubmitButton size="xl" className="w-full" pendingLabel="Logging in…">
        Log in
      </SubmitButton>
    </form>
  );
}
