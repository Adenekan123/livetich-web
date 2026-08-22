import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { Organization, SessionUser } from '@/lib/types';
import { ShellChrome } from './shell-chrome';

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
  if (user.organizationId) {
    const token = await getToken();
    org = await api<Organization | null>('/organizations/me', { token }).catch(
      () => null,
    );
  }

  return (
    <ShellChrome
      user={{ name: user.name, role: user.role, sub: user.sub }}
      org={
        org
          ? { name: org.name, logoUrl: org.logoUrl, primaryColor: org.primaryColor }
          : null
      }
    >
      {children}
    </ShellChrome>
  );
}
