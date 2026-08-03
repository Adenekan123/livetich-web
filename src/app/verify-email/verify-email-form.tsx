'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  logout,
  sendVerification,
  verifyEmail,
  type VerifyEmailState,
} from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';

const initial: VerifyEmailState = { error: null };

export function VerifyEmailForm() {
  const [state, action] = useActionState(verifyEmail, initial);
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function resend() {
    setNote(null);
    start(async () => {
      const res = await sendVerification();
      setNote(res.error ?? 'A fresh code is on its way — check your inbox.');
    });
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      <FormError message={state.error} />
      <div className="space-y-1.5">
        <label htmlFor="code" className={labelClass}>
          Verification code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          placeholder="123456"
          className={`${inputClass} text-center text-lg tracking-[0.5em]`}
        />
      </div>
      <SubmitButton size="lg" className="w-full" pendingLabel="Verifying…">
        Verify email
      </SubmitButton>

      <p className="text-center text-sm text-neutral-500">
        Didn&apos;t get it?{' '}
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className="font-semibold text-signal-700 hover:text-signal-600 disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Resend code'}
        </button>
      </p>
      {note && <p className="text-center text-xs text-neutral-500">{note}</p>}

      <p className="border-t border-neutral-100 pt-4 text-center text-xs text-neutral-400">
        Wrong account?{' '}
        <button
          type="button"
          onClick={() => logout()}
          className="font-medium text-neutral-500 hover:text-neutral-900"
        >
          Log out
        </button>
      </p>
    </form>
  );
}
