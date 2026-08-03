import { LegalShell } from '../legal/legal-shell';

export const metadata = { title: 'Privacy Policy — livetich' };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 3, 2026">
      <p>
        This Privacy Policy explains how <strong>livetich</strong> (&quot;we&quot;,
        &quot;us&quot;), operated by <strong>[Legal Entity Name]</strong>, collects
        and uses information when you use our live-teaching platform (the
        &quot;Service&quot;). Questions: <strong>[privacy@yourdomain]</strong>.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information</strong> — name, email address, role
          (instructor/student/admin), and the organization you belong to.
        </li>
        <li>
          <strong>Class activity</strong> — attendance, chat messages, quiz and
          buzzer answers, points, and assignment submissions created while using a
          live class.
        </li>
        <li>
          <strong>Technical data</strong> — basic device/connection information
          needed to deliver live audio, video, and the shared chalkboard.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide and run live classes and the surrounding coursework.</li>
        <li>To issue and verify certificates of completion.</li>
        <li>
          To send you transactional email (verification codes, password resets,
          class notifications).
        </li>
        <li>To keep the Service secure and prevent abuse.</li>
      </ul>

      <h2>Service providers</h2>
      <p>We share data with processors only as needed to run the Service:</p>
      <ul>
        <li>
          <strong>LiveKit</strong> — real-time audio/video for live sessions.
        </li>
        <li>
          <strong>Resend</strong> — delivery of transactional email.
        </li>
        <li>
          <strong>[Hosting / Database provider]</strong> — application hosting and
          data storage.
        </li>
      </ul>

      <h2>Data retention</h2>
      <p>
        We keep your information for as long as your account is active or as needed
        to provide the Service, then delete or anonymize it, except where we must
        retain it to meet legal obligations.
      </p>

      <h2>Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal
        data by contacting <strong>[privacy@yourdomain]</strong>. Organization
        admins can manage or remove the members they invite.
      </p>

      <h2>Children</h2>
      <p>
        Where classes involve minors, they are enrolled and managed by their
        instructor or organization, who is responsible for obtaining any required
        parental consent.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy; material changes will be posted here with a new
        &quot;last updated&quot; date.
      </p>
    </LegalShell>
  );
}
