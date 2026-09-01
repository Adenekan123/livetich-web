'use client';

import { useEffect, useState } from 'react';
import { btn } from '@/lib/ui';
import { AddBatchForm } from './add-batch-form';

/**
 * "Add batch" button (managers only) that opens a modal with the batch form.
 * Distinct from New program: a batch belongs to an existing program and only
 * needs a label + its own schedule.
 */
export function AddBatchButton({
  programId,
  defaultWeeks,
  defaultTimezone,
}: {
  programId: string;
  defaultWeeks: number | null;
  defaultTimezone: string | null;
}) {
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
      <button onClick={() => setOpen(true)} className={btn('secondary', 'sm')}>
        + Add batch
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
            aria-label="Add batch"
            className="my-4 w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
                Add a batch
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
              <AddBatchForm
                programId={programId}
                defaultWeeks={defaultWeeks}
                defaultTimezone={defaultTimezone}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
