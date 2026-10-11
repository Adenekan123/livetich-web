import { LegalShell } from '../legal/legal-shell';

export const metadata = { title: 'Cookie Policy — livetich' };

export default function CookiesPage() {
  return (
    <LegalShell title="Cookie Policy" updated="August 3, 2026">
      <p>
        This Cookie Policy explains how <strong>livetich</strong> (&quot;we&quot;, &quot;us&quot;)
        uses cookies and similar browser storage technologies when you access our live-teaching
        platform and services. Questions regarding our cookie practices can be sent to{' '}
        <strong>privacy@livetich.com</strong>.
      </p>

      <h2>What are cookies?</h2>
      <p>
        Cookies are small text files placed on your device by websites you visit. They are widely
        used to make web applications function, ensure security, remember your session, and provide
        usage information to service operators.
      </p>

      <h2>Cookies we use</h2>
      <p>
        We divide cookies and local storage tokens into two categories: <strong>Strictly Necessary</strong> and{' '}
        <strong>Analytics &amp; Performance</strong>.
      </p>

      <h2>1. Strictly Necessary Cookies</h2>
      <p>
        These cookies are essential for you to navigate the site, sign in, and participate in live
        classrooms. Without them, the Service cannot function securely. Under data protection regulations,
        these cookies do not require prior consent, but we disclose them here in full transparency:
      </p>

      <ul>
        <li>
          <strong>lt_token</strong> — An <code>httpOnly</code> secure cookie holding your authenticated
          session JWT. It authenticates your requests to the application API and connects you to live classes.
          Duration: up to 7 days.
        </li>
        <li>
          <strong>lt_admin_token</strong> &amp; <strong>lt_admin_step</strong> — Used by authorized organization
          administrators to perform verified support actions and high-privilege configurations.
          Duration: 15 minutes to 7 days.
        </li>
        <li>
          <strong>livetich_recorder</strong> — A scoped single-session credential used solely by the automated
          recording worker to capture designated live lessons for student review.
          Duration: duration of the live class.
        </li>
        <li>
          <strong>lt_cookie_consent</strong> — Remembers whether you consented to optional analytics or chose
          essential cookies only.
          Duration: 1 year.
        </li>
      </ul>

      <h2>2. Optional Analytics &amp; Performance Technologies</h2>
      <p>
        With your affirmative consent, we may collect aggregated, anonymized diagnostics — such as
        WebRTC connection latency, packet health, and interactive quiz responsiveness — to monitor
        streaming reliability and prevent classroom disconnects.
      </p>
      <p>
        We do <strong>not</strong> sell your data or use third-party behavioral advertising tracking cookies.
      </p>

      <h2>How to manage cookie preferences</h2>
      <p>
        You can update your preferences at any time using our on-screen Cookie Preferences banner.
        In addition, most modern web browsers allow you to manage or delete cookies via your browser settings
        (e.g., Chrome, Safari, Firefox, Edge). Please note that blocking strictly necessary cookies will
        prevent you from logging into your livetich account or entering live sessions.
      </p>
    </LegalShell>
  );
}
