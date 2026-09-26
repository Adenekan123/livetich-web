'use client';

import { useState, useTransition } from 'react';
import { PiArrowRightBold, PiCheckBold } from 'react-icons/pi';
import { switchWorkspace } from '@/app/actions/auth';
import type { Workspace } from '@/components/workspace-switcher';
import { cn } from '@/lib/ui';

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: 'Admin',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
};

/**
 * The picker itself. Every choice goes through switchWorkspace — including the
 * workspace the token already points at — so the session is always re-minted to
 * match what was actually chosen, rather than trusting whichever org the login
 * happened to carry.
 */
export function WorkspaceChoices({
  workspaces,
  activeOrgId,
}: {
  workspaces: Workspace[];
  activeOrgId: string | null;
}) {
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <ul className="space-y-2">
      {workspaces.map((w) => {
        const isActive = w.organizationId === activeOrgId;
        const isChosen = chosen === w.organizationId;
        return (
          <li key={w.organizationId}>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setChosen(w.organizationId);
                start(() => switchWorkspace(w.organizationId));
              }}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition',
                'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50',
                pending && !isChosen && 'opacity-50',
              )}
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-signal-700 text-sm font-extrabold text-white"
                aria-hidden
              >
                {w.organizationName.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-neutral-900">
                  {w.organizationName}
                </span>
                <span className="block text-xs text-neutral-500">
                  {ROLE_LABEL[w.role] ?? w.role}
                  {isActive && ' · last used'}
                </span>
              </span>
              {isChosen && pending ? (
                <span className="text-xs font-semibold text-neutral-500">
                  Opening…
                </span>
              ) : isActive ? (
                <PiCheckBold className="shrink-0 text-signal-700" aria-hidden />
              ) : (
                <PiArrowRightBold
                  className="shrink-0 text-neutral-300 transition group-hover:text-neutral-600"
                  aria-hidden
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
