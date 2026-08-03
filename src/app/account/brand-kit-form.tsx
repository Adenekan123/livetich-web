'use client';

import { useActionState } from 'react';
import { updateBrand, type OrgActionState } from '@/app/actions/org';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { inputClass, labelClass } from '@/lib/ui';
import type { Organization } from '@/lib/types';

const initial: OrgActionState = { error: null };

export function BrandKitForm({ org }: { org: Organization }) {
  const [state, action] = useActionState(updateBrand, initial);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />

      <div className="space-y-1.5">
        <label htmlFor="brand-name" className={labelClass}>
          Company name
        </label>
        <input
          id="brand-name"
          name="name"
          defaultValue={org.name}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="brand-tagline" className={labelClass}>
          Tagline
        </label>
        <input
          id="brand-tagline"
          name="tagline"
          defaultValue={org.tagline ?? ''}
          placeholder="Careers, accelerated."
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-[auto_1fr] items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="brand-color" className={labelClass}>
            Brand color
          </label>
          <input
            id="brand-color"
            name="primaryColor"
            type="color"
            defaultValue={org.primaryColor ?? '#4f46e5'}
            className="h-[46px] w-16 cursor-pointer rounded-xl border border-neutral-300 bg-white p-1"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="brand-logo" className={labelClass}>
            Logo URL
          </label>
          <input
            id="brand-logo"
            name="logoUrl"
            defaultValue={org.logoUrl ?? ''}
            placeholder="https://…/logo.png"
            className={inputClass}
          />
        </div>
      </div>

      <SubmitButton pendingLabel="Saving…">Save brand kit</SubmitButton>
    </form>
  );
}
