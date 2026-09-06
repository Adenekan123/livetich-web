'use client';

import { useActionState } from 'react';
import { createWorkspace, type WorkspaceActionState } from '@/app/actions/auth';
import { SubmitButton } from '@/components/submit-button';
import { FormError } from '@/components/form-error';
import { btn, inputClass, labelClass } from '@/lib/ui';

const initial: WorkspaceActionState = { error: null };

/**
 * Create a new teaching space (org) on the CURRENT account — the person becomes
 * its admin without a second signup. On success the action redirects into the
 * new workspace. Opened from the workspace switcher.
 */
export function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const [state, action] = useActionState(createWorkspace, initial);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create a teaching space"
        className="w-full max-w-md rounded-2xl bg-white p-6 text-neutral-900 shadow-2xl sm:p-7"
      >
        <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
          Create a teaching space
        </h2>
        <p className="mt-1.5 text-sm text-neutral-500">
          Start your own workspace and invite students — all on this same
          account. You can switch between your workspaces anytime.
        </p>
        <form action={action} className="mt-4 space-y-4">
          <FormError message={state.error} />
          <div className="space-y-1.5">
            <label htmlFor="ws-name" className={labelClass}>
              Workspace name
            </label>
            <input
              id="ws-name"
              name="organizationName"
              required
              autoFocus
              maxLength={100}
              placeholder="e.g. Bright Future Institute"
              className={inputClass}
            />
            <p className="text-xs text-neutral-400">
              This is the name your students will see. You can change it later.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <SubmitButton pendingLabel="Creating…">Create workspace</SubmitButton>
            <button type="button" onClick={onClose} className={btn('ghost', 'sm')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
