'use client';

import { useActionState } from 'react';
import { changePassword, type PasswordFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { labelClass } from '@/lib/ui';

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
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="newPassword" className={labelClass}>
          New password
        </label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          required
          minLength={8}
          showRequirement
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className={labelClass}>
          Confirm new password
        </label>
        <PasswordInput
          id="confirm"
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}
