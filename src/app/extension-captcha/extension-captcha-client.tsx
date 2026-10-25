'use client';

import { useCallback, useEffect, useState } from 'react';
import { Turnstile } from '@/components/turnstile';

const EXTENSION_ID = 'UsmanAdenekan.livetich';
const CAPTCHA_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim(),
);

interface Handoff {
  state: string;
  scheme: 'vscode' | 'vscode-insiders' | 'antigravity';
}

export function ExtensionCaptchaClient() {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state') ?? '';
    const scheme = params.get('scheme') ?? '';
    if (!/^[a-f0-9]{64}$/i.test(state)) {
      setError('This sign-in request is invalid or has expired. Start again from VS Code.');
      return;
    }
    if (!['vscode', 'vscode-insiders', 'antigravity'].includes(scheme)) {
      setError('This editor is not supported for the sign-in handoff.');
      return;
    }
    setHandoff({ state, scheme: scheme as Handoff['scheme'] });
  }, []);

  const onSuccess = useCallback((value: string) => {
    setToken(value);
    setError('');
  }, []);
  const onExpire = useCallback(() => {
    setToken('');
    setError('The check expired. Complete it again to continue.');
  }, []);
  const onError = useCallback(() => {
    setToken('');
    setError('The security check could not load. Check your connection and retry.');
  }, []);

  const returnToEditor = () => {
    if (!handoff || !token) return;
    setOpening(true);
    const callback = new URL(`${handoff.scheme}://${EXTENSION_ID}/auth/captcha`);
    callback.searchParams.set('state', handoff.state);
    callback.searchParams.set('token', token);
    window.location.assign(callback.toString());
  };

  if (!CAPTCHA_CONFIGURED) {
    return (
      <p role="alert" className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Sign-in verification is not configured on this Livetich server. Contact your administrator.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {handoff ? (
        <Turnstile
          className="flex min-h-16 justify-center"
          onSuccess={onSuccess}
          onExpire={onExpire}
          onError={onError}
        />
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!handoff || !token || opening}
        onClick={returnToEditor}
        className="mt-4 w-full rounded-full bg-[#9beb80] px-5 py-3 font-semibold text-neutral-950 transition hover:bg-[#8ee270] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
      >
        {opening ? 'Returning to VS Code…' : 'Continue to VS Code'}
      </button>
      <p className="mt-4 text-center text-xs leading-5 text-neutral-500">
        This one-time verification expires shortly and is sent directly back to the editor.
      </p>
    </div>
  );
}
