'use client';

import { useActionState } from 'react';
import { redeemQuickAccess, type QuickAccessState } from '@/app/actions/quick-access';
import { btn, cn, inputClass } from '@/lib/ui';

/**
 * Six digits and nothing else — no email, no password, no workspace picker.
 * The whole point of the shortcut is that a student arriving for a class that
 * started a minute ago has one thing to type.
 */
export function PasscodeForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<QuickAccessState, FormData>(
    redeemQuickAccess.bind(null, slug),
    { error: null },
  );

  return (
    <form action={action} className="mt-6 w-full">
      <label htmlFor="qa-code" className="sr-only">
        Your six-digit code
      </label>
      <input
        id="qa-code"
        name="passcode"
        // A phone should offer the number pad, and a browser should not try to
        // remember this the way it remembers a password.
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        placeholder="••••••"
        aria-describedby={state.error ? 'qa-error' : undefined}
        className={cn(
          inputClass,
          'text-center font-mono text-3xl tracking-[0.4em] placeholder:tracking-[0.4em]',
        )}
      />
      {state.error && (
        <p id="qa-error" role="alert" className="mt-3 text-sm text-rose-600">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={cn(btn('primary', 'md'), 'mt-4 w-full')}
      >
        {pending ? 'Checking…' : 'Enter class'}
      </button>
    </form>
  );
}
