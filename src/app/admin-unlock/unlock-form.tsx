'use client';

import { useActionState } from 'react';
import { adminUnlock } from '@/app/actions/admin';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { labelClassLg } from '@/lib/ui';

export function UnlockForm({ next }: { next: string }) {
  const [state, action] = useActionState(adminUnlock, { error: null });
  return (
    <form action={action} className="space-y-5">
      <FormError message={state.error} />
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <label htmlFor="password" className={labelClassLg}>
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          size="lg"
        />
      </div>
      <SubmitButton size="xl" className="w-full" pendingLabel="Verifying…">
        Unlock console
      </SubmitButton>
    </form>
  );
}
