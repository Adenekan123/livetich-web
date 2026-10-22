import { LegalShell } from '../legal/legal-shell';

export const metadata = { title: 'Privacy Policy — livetich' };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 3, 2026">
      <p>
        This Privacy Policy explains how <strong>livetich</strong> (&quot;we&quot;, &quot;us&quot;, or &quot;the Service&quot;)
        collects, processes, and protects your personal data when you use our interactive live-learning platform.
        For questions or requests regarding your data, contact our Data Protection team at{' '}
        <strong>privacy@livetich.com</strong>.
      </p>

      <h2>1. Information we collect</h2>
      <p>We collect information in the following categories when you interact with the Service:</p>
      <ul>
        <li>
          <strong>Account &amp; Profile Information</strong> — Your name, email address, user role
          (student, instructor, or organization administrator), organization membership, profile avatar,
          and authentication credentials.
        </li>
        <li>
          <strong>Live Classroom &amp; Course Activity</strong> — Real-time attendance, text chat logs,
          shared chalkboard contributions, buzzer responses, quiz answers, points earned on leaderboards,
          and student coursework or grading submissions.
        </li>
        <li>
          <strong>Audio &amp; Video Streams</strong> — Live camera, microphone, and screen-sharing media
          transmitted during interactive sessions via WebRTC.
        </li>
        <li>
          <strong>Technical &amp; Telemetry Data</strong> — IP address, browser type, operating system,
          connection quality metrics (packet latency and bitrate), and error diagnostics necessary to maintain
          live room stability.
        </li>
      </ul>

      <h2>2. Live Session Recordings &amp; Audio Notices</h2>
      <p>
        Instructors have the capability to record live cohorts for archiving and student review. When a live
        session is being recorded:
      </p>
      <ul>
        <li>
          An <strong>audible tone flourish</strong> is broadcast to all participants when recording starts
          and stops to notify students that the session is active and recorded.
        </li>
        <li>
          If you speak, enable your webcam, or share your screen during a recorded class, your audio, video,
          and screen display may be preserved in the session recording.
        </li>
        <li>
          Recordings are retained for cohort access based on workspace settings and may be downloaded or
          deleted by authorized course instructors and organization administrators.
        </li>
      </ul>

      <h2>3. How we use your information</h2>
      <p>We process personal data under the following lawful bases:</p>
      <ul>
        <li>
          <strong>To Deliver the Service (Contractual Necessity)</strong>: Running real-time video,
          syncing shared chalkboards, running buzzer rounds, issuing verifiable certificates, and delivering
          transactional notifications (verification codes and class alerts).
        </li>
        <li>
          <strong>To Keep the Platform Secure (Legitimate Interests)</strong>: Preventing abuse, detecting
          unauthorized access, enforcing classroom moderation rules, and troubleshooting server-authoritative quiz timing.
        </li>
        <li>
          <strong>Legal Compliance</strong>: Fulfilling tax, corporate governance, and statutory reporting obligations.
        </li>
      </ul>

      <h2>4. Service Providers &amp; Subprocessors</h2>
      <p>
        We do <strong>not</strong> sell or rent your personal information to third parties. We share data
        exclusively with trusted service providers bound by strict data processing agreements:
      </p>
      <ul>
        <li>
          <strong>LiveKit</strong> — Delivers real-time WebRTC audio, video, and recording egress.
        </li>
        <li>
          <strong>Resend</strong> — Delivers transactional emails, account verifications, and password reset links.
        </li>
        <li>
          <strong>Cloudflare / Cloud Storage</strong> — Securely stores recorded class archives, course assets,
          and chalkboard attachments.
        </li>
        <li>
          <strong>Cloud Database Infrastructure</strong> — Encrypted cloud hosting and relational database storage.
        </li>
      </ul>

      <h2>5. Data Retention &amp; Security</h2>
      <p>
        We retain your personal information for as long as your account remains active or as needed to provide
        you and your instructors with course archives and verified certificates. When an account is terminated,
        personal identifiers are deleted or anonymized within 30 days, except where retention is required by law.
      </p>
      <p>
        All communications are encrypted in transit via TLS 1.3 / HTTPS and WebSockets. Sensitive session tokens
        are isolated within secure, <code>httpOnly</code> cookies.
      </p>

      <h2>6. Your Privacy Rights (NDPA 2023, GDPR, CCPA &amp; International)</h2>
      <p>
        Under the Nigeria Data Protection Act (NDPA 2023), the General Data Protection Regulation (GDPR / UK GDPR),
        the California Consumer Privacy Act (CCPA), and applicable international privacy frameworks, you have the right to:
      </p>
      <ul>
        <li>Request access to the personal data we hold about you.</li>
        <li>Request the correction of inaccurate or incomplete information.</li>
        <li>Request the deletion of your account and associated personal data (&quot;Right to be Forgotten&quot;).</li>
        <li>Request a portable, machine-readable export of your course and certificate history.</li>
        <li>Object to or restrict certain data processing activities, or withdraw previously granted consent.</li>
      </ul>
      <p>
        To exercise any of these rights, email <strong>privacy@livetich.com</strong>. We will respond within
        30 days without fee.
      </p>

      <h2>7. Children&apos;s Privacy (NDPA, COPPA &amp; Minor Protection)</h2>
      <p>
        livetich does not permit direct registration by children under the age of 13 (or under 18 in Nigeria without
        parental, guardian, or institutional supervision). Where minors participate in coursework through schools,
        academies, or educational institutions, the subscribing institution warrants that it has secured all necessary
        parental consent under applicable laws (including the Nigeria Data Protection Act, COPPA, and FERPA).
      </p>

      <h2>8. Policy Updates</h2>
      <p>
        We may update this Privacy Policy periodically. We will notify you of material changes by revising the
        &quot;Last updated&quot; date on this page or through an in-app notice. Continued use of the Service
        signifies your acknowledgement of the updated terms.
      </p>
    </LegalShell>
  );
}
