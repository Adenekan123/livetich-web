'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setMemberStatus } from '@/app/actions/org';
import { cn } from '@/lib/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { UserStatus } from '@/lib/types';

/** Admin control to disable/enable an org member (blocks login + ends session). */
export function MemberStatusToggle({
  memberId,
  status,
}: {
  memberId: string;
  status: UserStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const disabled = status === 'DISABLED';

  function apply() {
    setError(null);
    start(async () => {
      const res = await setMemberStatus(
        memberId,
        disabled ? 'ACTIVE' : 'DISABLED',
      );
      if (res.error) setError(res.error);
      else {
        setConfirmOpen(false);
        router.refresh();
      }
    });
  }

  // Enabling is harmless — do it straight away. Disabling blocks login and ends
  // the member's live session, so confirm it first.
  function onClick() {
    if (disabled) apply();
    else setConfirmOpen(true);
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-rose-600">{error}</span>}
      <button
        onClick={onClick}
        disabled={pending}
        className={cn(
          'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50',
          disabled
            ? 'bg-signal-700 text-white hover:bg-signal-800'
            : 'border border-neutral-300 text-rose-600 hover:border-rose-300 hover:bg-rose-50',
        )}
      >
        {pending ? '…' : disabled ? 'Enable' : 'Disable'}
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={apply}
        pending={pending}
        variant="danger"
        title="Disable this member?"
        message="They'll be signed out and blocked from logging in until you re-enable them. Any live session they're in ends immediately."
        confirmLabel="Disable"
      />
    </span>
  );
}
