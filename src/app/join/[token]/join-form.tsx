'use client';

import { useActionState } from 'react';
import { register, type AuthFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { inputClass, labelClass } from '@/lib/ui';

const initial: AuthFormState = { error: null };

export function JoinForm({ inviteToken }: { inviteToken: string }) {
  const [state, action] = useActionState(register, initial);
  return (
    <form action={action} className="mt-8 space-y-5">
      <FormError message={state.error} />
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
