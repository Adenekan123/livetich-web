import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Rubik } from 'next/font/google';
import { PacksCarousel } from '@/components/packs-carousel';
import {
  CaretRight,
  ChartBar,
  Check,
  Cursor,
  FileText,
  Microphone,
  PencilSimple,
  Play,
  SkipForward,
  Square,
  TextT,
} from '@/components/landing-icons';

/*
 * TEACHING PACKS — "Plugins for different teaching needs." A full-bleed row of
 * tall cards, each filled by an HTML snapshot of what that pack adds to the
 * room. The packs mirror the plugin catalog (livetich-api src/plugins/
 * catalog.ts): islamic-education, code-instruction, test-prep, maths-sciences.
 *
 * Truth rules for the snapshots: nothing a pack can't do. The code pack has no
 * test runner (coding-ai-review.service.ts: "never claims a test ran"), so its
 * card shows the live editor and a review of submitted work, not "tests
 * passed". Tajweed colours on Al-Ikhlāṣ mark real rules. The figures (70%, 78%,
 * 12 quizzes…) are sample values in a picture of the UI, not claims.
 */

const rubik = Rubik({ subsets: ['latin'] });

// Student faces are cropped (by CSS, at display time) from the approved
// classroom image — the file itself is never altered. Tiles in the 941×608
// file: columns x 27–250 / 257–470 / 478–690, rows y 75–218 / 225–370 /
// 377–525, name label in each tile's bottom ~30px. (cx, cy) is a face centre
// and `win` the crop width in image px, chosen to stay clear of the label.
const CLASS_IMG = '/livetich-exact-live-session-crop.png';

export function Face({ cx, cy, w, h, win }: { cx: number; cy: number; w: number; h: number; win: number }) {
  const s = w / win;
  return (
    <span
      aria-hidden
      className="block shrink-0 overflow-hidden rounded-xl bg-[#1a1f1d] bg-no-repeat"
      style={{
        width: w,
        height: h,
        backgroundImage: `url(${CLASS_IMG})`,
        backgroundSize: `${941 * s}px auto`,
        backgroundPosition: `${-(cx * s - w / 2)}px ${-(cy * s - h / 2)}px`,
      }}
    />
  );
}

// Rendered once, on the server, into static HTML.
const QUADRATIC = katex.renderToString('x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', {
  displayMode: true,
  throwOnError: false,
  output: 'html',
});

export function LandingPacks() {
  return (
    <section
      id="packs"
      className="relative scroll-mt-20 overflow-hidden border-b border-lp-border py-20 sm:py-24"
    >
      {/* soft green washes in the corners, as in the design */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_35%_at_0%_30%,rgba(34,197,94,0.07),transparent),radial-gradient(40%_35%_at_100%_85%,rgba(34,197,94,0.07),transparent)]"
      />

      <div className="relative mx-auto max-w-[1600px] px-5 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#16a34a]">Teaching packs</p>
        <h2
          className={`${rubik.className} mx-auto mt-4 text-balance text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-lp-text sm:text-[44px] lg:text-[54px]`}
        >
          Plugins for different teaching needs.
        </h2>
        <p className="mx-auto mt-4 max-w-[860px] text-lg leading-relaxed text-lp-text-2 sm:text-xl">
          Turn on the packs that fit your teaching style — each one extends the same
          Livetich classroom with tools made for your subject.
        </p>
      </div>

      <div className={`${rubik.className} relative mt-12 sm:mt-14`}>
        <PacksCarousel label="Teaching packs" trackClassName="scroll-px-5 px-5 lg:scroll-px-10 lg:px-10">
          <PackCard
            name="Islamic Education"
            blurb="Qur’an study, tajweed tools and hifz progress."
            ground="bg-[linear-gradient(180deg,#f1faef_0%,#e3f3dd_100%)]"
            deco={<Leaf className="-right-6 top-40 text-[#bfe6b3]" />}
          >
            <IslamicPreview />
          </PackCard>
          <PackCard
            name="Code Instruction"
            blurb="A live coding classroom the whole class follows."
            dark
            ground="bg-[linear-gradient(160deg,#15402f_0%,#0c2a1f_60%,#0a2219_100%)]"
            deco={
              <>
                <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/[0.04]" />
                <span aria-hidden className="absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-white/[0.03]" />
              </>
            }
          >
            <CodePreview />
          </PackCard>
          <PackCard
            name="Test Prep"
            blurb="Timed mock exams, auto-scoring and per-topic insights."
            ground="bg-[linear-gradient(180deg,#f1f6ff_0%,#e2ecfd_100%)]"
            deco={<span aria-hidden className="absolute -right-4 top-24 h-16 w-8 rotate-[35deg] rounded-full bg-[#bcd3fb]" />}
          >
            <TestPrepPreview />
          </PackCard>
          <PackCard
            name="Maths & Sciences"
            blurb="Typeset equations, diagrams and problem solving."
            ground="bg-[linear-gradient(180deg,#e9f2eb_0%,#d7e8db_100%)]"
            deco={<Leaf className="-left-8 top-24 text-[#c3dcc8]" />}
          >
            <MathsPreview />
          </PackCard>
        </PacksCarousel>
      </div>
    </section>
  );
}

