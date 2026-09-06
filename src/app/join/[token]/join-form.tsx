'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { register, type AuthFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { inputClass, labelClass } from '@/lib/ui';

const initial: AuthFormState = { error: null };

export function JoinForm({
  inviteToken,
  orgName,
}: {
  inviteToken: string;
  orgName: string;
}) {
  const [state, action] = useActionState(register, initial);
  const loginHref = `/login?next=${encodeURIComponent(`/join/${inviteToken}`)}`;
  return (
    <form action={action} className="mt-8 space-y-5">
      {state.emailTaken ? (
        // The email already has an account — turn the dead-end error into a
        // one-click path to sign in and join this workspace.
        <div className="rounded-xl border border-signal-200 bg-signal-50 px-4 py-3 text-sm text-signal-800">
          That email is already registered.{' '}
          <Link href={loginHref} className="font-semibold underline hover:text-signal-600">
            Log in to join {orgName} →
          </Link>
        </div>
      ) : (
        <FormError message={state.error} />
      )}
      <input type="hidden" name="inviteToken" value={inviteToken} />

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
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          showRequirement
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>

      <SubmitButton size="lg" className="w-full" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
