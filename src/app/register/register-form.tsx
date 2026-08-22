'use client';

import { useActionState } from 'react';
import { registerOrganization, type AuthFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { PasswordInput } from '@/components/password-input';
import { inputClassLg, labelClassLg } from '@/lib/ui';

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
    <form action={action} className="mt-8 space-y-6">
      <FormError message={state.error} />

      <div className="space-y-2">
        <label htmlFor="organizationName" className={labelClassLg}>
          Your school or teaching space
        </label>
        <input
          id="organizationName"
          name="organizationName"
          required
          autoComplete="organization"
          placeholder="e.g. Bright Future Institute, or your own name"
          className={inputClassLg}
        />
        <p className="text-[13px] text-neutral-400">
          This is the name your students will see. You can change it anytime.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="name" className={labelClassLg}>
          Your name
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="name"
          placeholder="Amara Okafor"
          className={inputClassLg}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className={labelClassLg}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClassLg}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className={labelClassLg}>
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Create a password"
          showRequirement
          size="lg"
        />
      </div>

      <SubmitButton size="xl" className="w-full" pendingLabel="Setting up…">
        Create my teaching space
      </SubmitButton>
      <p className="text-[13px] text-neutral-400">
        Next, you&apos;ll add your logo and brand colour, then invite instructors
        and students with a link — all from your dashboard.
      </p>
    </form>
  );
}