/* ------------------------------ card shell ------------------------------ */

function PackCard({
  name,
  blurb,
  dark = false,
  ground,
  deco,
  children,
}: {
  name: string;
  blurb: string;
  dark?: boolean;
  ground: string;
  deco?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`relative flex h-[560px] w-[86vw] max-w-[360px] shrink-0 snap-start flex-col overflow-hidden rounded-[28px] sm:h-[590px] sm:w-[360px] xl:w-[380px] 2xl:w-[420px] 2xl:max-w-none ${ground} ${
        dark ? 'text-white' : 'text-[#0a0a0a] ring-1 ring-black/[0.04]'
      }`}
    >
      {deco}
      <div className="relative px-7 pt-7">
        <h3 className="text-[27px] font-semibold tracking-[-0.02em]">{name}</h3>
        <p className={`mt-2 max-w-[290px] text-[16.5px] leading-snug ${dark ? 'text-white/75' : 'text-[#4b5563]'}`}>
          {blurb}
        </p>
      </div>
      <div aria-hidden className="relative mt-6 flex-1">
        {children}
      </div>
    </article>
  );
}

function Leaf({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 60 90" className={`absolute h-24 w-16 ${className}`} fill="currentColor">
      <path d="M30 2C8 24 4 60 30 88 56 60 52 24 30 2Z" />
    </svg>
  );
}

/* ------------------------------ previews ------------------------------ */

/** An end-of-verse marker (a ringed Arabic numeral) — the font has no ۝ glyph. */
function V({ n }: { n: string }) {
  return (
    <span className="mx-1 inline-grid h-6 w-6 place-items-center rounded-full border border-[#c9a55a] align-middle text-[11px] leading-none text-[#9a7b3c]">
      {n}
    </span>
  );
}

function IslamicPreview() {
  const q = 'text-[#16a34a]'; // qalqalah
  const i = 'text-[#ea7a1a]'; // idghām
  return (
    <>
      {/* mushaf page + tajweed panel, bleeding off the left edge */}
      <div className="absolute -left-10 bottom-16 right-5 top-0 flex overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)]">
        <div className="flex-1 border-r border-[#efe7d2] bg-[#fbf6e9] px-5 py-4">
          <div className="rounded-lg border border-[#e7d9b5] px-3 py-2 text-center text-[11px] font-semibold text-[#9a7b3c]">
            سُورَةُ الإِخْلَاص
          </div>
          <p dir="rtl" lang="ar" className="mt-2 text-right text-[21px] leading-[2.3] text-[#2b2b2b]">
            قُلْ هُوَ اللَّهُ <span className={q}>أَحَدٌ</span> <V n="١" /> اللَّهُ <span className={q}>الصَّمَدُ</span> <V n="٢" />{' '}
            لَمْ <span className={q}>يَلِدْ</span> وَلَمْ <span className={q}>يُولَدْ</span> <V n="٣" /> وَلَمْ{' '}
            <span className={i}>يَكُن لَّهُ</span> كُفُوًا <span className={q}>أَحَدٌ</span> <V n="٤" />
          </p>
        </div>
        <div className="w-[122px] shrink-0 p-3">
          <div className="flex items-center justify-between rounded-lg border border-[#e5e7eb] px-2 py-1.5 text-[11px] font-medium text-[#374151]">
            Al-Ikhlāṣ <CaretRight className="h-3 w-3" />
          </div>
          <p className="mt-3 text-[11px] font-semibold text-[#111827]">Tajweed</p>
          <ul className="mt-2 space-y-1.5 text-[11px] text-[#4b5563]">
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#16a34a]" />Qalqalah</li>
            <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ea7a1a]" />Idghām</li>
          </ul>
          <div className="mt-4 flex items-center gap-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#16a34a] text-white"><Play weight="fill" className="h-3.5 w-3.5" /></span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f3f4f6] text-[#4b5563]"><SkipForward className="h-3.5 w-3.5" /></span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f3f4f6] text-[#4b5563]"><Microphone className="h-3.5 w-3.5" /></span>
          </div>
        </div>
      </div>

      {/* hifz progress, overlapping the page */}
      <div className="absolute bottom-6 left-6 right-10 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[0_14px_34px_-14px_rgba(0,0,0,0.3)]">
        <div
          className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full"
          style={{ background: 'conic-gradient(#16a34a 70%, #e5efe7 0)' }}
        >
          <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-white text-[15px] font-bold text-[#111827]">70%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#111827]">Hifz progress</p>
          <p className="mt-0.5 text-[12px] text-[#6b7280]">Surah Al-Mulk · 21 / 30 verses</p>
          <div className="mt-2 h-1.5 rounded-full bg-[#e5efe7]">
            <div className="h-full w-[70%] rounded-full bg-[#16a34a]" />
          </div>
        </div>
      </div>
    </>
  );
}

