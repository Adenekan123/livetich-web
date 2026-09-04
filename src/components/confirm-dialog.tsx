'use client';

import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { btn, cn } from '@/lib/ui';

/**
 * App-wide confirmation dialog for consequential actions (logout, delete,
 * disable, remove). Controlled: the caller owns `open` and supplies the
 * confirm/cancel handlers. Danger variant tints the confirm button rose for
 * destructive actions. Closes on Escape and backdrop click; locks body scroll
 * while open. For irreversible deletes that need a typed name, use DangerZone.
 */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  pending = false,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` tints the confirm button rose for destructive actions. */
  variant?: 'default' | 'danger';
  /** Disables the confirm button + shows a spinner label while the action runs. */
  pending?: boolean;
}) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  // Portal to <body> so the fixed backdrop always covers the whole viewport —
  // otherwise a stacking/containing context on an ancestor (the sidebar, the
  // backdrop-blur header, the mobile drawer) traps it and it fails to cover the
  // page (e.g. the sidebar showed through the logout confirm).
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:p-7"
      >
        <h2
          id={titleId}
          className="font-display text-xl font-extrabold tracking-tight text-neutral-950"
        >
          {title}
        </h2>
        {message != null && (
          <div id={descId} className="mt-2 text-sm text-neutral-600">
            {message}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={btn('secondary')}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(btn(variant === 'danger' ? 'danger' : 'primary'))}
          >
            {pending ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
