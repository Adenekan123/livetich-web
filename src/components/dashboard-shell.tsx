import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { Organization, SessionUser } from '@/lib/types';
import { ShellChrome } from './shell-chrome';
import type { Workspace } from './workspace-switcher';

/**
 * Server wrapper for the Direction B dashboard shell: resolves the org brand
 * (like the header does) and hands plain, serializable props to the client
 * chrome. Used by the dashboard + account surfaces in place of <Header/>.
 */
export async function DashboardShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  let org: Organization | null = null;
  let workspaces: Workspace[] = [];
  if (user.organizationId) {
    const token = await getToken();
    [org, workspaces] = await Promise.all([
      api<Organization | null>('/organizations/me', { token }).catch(() => null),
      api<Workspace[]>('/auth/workspaces', { token }).catch(() => []),
    ]);
  }

  return (
    <ShellChrome
      user={{
        name: user.name,
        role: user.role,
        sub: user.sub,
        isSuperAdmin: user.isSuperAdmin,
      }}
      org={
        org
          ? { name: org.name, logoUrl: org.logoUrl, primaryColor: org.primaryColor }
          : null
      }
      workspaces={workspaces}
      activeOrgId={user.organizationId ?? null}
    >
      {children}
    </ShellChrome>
  );
}
