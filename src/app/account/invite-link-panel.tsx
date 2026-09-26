'use client';

import { useActionState, useEffect, useState } from 'react';
import { createInvite, revokeInvite } from '@/app/actions/org';
import { btn, cn } from '@/lib/ui';
import type { OrgInvite, Role } from '@/lib/types';

function joinUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/join/${token}`;
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = joinUrl(token);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 truncate rounded-lg border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 font-mono text-xs text-neutral-700"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — the field is selectable as a fallback */
          }
        }}
        className={btn('secondary', 'sm')}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

/**
 * Invite links for one role, behind a dialog.
 *
 * Every link used to render inline, so a program that had been onboarding for a
 * term pushed everything below it down the page — and the card grew a little
 * each time an admin pressed the button. A link is something you copy once and
 * hand over; it does not need to sit on screen for the rest of its life. So the
 * card keeps a button and a count, and the links live in a dialog that opens on
 * demand — and opens by itself the moment one is generated, since that is the
 * one time you actually want to look at it.
 */
export function InviteLinkPanel({
  role,
  invites,
  courseId,
}: {
  role: Extract<Role, 'STUDENT' | 'INSTRUCTOR'>;
  invites: OrgInvite[];
  /** When set, the link is scoped to this program (auto-enroll / auto-assign). */
  courseId?: string;
}) {
  const [state, action, pending] = useActionState(createInvite, {
    error: null as string | null,
  });
  const [open, setOpen] = useState(false);

  // The just-created link, read straight from the action result — no effect.
  const freshToken = state.invite?.token ?? null;

  const active = invites.filter((i) => i.status === 'ACTIVE');
  // Once the server re-renders, the new link is in `active` too — so listing it
  // again below its own callout would show the same link twice, which reads as
  // two links rather than one emphasised one.
  const others = active.filter((i) => i.token !== freshToken);
  const freshInvite = active.find((i) => i.token === freshToken) ?? null;
  const noun = role === 'INSTRUCTOR' ? 'instructor' : 'student';
  const title = role === 'INSTRUCTOR' ? 'Instructor links' : 'Student links';
  const shareHint = courseId
    ? role === 'INSTRUCTOR'
      ? 'Whoever opens one of these is assigned to teach this program.'
      : 'Whoever opens one of these enrols in this program.'
    : `Share one of these with your ${noun}s to bring them into the workspace.`;

  // A freshly generated link opens the dialog on its own: being handed
  // something you asked for and then having to go looking for it is a strange
  // way to be given it.
  useEffect(() => {
    if (!freshToken) return;
    // Deferred a tick so it isn't a synchronous setState inside the effect —
    // the same shape AddSectionButton uses to close itself.
    const t = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(t);
  }, [freshToken]);

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

  const generateButton = (
    <form action={action}>
      <input type="hidden" name="role" value={role} />
      {courseId && <input type="hidden" name="courseId" value={courseId} />}
      <button disabled={pending} className={btn('primary', 'sm')}>
        {pending ? 'Generating…' : `Generate ${noun} link`}
      </button>
    </form>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {generateButton}
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={btn('secondary', 'sm')}
          >
            Manage links
            <span className="ml-1.5 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[11px] font-bold text-neutral-700">
              {active.length}
            </span>
          </button>
        )}
        {state.error && (
          <span className="text-xs text-rose-600">{state.error}</span>
        )}
      </div>

      {active.length === 0 && (
        <p className="mt-2 text-xs text-neutral-400">
          No active {noun} links yet. Generate one to start onboarding.
        </p>
      )}

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
            aria-label={title}
            className="my-4 w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl sm:my-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-extrabold tracking-tight text-neutral-950">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">{shareHint}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                ✕
              </button>
            </div>

            {/* The new one, called out — it is why the dialog opened. */}
            {freshToken && (
              <div className="mt-5 rounded-xl border border-signal-200 bg-signal-50/60 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-signal-700">
                    New link — copy it now
                  </p>
                  {/* Revocable from here too, since it is deliberately kept out
                      of the list below. */}
                  {freshInvite && (
                    <form action={revokeInvite.bind(null, freshInvite.id, courseId)}>
                      <button
                        className={cn(
                          btn('ghost', 'sm'),
                          'shrink-0 text-rose-600 hover:bg-rose-50',
                        )}
                      >
                        Revoke
                      </button>
                    </form>
                  )}
                </div>
                <CopyLink token={freshToken} />
              </div>
            )}

            {others.length > 0 && (
              <ul className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                {others.map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-xl border border-neutral-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-xs font-medium text-neutral-700">
                        {inv.label || `${noun} link`}
                        <span className="ml-2 text-neutral-400">
                          {inv.uses} joined
                          {inv.maxUses ? ` / ${inv.maxUses}` : ''}
                        </span>
                      </p>
                      <form action={revokeInvite.bind(null, inv.id, courseId)}>
                        <button
                          className={cn(
                            btn('ghost', 'sm'),
                            'shrink-0 text-rose-600 hover:bg-rose-50',
                          )}
                        >
                          Revoke
                        </button>
                      </form>
                    </div>
                    <div className="mt-1.5">
                      <CopyLink token={inv.token} />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {others.length === 0 && !freshToken && (
              <p className="mt-5 rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
                No active {noun} links yet.
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
              {generateButton}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={btn('secondary', 'sm')}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
