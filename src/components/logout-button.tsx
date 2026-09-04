'use client';

import { useState, useTransition } from 'react';
import { logout } from '@/app/actions/auth';
import { ConfirmDialog } from './confirm-dialog';

/**
 * Log-out trigger that asks for confirmation first, so an accidental click
 * doesn't drop someone out of a live class or a half-finished form. The trigger
 * itself is supplied by the caller (`children` + `className`) so it can be a
 * sidebar icon or a header button; this only adds the confirm step + pending
 * state around the server action.
 */
export function LogoutButton({
  className,
  ariaLabel,
  title,
  children,
}: {
  className?: string;
  ariaLabel?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        title={title}
        className={className}
      >
        {children}
      </button>
      <ConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={() => start(() => void logout())}
        pending={pending}
        title="Log out?"
        message="You'll be signed out of livetich on this device and returned to the login page."
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        variant="danger"
      />
    </>
  );
}
