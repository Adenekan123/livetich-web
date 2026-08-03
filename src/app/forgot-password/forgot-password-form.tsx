'use client';

import { useActionState } from 'react';
import {
  forgotPassword,
  type ForgotPasswordState,
} from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';

const initial: ForgotPasswordState = { error: null };

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPassword, initial);

  if (state.sent) {
    return (
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm leading-relaxed text-neutral-700">
        If an account exists for that email, a reset link is on its way — it&apos;s
        valid for 30 minutes. Check your inbox (and spam).
      </div>
    );
  }

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
      <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
