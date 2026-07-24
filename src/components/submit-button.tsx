'use client';

import { useFormStatus } from 'react-dom';
import { btn } from '@/lib/ui';

/**
 * Form submit button wired to the parent form's pending state. `className`
 * extends the chosen variant (e.g. "w-full"); it does not replace it.
 */
export function SubmitButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  pendingLabel,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={btn(variant, size, className)}
    >
      {pending && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {pending ? (pendingLabel ?? 'Working…') : children}
    </button>
  );
}
