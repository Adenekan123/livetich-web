import { ExtensionCaptchaClient } from './extension-captcha-client';

export const metadata = {
  title: 'Verify sign-in | Livetich',
  robots: { index: false, follow: false },
};

export default function ExtensionCaptchaPage() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center px-5 py-16">
      <section className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold text-teal-700">Livetich for VS Code</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-950">
          Verify your sign-in
        </h1>
        <p className="mt-3 leading-6 text-neutral-600">
          Complete this security check, then return to VS Code to finish signing in.
          Your password is never entered on this page.
        </p>
        <ExtensionCaptchaClient />
      </section>
    </main>
  );
}
