import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getCurrentUser, getToken } from '@/lib/auth';
import type { Workspace } from '@/components/workspace-switcher';
import { AuthShell } from '@/components/auth-shell';
import { WorkspaceChoices } from './workspace-choices';

export const metadata = { title: 'Choose a workspace - livetich' };

/**
 * Where login lands when an account belongs to more than one workspace.
 *
 * Someone who teaches in one space and studies in another was previously
 * dropped into whichever the token happened to carry, then had to find the
 * switcher to correct it. Asking once, up front, is cheaper than a wrong guess.
 *
 * A single-workspace account never sees this — it redirects straight through,
 * so the common case costs one server-side hop and nothing visible.
 */
export default async function ChooseWorkspacePage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect('/login');

  const token = await getToken();
  const workspaces = await api<Workspace[]>('/auth/workspaces', { token }).catch(
    () => [] as Workspace[],
  );

  // Nothing to choose between — and if the lookup failed, the dashboard is a
  // better place to fail than a picker with no options in it.
  if (workspaces.length <= 1) redirect('/dashboard');

  return (
    <AuthShell
      title="Choose a workspace"
      subtitle="Your account belongs to more than one. Pick where you want to work."

      footer={
        <p className="mt-6 text-sm text-neutral-500">
          You can switch workspaces at any time from the sidebar.
        </p>
      }
    >
      <WorkspaceChoices
        workspaces={workspaces}
        activeOrgId={user.organizationId ?? null}
      />
    </AuthShell>
  );
}
