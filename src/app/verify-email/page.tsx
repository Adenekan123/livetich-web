import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { getCurrentUser } from '@/lib/auth';
import { VerifyEmailForm } from './verify-email-form';

export const metadata = { title: 'Verify your email - livetich' };

export default async function VerifyEmailPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await props.searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect('/login');
  const dest =
    next && next.startsWith('/') && !next.startsWith('//')
      ? next
      : '/dashboard';
  if (user.emailVerified) redirect(dest);

  return (
    <AuthShell
      title="Verify your email"
      subtitle={`Enter the 6-digit code we emailed to ${user.email}.`}
      footer={
        <p className="mt-6 text-sm text-neutral-500">
          The code expires after 10 minutes.
        </p>
      }
    >
      <VerifyEmailForm next={next} />
    </AuthShell>
  );
}
