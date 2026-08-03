import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Set a new password - livetich' };

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password for your account."
      footer={
        <p className="mt-6 text-sm text-neutral-500">
          <Link
            href="/login"
            className="font-semibold text-signal-700 hover:text-signal-600"
          >
            Back to log in
          </Link>
        </p>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm leading-relaxed text-neutral-700">
          This reset link is missing its token. Request a fresh one from{' '}
          <Link
            href="/forgot-password"
            className="font-semibold text-signal-700 hover:text-signal-600"
          >
            forgot password
          </Link>
          .
        </div>
      )}
    </AuthShell>
  );
}