function CodePreview() {
  const kw = 'text-[#c792ea]';
  const fn = 'text-[#82aaff]';
  const str = 'text-[#c3e88d]';
  const cm = 'text-white/35';
  const n = 'mr-3 inline-block w-3 text-right text-white/25';
  return (
    <div className="absolute inset-x-5 top-0 flex gap-2.5">
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#081b13] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-2.5 py-2 text-[11px]">
            <span className="rounded-md bg-white/10 px-2 py-1 text-white">main.py</span>
            <span className="rounded-md px-2 py-1 text-white/45">student.py</span>
            <span className="ml-auto flex items-center gap-1 rounded-md bg-[#16a34a] px-2 py-1 font-semibold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live
            </span>
          </div>
          <pre className="overflow-hidden px-3 py-3 font-mono text-[11.5px] leading-[22px] text-white/85">
            <span className={n}>1</span><span className={kw}>def</span> <span className={fn}>greet</span>(name):{'\n'}
            <span className={n}>2</span>{'    '}<span className={kw}>return</span> <span className={str}>f&quot;Hello, {'{'}name{'}'}!&quot;</span>{'\n'}
            <span className={n}>3</span>{'\n'}
            <span className={n}>4</span><span className={cm}># Class follows along live</span>{'\n'}
            <span className={n}>5</span><span className={fn}>print</span>(greet(<span className={str}>&quot;Livetich&quot;</span>))
          </pre>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white text-[#111827] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)]">
          <div className="flex border-b border-[#eef0f2] text-[11px]">
            <span className="border-b-2 border-[#16a34a] px-3 py-2 font-semibold">Review</span>
            <span className="px-3 py-2 text-[#6b7280]">Files</span>
          </div>
          <div className="p-3">
            <p className="flex items-center gap-1.5 rounded-lg bg-[#f0faf2] px-2.5 py-2 text-[11px] font-semibold text-[#15803d]">
              <Check weight="bold" className="h-3.5 w-3.5" /> Submission received
            </p>
            <ul className="mt-2.5 space-y-2 text-[11px] text-[#374151]">
              <li className="flex items-center gap-2"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#16a34a] text-white"><Check weight="bold" className="h-2.5 w-2.5" /></span>Clear function name</li>
              <li className="flex items-center gap-2"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#16a34a] text-white"><Check weight="bold" className="h-2.5 w-2.5" /></span>Uses the name argument</li>
              <li className="flex items-center gap-2"><span className="h-4 w-4 rounded-full border-2 border-[#f59e0b]" />Consider an empty name</li>
            </ul>
            <p className="mt-2.5 text-[10px] text-[#9ca3af]">AI review · the instructor decides</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Face cx={585} cy={130} w={92} h={96} win={100} />
        <Face cx={365} cy={282} w={92} h={96} win={100} />
        <Face cx={365} cy={432} w={92} h={96} win={100} />
      </div>
    </div>
  );
}

function TestPrepPreview() {
  const options: [string, string][] = [
    ['A', 'Wordy'],
    ['B', 'Brief'],
    ['C', 'Angry'],
    ['D', 'Unclear'],
  ];
  return (
    <div className="absolute inset-x-5 top-0 space-y-2.5">
      <div className="rounded-2xl bg-white p-4 text-[#111827] shadow-[0_10px_30px_-14px_rgba(30,64,175,0.35)]">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#eff4ff] text-[#2563eb]"><FileText className="h-4 w-4" /></span>
          <span className="text-[13px] font-semibold">Practice quiz</span>
          <span className="ml-auto text-[11px] text-[#6b7280]">Question 3 of 10</span>
        </div>
        <p className="mt-3 text-[13px] leading-snug">Which word is nearest in meaning to <em>laconic</em>?</p>
        <ul className="mt-2.5 space-y-1.5 text-[12px]">
          {options.map(([k, v]) => {
            const right = k === 'B';
            return (
              <li
                key={k}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 ${
                  right ? 'border-[#16a34a] bg-[#f0faf2] font-semibold text-[#14532d]' : 'border-[#e5e7eb] text-[#374151]'
                }`}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${right ? 'bg-[#16a34a] text-white' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>{k}</span>
                {v}
              </li>
            );
          })}
        </ul>
        <span className="mt-2.5 block rounded-xl bg-[#15803d] py-2 text-center text-[12px] font-semibold text-white">Submit answer</span>
      </div>

      <div className="rounded-2xl bg-white p-4 text-[#111827] shadow-[0_10px_30px_-14px_rgba(30,64,175,0.35)]">
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          <ChartBar weight="fill" className="h-4 w-4 text-[#16a34a]" /> Your progress
          <span className="ml-auto text-[#15803d]">78%</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#e5e7eb]"><div className="h-full w-[78%] rounded-full bg-[#16a34a]" /></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ['12', 'Quizzes'],
            ['85%', 'Avg. score'],
            ['3', 'Topics to review'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-lg bg-[#f6f8fb] px-1 py-2">
              <p className="text-[13px] font-bold">{v}</p>
              <p className="text-[9.5px] leading-tight text-[#6b7280]">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MathsPreview() {
  return (
    <div className="absolute -right-8 left-5 top-0 space-y-3">
      <div className="rounded-2xl bg-[#0f1a16] p-3 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="rounded-md bg-white px-2 py-1 font-semibold text-[#0f1a16]">Chalkboard</span>
          <span className="rounded-md bg-white/10 px-2 py-1 text-white/70">Formula palette</span>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-1 pt-2">
          <div className="text-[15px] text-white [&_.katex-display]:my-1" dangerouslySetInnerHTML={{ __html: QUADRATIC }} />
          {/* chalk sketch: y = x² − 4, roots at ±2 */}
          <svg viewBox="0 0 110 100" className="h-[110px] w-[120px]" fill="none">
            <path d="M8 70h94M55 8v88" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
            <path d="M20 12Q55 128 90 12" stroke="#facc15" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="37" cy="70" r="3" fill="#4ade80" />
            <circle cx="73" cy="70" r="3" fill="#4ade80" />
            <text x="60" y="18" fill="#e5e7eb" fontSize="9" fontFamily="serif" fontStyle="italic">y = x² − 4</text>
            <text x="26" y="84" fill="#86efac" fontSize="8">−2</text>
            <text x="70" y="84" fill="#86efac" fontSize="8">2</text>
          </svg>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/[0.06] px-2 py-1.5">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-white text-[#0f1a16]"><Cursor weight="fill" className="h-3.5 w-3.5" /></span>
          <PencilSimple className="h-4 w-4 text-white/70" />
          <Square className="h-4 w-4 text-white/70" />
          <TextT className="h-4 w-4 text-white/70" />
          <span className="ml-auto flex gap-1.5">
            {['#fb923c', '#22c55e', '#22d3ee', '#a78bfa'].map((c) => (
              <span key={c} className="h-3.5 w-3.5 rounded-full" style={{ background: c }} />
            ))}
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        <Face cx={140} cy={283} w={150} h={96} win={160} />
        <Face cx={585} cy={440} w={150} h={96} win={160} />
      </div>
    </div>
  );
}
