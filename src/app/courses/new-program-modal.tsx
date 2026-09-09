'use client';

import { useEffect } from 'react';
import { PiPlusBold, PiXBold } from 'react-icons/pi';
import { btn } from '@/lib/ui';
import { NewProgramForm } from './new-program-form';

/** Admin-only trigger for the shared creation workspace. */
export function NewProgramButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={btn('primary', 'sm')}>
      <PiPlusBold className="h-4 w-4" aria-hidden />
      New program
    </button>
  );
}

/** Full-screen creation workspace shared by every program-create trigger. */
export function NewProgramModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-program-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-[#f4f6f3]"
        >
          <div className="animate-fade-up mx-auto min-h-full w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
            <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-5">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-signal-700">
                  Program setup
                </p>
                <h2 id="new-program-title" className="mt-2 text-2xl font-extrabold tracking-tight text-neutral-950 sm:text-3xl">
                  Create a program
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Add the essentials now. You can complete the rest after creation.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close program setup"
                title="Close program setup"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-neutral-300 bg-white text-neutral-800 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-600"
              >
                <PiXBold className="h-5 w-5 stroke-[2.5]" aria-hidden />
              </button>
            </header>
            <div className="mx-auto max-w-3xl py-7">
              <NewProgramForm />
            </div>
          </div>
        </div>
  );
}
