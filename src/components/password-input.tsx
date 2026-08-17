'use client';

import { useState } from 'react';
import { cn, inputClass } from '@/lib/ui';

/**
 * Password field with a show/hide toggle. Reduces typo-driven login failures
 * (especially on mobile) without weakening security — the field defaults to
 * masked, and the toggle is a real button with an accessible label + state.
 */
export function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  minLength,
  required,
  showRequirement = false,
}: {
  id: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  /** When true (with minLength), show a live "at least N characters" hint. */
  showRequirement?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');
  const met = minLength ? value.length >= minLength : true;
  const hintId = `${id}-req`;
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-describedby={showRequirement && minLength ? hintId : undefined}
        onChange={(e) => setValue(e.target.value)}
        className={cn(inputClass, 'pr-11')}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500"
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden>
            <path
              d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4 10 7a12 12 0 01-2.4 3.4M6.1 6.2A12 12 0 002 12c1 3 5 7 10 7 1.2 0 2.3-.2 3.3-.6"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden>
            <path
              d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        )}
      </button>
      {showRequirement && minLength ? (
        <p
          id={hintId}
          className={cn(
            'mt-1.5 flex items-center gap-1.5 text-xs transition-colors',
            value.length === 0
              ? 'text-neutral-400'
              : met
                ? 'text-emerald-600'
                : 'text-neutral-500',
          )}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden>
            {met && value.length > 0 ? (
              <path d="m3.5 8.5 2.5 2.5 6.5-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
            )}
          </svg>
          At least {minLength} characters
        </p>
      ) : null}
    </div>
  );
}
