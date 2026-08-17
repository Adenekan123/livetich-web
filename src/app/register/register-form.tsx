'use client';

import { useActionState } from 'react';
import { registerOrganization, type AuthFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { inputClass, labelClass } from '@/lib/ui';

const initial: AuthFormState = { error: null };

/**
 * Teaching-space signup: creates the organization and its first admin together.
 * Kept to the essentials — name, email, password — so a solo instructor is one
 * short form from being set up. Brand colour and tagline are deferred to the
 * account brand kit (see account/brand-kit-form.tsx) rather than gating signup.
 */
export function RegisterForm() {
  const [state, action] = useActionState(registerOrganization, initial);

  return (
    <form action={action} className="mt-8 space-y-5">
      <FormError message={state.error} />

      <div className="space-y-1.5">
        <label htmlFor="organizationName" className={labelClass}>
          Your school or teaching space
        </label>
        <input
          id="organizationName"
          name="organizationName"
          required
          autoComplete="organization"
          placeholder="e.g. Bright Future Institute, or your own name"
          className={inputClass}
        />
        <p className="text-xs text-neutral-400">
          This is the name your students will see. You can change it anytime.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="name" className={labelClass}>
          Your name
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="name"
          placeholder="Amara Okafor"
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>

      <SubmitButton size="lg" className="w-full" pendingLabel="Setting up…">
        Create my teaching space
      </SubmitButton>
      <p className="text-xs text-neutral-400">
        Next, you&apos;ll add your logo and brand colour, then invite instructors
        and students with a link — all from your dashboard.
      </p>
    </form>
  );
}
