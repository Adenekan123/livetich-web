'use client';

import { useActionState } from 'react';
import { changePassword, type PasswordFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';

const initial: PasswordFormState = { error: null };

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, initial);
  return (
    <form action={action} className="max-w-sm space-y-4">
      <FormError message={state.error} />
      {state.ok && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
          ✓ Password updated.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="currentPassword" className={labelClass}>
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="newPassword" className={labelClass}>
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className={labelClass}>
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}
