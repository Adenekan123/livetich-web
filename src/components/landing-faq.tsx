import {
  Buildings,
  CalendarBlank,
  Laptop,
  ShieldCheck,
  Stack,
  UsersThree,
} from '@/components/landing-icons';

/*
 * FAQ — "Answered." The intro sits over an illustration (a question card, a
 * card of ticked answers, a student, a chat bubble, joined by dashed paths),
 * drawn in HTML/SVG so it follows the theme. Each question gets an icon tile.
 */

const FAQ = [
  {
    icon: Laptop,
    q: 'Do students need to install anything?',
    a: 'No. livetich runs in the browser — students click one link and join the live room, video and board included.',
  },
  {
    icon: UsersThree,
    q: 'How big can a cohort be?',
    a: 'It is built for whole cohorts in one room, not one-on-one calls. Everyone sees the same live session at once.',
  },
  {
    icon: CalendarBlank,
    q: 'How does scheduling work?',
    a: 'Set a weekly cadence once. Sessions open automatically on the day — no manual go-live, everyone just joins.',
  },
  {
    icon: Stack,
    q: 'What are add-on packs?',
    a: 'Beyond the core live classroom, packs add tools for what you teach: Qur’an & Hifz, live coding, or timed exams. Turn on only what you need.',
  },
  {
    icon: ShieldCheck,
    q: 'Are the certificates verifiable?',
    a: 'Every certificate carries a QR code and a code anyone can scan or enter to confirm it is genuine.',
  },
  {
    icon: Buildings,
    q: 'Is it built for organizations?',
    a: 'Yes — livetich is multi-tenant. Invite your instructors and staff into your own branded organization and manage every program in one place.',
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className="scroll-mt-20 border-b border-lp-border">
      <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <span className="inline-flex items-center gap-2.5 rounded-full bg-lp-accent/15 px-4 py-1.5 text-sm font-semibold text-lp-lime">
              <span aria-hidden className="h-2 w-2 rounded-full bg-[#16a34a]" />
              Good questions
            </span>
            <h2 className="mt-5 font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] text-lp-text sm:text-5xl">
              Answered.
            </h2>
            <p className="mt-5 max-w-sm text-lg leading-relaxed text-lp-text-2">
              Everything worth knowing before your first live class.
            </p>
            <FaqIllustration />
          </div>

          <dl className="divide-y divide-lp-border border-y border-lp-border">
            {FAQ.map(({ icon: Icon, q, a }) => (
              <div key={q} className="flex gap-5 py-6 sm:gap-7">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lp-accent/15 text-[#15803d]">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <dt className="text-lg font-bold tracking-tight text-lp-text">{q}</dt>
                  <dd className="mt-1.5 leading-relaxed text-lp-text-2">{a}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* A question gets answered: the "?" card up front, the ticked answer card
   behind it, a student and a chat bubble linked by dashed paths. Pure vector:
   no SVG filters (a filtered group is rasterised, which blurs at 1x or under
   browser zoom) — shadows are plain offset shapes. */
function FaqIllustration() {
  const green = '#16a34a';
  const deep = '#1f7a3a';
  const bar = '#d5e0d8';
  const edge = '#d9e4dc';
  const shade = 'rgba(15,46,42,0.07)';
  return (
    <svg
      aria-hidden
      viewBox="0 0 560 450"
      className="mt-10 hidden h-auto w-full max-w-[560px] sm:block"
      fill="none"
      shapeRendering="geometricPrecision"
    >
      {/* soft ground shapes — solid, crisp-edged */}
      <ellipse cx="220" cy="250" rx="200" ry="150" fill="#eef8ea" />
      <ellipse cx="420" cy="175" rx="120" ry="130" fill="#f3faf0" />

      {/* dashed connecting paths */}
      <g stroke={green} strokeOpacity="0.6" strokeWidth="2.5" strokeDasharray="6 8" strokeLinecap="round">
        <path d="M250 120C290 40 380 40 430 88" />
        <path d="M112 318C98 284 108 250 128 226" />
        <path d="M150 372C220 382 270 358 302 322" />
      </g>

      {/* spark marks */}
      <path d="M62 80l16 14M94 60l3 21M50 112l20 4" stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" />

      {/* answer card, behind */}
      <g transform="translate(14 44) rotate(4 390 250)">
        <rect x="266" y="152" width="256" height="216" rx="22" fill={shade} />
        <rect x="262" y="140" width="256" height="216" rx="22" fill="white" stroke={edge} strokeWidth="1.5" />
        <rect x="290" y="176" width="170" height="12" rx="6" fill={bar} />
        {[0, 1].map((i) => (
          <g key={i} transform={`translate(0 ${i * 58})`}>
            <circle cx="306" cy="236" r="14" fill={green} />
            <path d="M299 236l5 5 9-10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="332" y="226" width="150" height="10" rx="5" fill={bar} />
            <rect x="332" y="243" width="100" height="10" rx="5" fill={bar} />
          </g>
        ))}
      </g>

      {/* question card, in front */}
      <g transform="rotate(4 260 150)">
        <rect x="96" y="98" width="340" height="164" rx="22" fill={shade} />
        <rect x="92" y="86" width="340" height="164" rx="22" fill="white" stroke={edge} strokeWidth="1.5" />
        {/* "?" speech bubble */}
        <circle cx="168" cy="164" r="38" fill={deep} />
        <path d="M144 190l-6 18 22-10z" fill={deep} />
        <text x="168" y="178" textAnchor="middle" fontSize="40" fontWeight="700" fill="white" fontFamily="ui-sans-serif, system-ui, sans-serif">
          ?
        </text>
        <rect x="228" y="136" width="176" height="16" rx="8" fill={bar} />
        <rect x="228" y="162" width="148" height="11" rx="5.5" fill={bar} />
        <rect x="228" y="182" width="108" height="11" rx="5.5" fill={bar} />
      </g>

      {/* chat bubble */}
      <g transform="rotate(-6 470 60)">
        <rect x="431" y="39" width="84" height="54" rx="16" fill={shade} />
        <rect x="428" y="32" width="84" height="54" rx="16" fill="white" stroke={edge} strokeWidth="1.5" />
        <path d="M446 84l-4 16 16-12z" fill="white" />
        {[450, 470, 490].map((cx) => (
          <circle key={cx} cx={cx} cy="59" r="5" fill={deep} />
        ))}
      </g>

      {/* student */}
      <circle cx="114" cy="370" r="44" fill={shade} />
      <circle cx="112" cy="362" r="44" fill="#dcf3d3" />
      <g stroke="#15803d" strokeWidth="3.5" strokeLinecap="round" fill="none">
        <circle cx="112" cy="350" r="11" />
        <path d="M91 382c3-12 12-18 21-18s18 6 21 18" />
      </g>
    </svg>
  );
}
