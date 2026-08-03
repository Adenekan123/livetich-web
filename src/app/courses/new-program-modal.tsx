'use client';

import { useEffect, useState } from 'react';
import { btn } from '@/lib/ui';
import { NewProgramForm } from './new-program-form';

/** Admin-only "New program" button that opens a modal with the create form. */
export function NewProgramButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} className={btn('primary', 'sm')}>
        + New program
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-950/40 p-4 backdrop-blur-sm sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New program"
            className="my-4 w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
                New program
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ✕
              </button>
            </div>
            <div className="mt-4">
              <NewProgramForm />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
