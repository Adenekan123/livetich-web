'use client';

import { useState } from 'react';
import { setQuickAccess, revokeQuickAccess } from '@/app/actions/quick-access';
import { btn, cardClass, cn, inputClass, labelClass } from '@/lib/ui';

/**
 * Where a student sets up the home-screen shortcut.
 *
 * The link is shown only after a code exists, because a link without a code is
 * a dead end — and showing them together is what makes the pairing obvious:
 * the URL says which workspace, the code says which student.
 */
export function ShortcutPanel({ initialSlug }: { initialSlug: string | null }) {
  const [slug, setSlug] = useState(initialSlug);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Built in the browser so it is right in every environment without the
  // server having to be told its own public address.
  const url =
    slug && typeof window !== 'undefined'
      ? `${window.location.origin}/q/${slug}`
      : null;

  const save = async () => {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set('passcode', code);
    const res = await setQuickAccess({ error: null }, fd);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSlug(res.slug ?? null);
    setCode('');
  };

  const turnOff = async () => {
    setBusy(true);
    const res = await revokeQuickAccess();
    setBusy(false);
    if (res.error) setError(res.error);
    else setSlug(null);
  };

  return (
    <div className={cn(cardClass, 'p-5 sm:p-6')}>
      <h2 className="font-display text-lg font-extrabold tracking-tight text-neutral-950">
        Quick access
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Put your workspace on your phone&apos;s home screen and open today&apos;s
        classes with a six-digit code — no email, no password.
      </p>

      {url && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className={labelClass}>Your link</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-neutral-800 ring-1 ring-neutral-200">
              {url}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                });
              }}
              className={btn('secondary', 'sm')}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Open it on your phone, then use your browser&apos;s{' '}
            <span className="font-semibold">Add to Home Screen</span> — it will
            install with your workspace&apos;s name and logo.
          </p>
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="qa-new" className={labelClass}>
          {slug ? 'Change your code' : 'Choose a six-digit code'}
        </label>
        <input
          id="qa-new"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          placeholder="••••••"
          className={cn(inputClass, 'mt-1 font-mono tracking-[0.3em]')}
        />
        <p className="mt-1 text-xs text-neutral-500">
          Not 123456, not all the same digit, and not a run like 345678 — anyone
          who finds your link would try those first.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-rose-600">
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || code.length !== 6}
            onClick={() => void save()}
            className={cn(btn('primary'), (busy || code.length !== 6) && 'opacity-50')}
          >
            {busy ? 'Saving…' : slug ? 'Change code' : 'Turn on quick access'}
          </button>
          {slug && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void turnOff()}
              className={btn('secondary')}
            >
              Turn off
            </button>
          )}
        </div>
        {slug && (
          <p className="mt-2 text-xs text-neutral-500">
            Changing your code issues a new link — the old one stops working,
            which is what you want if you think someone else has it.
          </p>
        )}
      </div>
    </div>
  );
}
