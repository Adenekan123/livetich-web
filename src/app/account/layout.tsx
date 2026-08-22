import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { getCurrentUser } from '@/lib/auth';

/** Wraps the account hub + all settings sub-pages in the sidebar shell. */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
