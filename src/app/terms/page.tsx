import { LegalShell } from '../legal/legal-shell';

export const metadata = { title: 'Terms of Service — livetich' };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 3, 2026">
      <p>
        These Terms govern your use of <strong>livetich</strong> (the
        &quot;Service&quot;), operated by <strong>[Legal Entity Name]</strong>. By
        creating an account or joining a class, you agree to them.
      </p>

      <h2>The Service</h2>
      <p>
        livetich lets instructors run live classes — video, a shared chalkboard,
        chat, quizzes, and certificates — for students they invite. During the
        pilot the Service is provided <strong>free of charge</strong> and
        &quot;as is&quot;.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>You must provide accurate information and keep your login secure.</li>
        <li>You are responsible for activity under your account.</li>
        <li>
          Organization admins are responsible for the members they invite and the
          content of their classes.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service unlawfully or to harass, harm, or deceive others.</li>
        <li>Upload content you don&apos;t have the right to share.</li>
        <li>
          Disrupt, reverse-engineer, or attempt to gain unauthorized access to the
          Service.
        </li>
      </ul>

      <h2>Content</h2>
      <p>
        You retain ownership of the content you create (lessons, board drawings,
        messages). You grant us the limited rights needed to host and deliver it as
        part of the Service.
      </p>

      <h2>Disclaimers &amp; liability</h2>
      <p>
        The Service is provided &quot;as is&quot; without warranties. To the extent
        permitted by law, we are not liable for indirect or consequential damages,
        or for interruptions caused by third-party providers (network, video, or
        email services).
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate
        accounts that violate these Terms.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these Terms; continued use after changes means you accept
        them. Contact: <strong>[support@yourdomain]</strong>.
      </p>
    </LegalShell>
  );
}
