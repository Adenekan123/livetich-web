'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { resetPassword, type ResetPasswordState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClassLg, labelClassLg } from '@/lib/ui';

const initial: ResetPasswordState = { error: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, action] = useActionState(resetPassword, initial);

  // On success, bounce to login shortly after showing the confirmation.
  useEffect(() => {
    if (!state.ok) return;
    const t = setTimeout(() => router.push('/login'), 1600);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  if (state.ok) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-relaxed text-emerald-800">
        Your password has been updated. Redirecting you to log in…
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-6">
      <FormError message={state.error} />
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <label htmlFor="newPassword" className={labelClassLg}>
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          className={inputClassLg}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirm" className={labelClassLg}>
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
          className={inputClassLg}
        />
      </div>
      <SubmitButton size="xl" className="w-full" pendingLabel="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
