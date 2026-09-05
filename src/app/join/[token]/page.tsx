import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import type { InviteResolution } from '@/lib/types';
import { JoinForm } from './join-form';
import { JoinWorkspaceButton } from './join-workspace-button';

export const metadata = { title: 'Join — livetich' };

export default async function JoinPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  // Resolve the invite first — it's shown to both signed-in and signed-out
  // visitors (a signed-in user joins on their existing account rather than
  // being bounced to their dashboard, which is the multi-workspace fix).
  let res: InviteResolution;
  try {
    res = await api<InviteResolution>(`/invites/${token}`);
  } catch {
    res = { valid: false };
  }

  if (!res.valid || !res.organization) {
    return (
      <AuthShell
        title="This invite isn't valid"
        subtitle="The link may have expired, been used up, or been revoked."
        footer={
          <p className="mt-6 text-sm text-neutral-500">
            Ask your company for a fresh invite link, or{' '}
            <Link href="/login" className="font-semibold text-signal-700 hover:text-signal-600">
              log in
            </Link>{' '}
            if you already have an account.
          </p>
        }
      >
        <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-500">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-neutral-400" aria-hidden>
            <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          Invite links are issued by your company&apos;s admin.
        </div>
      </AuthShell>
    );
  }

  const roleLabel = res.role === 'INSTRUCTOR' ? 'instructor' : 'student';
  const user = await getCurrentUser().catch(() => null);

  // Signed in already: join this workspace on the existing account — no second
  // signup. (Previously a signed-in visitor was bounced to their dashboard and
  // could never accept the invite.)
  if (user) {
    return (
      <AuthShell
        title={`Join ${res.organization.name}`}
        subtitle={`Add this ${roleLabel} workspace to your account — no new signup needed.`}
        footer={
          <p className="mt-6 text-sm text-neutral-500">
            Signed in as{' '}
            <span className="font-medium text-neutral-700">{user.email}</span>.{' '}
            <Link
              href="/login"
              className="font-semibold text-signal-700 hover:text-signal-600"
            >
              Use a different account
            </Link>
          </p>
        }
      >
        <JoinWorkspaceButton
          inviteToken={token}
          orgName={res.organization.name}
          roleLabel={roleLabel}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${res.organization.name}`}
      subtitle={`Create your ${roleLabel} account${
        res.organization.tagline ? ` — ${res.organization.tagline}` : ''
      }`}
      footer={
        <p className="mt-6 text-sm text-neutral-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-signal-700 hover:text-signal-600">
            Log in
          </Link>
        </p>
      }
    >
      <JoinForm inviteToken={token} />
    </AuthShell>
  );
}
