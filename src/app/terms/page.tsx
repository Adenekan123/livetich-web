import Link from 'next/link';
import { LegalShell } from '../legal/legal-shell';

export const metadata = { title: 'Terms of Service — livetich' };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 3, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of <strong>livetich</strong>{' '}
        (the &quot;Service&quot;), operated by livetich (&quot;we&quot;, &quot;us&quot;). By creating an
        account, joining a class, or browsing our platform, you agree to be bound by these Terms.
        For support questions, reach out to <strong>support@livetich.com</strong>.
      </p>

      <h2>1. The Service</h2>
      <p>
        livetich provides an interactive live-learning environment enabling instructors and educational
        organizations to teach cohorts using real-time video, interactive chalkboards, buzzer quizzes,
        automated grading, and verifiable completion certificates.
      </p>

      <h2>2. Accounts &amp; Eligibility</h2>
      <ul>
        <li>You must be at least 13 years old (or 16 in the European Union) to create an independent account.</li>
        <li>You must provide accurate, current information during registration and keep your credentials secure.</li>
        <li>
          You are responsible for all activities conducted through your account. If you discover unauthorized
          access, notify us immediately.
        </li>
        <li>
          Organization administrators are responsible for managing member permissions and oversight of live sessions.
        </li>
      </ul>

      <h2>3. Classroom Conduct &amp; Recording</h2>
      <p>
        When participating in live classes on livetich:
      </p>
      <ul>
        <li>
          <strong>Audio &amp; Video Recordings:</strong> Sessions may be recorded by instructors for student
          review. You will hear an audible notification tone when a recording begins or ends. If you enable
          your microphone, camera, or screen share, you consent to your contribution being captured in that
          class recording.
        </li>
        <li>
          <strong>Screen-Share Privacy:</strong> When sharing your screen, you are solely responsible for
          closing confidential personal tabs, messaging applications, and notifications.
        </li>
        <li>
          <strong>Zero Tolerance for Abuse:</strong> You may not harass, disrupt, deceive, or post hateful,
          explicit, or illegal material in classroom chats, live video, or shared chalkboards. Instructors
          reserve the right to mute, lock, or evict participants from live rooms.
        </li>
      </ul>

      <h2>4. User Content &amp; Intellectual Property</h2>
      <p>
        You retain all ownership rights to the content you create, upload, or present on livetich (including
        lesson curricula, assignments, whiteboard drawings, and chat messages).
      </p>
      <p>
        By uploading or presenting content, you grant livetich a worldwide, non-exclusive, royalty-free license
        strictly necessary to host, transmit, transcode, and display that content to authorized cohort members
        to operate the Service.
      </p>

      <h2>5. Copyright &amp; DMCA Safe Harbor</h2>
      <p>
        We respect intellectual property rights and comply with the Digital Millennium Copyright Act.
        You may not broadcast or upload material you do not own or have written permission to distribute.
        To report copyright infringement or file a takedown notice, please review our{' '}
        <Link href="/dmca" className="font-semibold text-signal-700 underline dark:text-signal-400">
          DMCA &amp; Copyright Policy
        </Link>.
      </p>

      <h2>6. Course Certificates &amp; Non-Accreditation Disclaimer</h2>
      <p>
        Certificates of completion issued through livetich confirm that a student met the completion criteria
        set by an independent instructor or organization.
      </p>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-800">
        <strong>Accreditation Notice:</strong> Unless explicitly verified and offered by an accredited degree-granting
        institution, certificates issued through livetich represent independent skill completion and do not
        confer accredited academic university degrees, college credits, or government-recognized vocational licenses.
      </div>

      <h2>7. Test Preparation &amp; Examination Trademarks</h2>
      <p>
        Where courses or add-ons provide test preparation or past practice questions (including JAMB, WAEC,
        NECO, or Post-UTME syllabus materials):
      </p>
      <ul>
        <li>
          JAMB, WAEC, NECO, and other examination names are registered trademarks of their respective testing authorities.
        </li>
        <li>
          livetich is an independent learning platform. We are not affiliated with, endorsed by, or sponsored by
          any official examination board.
        </li>
        <li>
          Practice tests and cohort lessons are supplementary study aids and do not guarantee specific exam scores
          or tertiary institution admissions.
        </li>
      </ul>

      <h2>8. Disclaimers &amp; Limitation of Liability</h2>
      <p>
        The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of
        any kind, whether express or implied.
      </p>
      <p>
        To the fullest extent permitted by applicable law, livetich and its operators shall not be liable for
        any indirect, incidental, punitive, or consequential damages, or any loss of profits, data, or goodwill
        resulting from:
      </p>
      <ul>
        <li>Your use or inability to use the Service;</li>
        <li>Any interruption or cessation of transmission to or from the Service;</li>
        <li>Content posted, uploaded, or spoken by third parties in live classrooms.</li>
      </ul>

      <h2>9. Termination</h2>
      <p>
        You may delete your account at any time. We reserve the right to suspend or terminate accounts that
        violate these Terms, infringe intellectual property, or engage in disruptive conduct.
      </p>

      <h2>10. Modifications to Terms</h2>
      <p>
        We may modify these Terms at any time. Material updates will be posted here with a refreshed
        &quot;Last updated&quot; timestamp. Continued use of livetich following updates constitutes agreement.
      </p>
    </LegalShell>
  );
}
