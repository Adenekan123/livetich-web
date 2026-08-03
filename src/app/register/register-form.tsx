'use client';

import { useActionState } from 'react';
import { registerOrganization, type AuthFormState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';

const initial: AuthFormState = { error: null };

/** Company signup: creates the organization and its first admin together. */
export function RegisterForm() {
  const [state, action] = useActionState(registerOrganization, initial);

  return (
    <form action={action} className="mt-8 space-y-5">
      <FormError message={state.error} />

      <div className="space-y-1.5">
        <label htmlFor="organizationName" className={labelClass}>
          Company / academy name
        </label>
        <input
          id="organizationName"
          name="organizationName"
          required
          placeholder="Bright Future Institute"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <label htmlFor="primaryColor" className={labelClass}>
            Brand color
          </label>
          <input
            id="primaryColor"
            name="primaryColor"
            type="color"
            defaultValue="#4f46e5"
            className="h-[46px] w-full cursor-pointer rounded-xl border border-neutral-300 bg-white p-1"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tagline" className={labelClass}>
          Tagline <span className="text-neutral-400">(optional)</span>
        </label>
        <input
          id="tagline"
          name="tagline"
          placeholder="Careers, accelerated."
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className={labelClass}>
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={inputClass}
        />
      </div>

      <SubmitButton size="lg" className="w-full" pendingLabel="Creating workspace…">
        Create company workspace
      </SubmitButton>
      <p className="text-xs text-neutral-400">
        You&apos;ll invite your instructors and students with a link once your
        workspace is ready.
      </p>
    </form>
  );
}
