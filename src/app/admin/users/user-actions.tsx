'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  impersonate,
  sendResetLink,
  setSuperAdmin,
  setUserRole,
  setUserStatus,
  verifyUserEmail,
} from '@/app/actions/admin';
import { cn } from '@/lib/ui';
import type { AdminUserRow, Role } from '@/lib/types';

const ROLES: Role[] = ['STUDENT', 'INSTRUCTOR', 'ORG_ADMIN'];

/** Per-row action menu for the admin Users table. */
export function UserActions({
  user,
  isSelf,
}: {
  user: AdminUserRow;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disabled = user.status === 'DISABLED';

  function run(fn: () => Promise<{ error: string | null } | void>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError(null);
    setOpen(false);
    start(async () => {
      const res = await fn();
      if (res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="relative flex items-center justify-end gap-2">
      {error && (
        <span className="max-w-[200px] truncate text-xs text-rose-600" title={error}>
          {error}
        </span>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-signal-600 hover:text-signal-700 disabled:opacity-50"
      >
        {pending ? '…' : 'Actions'}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
            <MenuItem
              onClick={() =>
                run(
                  () => setUserStatus(user.id, disabled ? 'ACTIVE' : 'DISABLED'),
                  disabled
                    ? undefined
                    : `Disable ${user.name}? They will be signed out and blocked from logging in.`,
                )
              }
              disabled={isSelf}
              danger={!disabled}
            >
              {disabled ? 'Enable account' : 'Disable account'}
            </MenuItem>

            <MenuItem onClick={() => run(() => sendResetLink(user.id))}>
              Send password-reset link
            </MenuItem>

            {!user.emailVerified && (
              <MenuItem onClick={() => run(() => verifyUserEmail(user.id))}>
                Mark email verified
              </MenuItem>
            )}

            <MenuItem
              onClick={() =>
                run(
                  () => impersonate(user.id),
                  `Log in as ${user.name}? You'll browse the app as them for 30 minutes. Use "Stop impersonating" to return.`,
                )
              }
              disabled={isSelf}
            >
              Impersonate
            </MenuItem>

            <div className="my-1 border-t border-neutral-100" />
            <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              Set role
            </div>
            {ROLES.map((r) => (
              <MenuItem
                key={r}
                onClick={() =>
                  run(
                    () => setUserRole(user.id, r),
                    `Change ${user.name}'s role to ${r}?`,
                  )
                }
                disabled={user.role === r}
                muted={user.role === r}
              >
                {r === user.role ? `${label(r)} (current)` : label(r)}
              </MenuItem>
            ))}

            <div className="my-1 border-t border-neutral-100" />
            <MenuItem
              onClick={() =>
                run(
                  () => setSuperAdmin(user.id, !user.isSuperAdmin),
                  user.isSuperAdmin
                    ? `Revoke platform-admin from ${user.name}?`
                    : `Grant platform-admin to ${user.name}? They will get full operator access.`,
                )
              }
              disabled={isSelf && user.isSuperAdmin}
              danger={!user.isSuperAdmin}
            >
              {user.isSuperAdmin ? 'Revoke platform admin' : 'Grant platform admin'}
            </MenuItem>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
  muted,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'block w-full px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40',
        danger
          ? 'text-rose-600 hover:bg-rose-50'
          : muted
            ? 'text-neutral-400'
            : 'text-neutral-700 hover:bg-signal-50 hover:text-signal-700',
      )}
    >
      {children}
    </button>
  );
}

function label(r: Role): string {
  return r === 'ORG_ADMIN'
    ? 'Org admin'
    : r.charAt(0) + r.slice(1).toLowerCase();
}
