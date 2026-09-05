'use client';

import { useState, useTransition } from 'react';
import { PiCaretUpDownBold, PiCheckBold, PiPlusBold } from 'react-icons/pi';
import { switchWorkspace } from '@/app/actions/auth';
import { initials } from '@/lib/ui';
import { CreateWorkspaceModal } from './create-workspace-modal';

export interface Workspace {
  organizationId: string;
  organizationName: string;
  role: string;
}

const roleLabel = (r: string) =>
  r === 'ORG_ADMIN' ? 'Admin' : r === 'INSTRUCTOR' ? 'Instructor' : 'Student';

/**
 * The workspace picker in the app-shell sidebar. Shows the active workspace and,
 * on click, every workspace this account belongs to (switching re-mints an
 * org-scoped token, see switchWorkspace), plus "Create a teaching space".
 */
export function WorkspaceSwitcher({
  workspaces,
  activeOrgId,
  activeName,
  logoUrl,
  primaryColor,
  onNavigate,
}: {
  workspaces: Workspace[];
  activeOrgId: string | null;
  activeName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  /** Close the mobile drawer when an item navigates. */
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, start] = useTransition();
  const active = workspaces.find((w) => w.organizationId === activeOrgId);

  return (
    <div className="relative mb-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-2 text-left transition hover:bg-white/10"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
        ) : (
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[14px] font-extrabold text-white"
            style={{ backgroundColor: primaryColor ?? '#0d9488' }}
            aria-hidden
          >
            {initials(activeName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16.5px] font-bold text-white">{activeName}</p>
          <p className="text-[12.5px] font-medium text-white/45">
            {active ? roleLabel(active.role) : 'Workspace'}
          </p>
        </div>
        <PiCaretUpDownBold className="h-4 w-4 shrink-0 text-white/40" />
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#0f2e2a] py-1 shadow-2xl"
          >
            <p className="px-3 pb-1 pt-1.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-white/35">
              Your workspaces
            </p>
            {workspaces.map((w) => {
              const isActive = w.organizationId === activeOrgId;
              return (
                <button
                  key={w.organizationId}
                  role="menuitem"
                  disabled={pending}
                  onClick={() => {
                    if (isActive) {
                      setOpen(false);
                      return;
                    }
                    start(() => switchWorkspace(w.organizationId));
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10 text-[11px] font-bold text-white">
                    {initials(w.organizationName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-white">
                      {w.organizationName}
                    </span>
                    <span className="block text-[11px] text-white/40">
                      {roleLabel(w.role)}
                    </span>
                  </span>
                  {isActive && <PiCheckBold className="h-4 w-4 shrink-0 text-lime-400" />}
                </button>
              );
            })}
            <div className="my-1 border-t border-white/10" />
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] font-semibold text-lime-300 transition hover:bg-white/10"
            >
              <PiPlusBold className="h-4 w-4 shrink-0" /> Create a teaching space
            </button>
          </div>
        </>
      )}

      {createOpen && (
        <CreateWorkspaceModal
          onClose={() => {
            setCreateOpen(false);
            onNavigate?.();
          }}
        />
      )}
    </div>
  );
}
