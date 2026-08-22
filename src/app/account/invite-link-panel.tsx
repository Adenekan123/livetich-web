'use client';

import { useActionState, useState } from 'react';
import { createInvite, revokeInvite } from '@/app/actions/org';
import { btn, cn } from '@/lib/ui';
import type { OrgInvite, Role } from '@/lib/types';

function joinUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/join/${token}`;
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = joinUrl(token);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 truncate rounded-lg border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 font-mono text-xs text-neutral-700"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — the field is selectable as a fallback */
          }
        }}
        className={btn('secondary', 'sm')}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

export function InviteLinkPanel({
  role,
  invites,
  courseId,
}: {
  role: Extract<Role, 'STUDENT' | 'INSTRUCTOR'>;
  invites: OrgInvite[];
  /** When set, the link is scoped to this program (auto-enroll / auto-assign). */
  courseId?: string;
}) {
  const [state, action, pending] = useActionState(createInvite, {
    error: null as string | null,
  });
  // The just-created link, read straight from the action result — no effect.
  const freshToken = state.invite?.token ?? null;

  const active = invites.filter((i) => i.status === 'ACTIVE');
  const noun = role === 'INSTRUCTOR' ? 'instructor' : 'student';
  const shareHint = courseId
    ? role === 'INSTRUCTOR'
      ? 'New link — whoever joins is assigned to teach this program:'
      : 'New link — share it; whoever joins enrols in this program:'
    : `New link — share it with your ${noun}s:`;

  return (
    <div className="space-y-3">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="role" value={role} />
        {courseId && <input type="hidden" name="courseId" value={courseId} />}
        <button disabled={pending} className={btn('primary', 'sm')}>
          {pending ? 'Generating…' : `Generate ${noun} link`}
        </button>
        {state.error && <span className="text-xs text-rose-600">{state.error}</span>}
      </form>

      {freshToken && (
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="mb-1.5 text-xs font-medium text-neutral-500">{shareHint}</p>
          <CopyLink token={freshToken} />
        </div>
      )}

      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-neutral-700">
                  {inv.label || `${noun} link`}
                  <span className="ml-2 text-neutral-400">
                    {inv.uses} joined
                    {inv.maxUses ? ` / ${inv.maxUses}` : ''}
                  </span>
                </p>
                <div className="mt-1.5">
                  <CopyLink token={inv.token} />
                </div>
              </div>
              <form action={revokeInvite.bind(null, inv.id, courseId)}>
                <button className={cn(btn('ghost', 'sm'), 'text-rose-600 hover:bg-rose-50')}>
                  Revoke
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {active.length === 0 && !freshToken && (
        <p className="text-xs text-neutral-400">
          No active {noun} links yet. Generate one to start onboarding.
        </p>
      )}
    </div>
  );
}
