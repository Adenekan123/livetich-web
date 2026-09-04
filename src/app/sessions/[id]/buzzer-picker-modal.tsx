'use client';

import { useEffect } from 'react';
import { PiLightning } from 'react-icons/pi';
import { btn } from '@/lib/ui';

export interface PickableBuzzerQuestion {
  id: string;
  body: string;
  timeLimitSec: number;
}

/**
 * Buzzer round launcher. Lists every authored buzzer question so the instructor
 * picks exactly which one to broadcast — rather than "Start buzzer" always
 * firing the first/selected question. "+ New question" hands off to the create
 * modal. Used from the live room's Start-buzzer control.
 */
export function BuzzerPickerModal({
  questions,
  disabled = false,
  onPick,
  onCreateNew,
  onClose,
}: {
  questions: PickableBuzzerQuestion[];
  /** A round is already open — picking is blocked until it closes. */
  disabled?: boolean;
  onPick: (questionId: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Start a buzzer round"
        className="my-4 w-full max-w-lg rounded-2xl bg-white p-6 text-neutral-900 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-neutral-950">
            <PiLightning className="h-5 w-5 text-signal-600" /> Start a buzzer round
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            ✕
          </button>
        </div>
        <p className="mt-1.5 text-sm text-neutral-500">
          Pick the question to broadcast — the first student to answer correctly
          wins.
        </p>

        {disabled && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-inset ring-amber-200">
            A round is already open — wait for it to finish before starting
            another.
          </p>
        )}

        <ul className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
          {questions.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(q.id)}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left transition hover:border-signal-500 hover:bg-signal-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-semibold text-neutral-900">
                    {q.body}
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-400">
                    {q.timeLimitSec}s to answer
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600 transition group-hover:bg-signal-600 group-hover:text-white">
                  Start ▸
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onCreateNew}
            className={btn('secondary', 'sm')}
          >
            + New question
          </button>
          <button type="button" onClick={onClose} className={btn('ghost', 'sm')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
