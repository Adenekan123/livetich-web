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
import { ConfirmDialog } from '@/components/confirm-dialog';
import { cn } from '@/lib/ui';
import type { AdminUserRow, Role } from '@/lib/types';

const ROLES: Role[] = ['STUDENT', 'INSTRUCTOR', 'ORG_ADMIN'];

type ConfirmSpec = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

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
  const [confirmSpec, setConfirmSpec] = useState<
    (ConfirmSpec & { fn: () => Promise<{ error: string | null } | void> }) | null
  >(null);
  const disabled = user.status === 'DISABLED';

  function exec(fn: () => Promise<{ error: string | null } | void>) {
    setError(null);
    setOpen(false);
    start(async () => {
      const res = await fn();
      if (res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  // With a confirm spec, stage a modal instead of acting immediately; otherwise
  // run straight away. Replaces the old native window.confirm() popups.
  function run(
    fn: () => Promise<{ error: string | null } | void>,
    confirm?: ConfirmSpec,
  ) {
    if (confirm) {
      setOpen(false);
      setConfirmSpec({ ...confirm, fn });
      return;
    }
    exec(fn);
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
                    : {
                        title: 'Disable account',
                        message: `Disable ${user.name}? They will be signed out and blocked from logging in.`,
                        confirmLabel: 'Disable account',
                        danger: true,
                      },
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
                run(() => impersonate(user.id), {
                  title: 'Impersonate user',
                  message: `Log in as ${user.name}? You'll browse the app as them for 30 minutes. Use "Stop impersonating" to return.`,
                  confirmLabel: 'Impersonate',
                })
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
                  run(() => setUserRole(user.id, r), {
                    title: 'Change role',
                    message: `Change ${user.name}'s role to ${label(r)}?`,
                    confirmLabel: 'Change role',
                  })
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
                    ? {
                        title: 'Revoke platform admin',
                        message: `Revoke platform-admin from ${user.name}?`,
                        confirmLabel: 'Revoke',
                        danger: true,
                      }
                    : {
                        title: 'Grant platform admin',
                        message: `Grant platform-admin to ${user.name}? They will get full operator access.`,
                        confirmLabel: 'Grant admin',
                        danger: true,
                      },
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

      <ConfirmDialog
        open={confirmSpec !== null}
        onCancel={() => setConfirmSpec(null)}
        onConfirm={() => {
          if (confirmSpec) exec(confirmSpec.fn);
          setConfirmSpec(null);
        }}
        pending={pending}
        title={confirmSpec?.title ?? ''}
        message={confirmSpec?.message}
        confirmLabel={confirmSpec?.confirmLabel}
        variant={confirmSpec?.danger ? 'danger' : 'default'}
      />
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
