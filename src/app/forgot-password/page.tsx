import Link from 'next/link';
import { AuthShell } from '@/components/auth-shell';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = { title: 'Forgot password - livetich' };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <p className="mt-6 text-sm text-neutral-500">
          Remembered it?{' '}
          <Link
            href="/login"
            className="font-semibold text-signal-700 hover:text-signal-600"
          >
            Back to log in
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
