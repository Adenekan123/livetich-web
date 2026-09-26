'use client';

import { useState, useTransition } from 'react';
import { joinWorkspace } from '@/app/actions/auth';
import { btn } from '@/lib/ui';

/**
 * For a user who is ALREADY signed in and opens an invite link: join the new
 * workspace on their existing account (adds a membership) rather than forcing a
 * second account. Success redirects into the joined workspace.
 */
export function JoinWorkspaceButton({
  inviteToken,
  orgName,
  roleLabel,
  courseId = null,
  enrolling = false,
}: {
  inviteToken: string;
  orgName: string;
  roleLabel: string;
  /** Set when the link enrols into one program — where to land afterwards. */
  courseId?: string | null;
  /** Whether this reads as enrolling in a program or joining a workspace. */
  enrolling?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-8 space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await joinWorkspace(inviteToken, courseId);
            if (res?.error) setError(res.error);
          })
        }
        className={btn('primary', 'xl', 'w-full')}
      >
        {pending
          ? enrolling
            ? 'Enrolling…'
            : 'Joining…'
          : enrolling
            ? 'Enrol in this program →'
            : `Join ${orgName} as ${roleLabel} →`}
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
