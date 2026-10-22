import { LegalShell } from '../legal/legal-shell';

export const metadata = { title: 'DMCA & Copyright Policy — livetich' };

export default function DmcaPage() {
  return (
    <LegalShell title="DMCA & Copyright Policy" updated="August 3, 2026">
      <p>
        <strong>livetich</strong> respects the intellectual property rights of creators and educators.
        In accordance with the Digital Millennium Copyright Act of 1998 (&quot;DMCA&quot;, 17 U.S.C. § 512)
        and applicable international copyright laws, we will respond expeditiously to notices of alleged
        copyright infringement.
      </p>

      <h2>Designated Copyright Agent</h2>
      <p>
        Notifications of claimed copyright infringement should be sent to our designated agent:
      </p>
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm leading-relaxed text-neutral-800">
        <div><strong>Attention:</strong> Copyright Agent / Legal Department</div>
        <div><strong>Service:</strong> livetich</div>
        <div><strong>Email:</strong> dmca@livetich.com</div>
        <div><strong>Subject line:</strong> DMCA Notice of Copyright Infringement</div>
      </div>

      <h2>Filing a DMCA Takedown Notice</h2>
      <p>
        If you are a copyright owner or authorized representative, please provide a written communication
        containing the following statutory details:
      </p>
      <ul>
        <li>
          A physical or electronic signature of a person authorized to act on behalf of the owner of an
          exclusive right that is allegedly infringed.
        </li>
        <li>
          Identification of the copyrighted work claimed to have been infringed (or a representative list if
          multiple works are covered by a single notification).
        </li>
        <li>
          Identification of the material claimed to be infringing or subject to infringing activity, including
          the specific URL, course link, or session details on livetich so we can locate it.
        </li>
        <li>
          Information reasonably sufficient to permit us to contact you (full name, address, telephone number,
          and email address).
        </li>
        <li>
          A statement that you have a good faith belief that use of the material in the manner complained of
          is not authorized by the copyright owner, its agent, or the law.
        </li>
        <li>
          A statement that the information in the notification is accurate, and under penalty of perjury,
          that you are authorized to act on behalf of the owner of the exclusive right that is allegedly infringed.
        </li>
      </ul>

      <h2>Counter-Notification Procedure</h2>
      <p>
        If you believe your content (such as class slides, assignments, or recordings) was removed or disabled
        by mistake or misidentification, you may submit a written counter-notification to{' '}
        <strong>dmca@livetich.com</strong> containing:
      </p>
      <ul>
        <li>Your physical or electronic signature.</li>
        <li>Identification of the material that was removed or disabled and where it appeared before removal.</li>
        <li>
          A statement under penalty of perjury that you have a good faith belief the material was removed or
          disabled as a result of mistake or misidentification.
        </li>
        <li>
          Your name, address, phone number, and a statement consenting to the jurisdiction of the federal
          district court for your judicial district (or our principal place of business if outside the US).
        </li>
      </ul>

      <h2>Repeat Infringer Policy</h2>
      <p>
        In accordance with the DMCA and other applicable laws, livetich maintains an affirmative policy of
        terminating, in appropriate circumstances and at our sole discretion, accounts of users or instructors
        who are deemed to be repeat copyright infringers.
      </p>
    </LegalShell>
  );
}
