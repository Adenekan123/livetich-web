import { Face } from '@/components/landing-packs';
import { Broadcast, Check, Sparkle } from '@/components/landing-icons';

/*
 * HOW IT WORKS — "From empty room to full cohort." Three step cards, each with
 * a tinted panel holding a small snapshot of that step in the product, then a
 * centred title and line. The last card is tilted under a pen-stroke flourish.
 * Faces are cropped from the approved classroom image (see Face).
 */

export function LandingSteps() {
  return (
    <section id="how-it-works" className="scroll-mt-20 overflow-hidden border-b border-lp-border">
      <div className="mx-auto max-w-[1600px] px-5 py-20 sm:py-28">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="inline-block rounded-full border border-lp-lime/30 bg-lp-accent/10 px-4 py-1.5 text-sm font-semibold text-lp-lime">
              How it works
            </span>
            <h2 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] text-lp-text sm:text-5xl">
              From empty room{' '}
              <span
                aria-hidden
                className="mx-1 inline-grid h-[0.95em] w-[0.95em] -rotate-12 place-items-center rounded-[0.22em] bg-lp-accent align-[-0.12em] text-[#05130f]"
              >
                <Broadcast weight="bold" className="h-[0.6em] w-[0.6em]" />
              </span>{' '}
              <br className="hidden sm:inline" />
              to full cohort.
            </h2>
          </div>
          <p className="max-w-md text-lg leading-relaxed text-lp-text-2 lg:mt-14">
            Set up once, teach live, and let the room do the rest — from the first
            session to the last certificate.
          </p>
        </div>

        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          <Flourish />

          <StepCard title="Create your course" body="Set up sections, schedule a live session, and enroll your cohort in minutes.">
            <MiniHeader label="Weekly cohort · Thu 6 PM" />
            <p className="mt-3 text-[11px] text-[#6b7280]">Your instructor</p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <Face cx={140} cy={128} w={30} h={30} win={100} />
              <span className="text-[13px] font-medium text-[#111827]">You</span>
              <span className="ml-auto h-3 w-10 rounded-full bg-[#e8f5e2]" />
            </div>
            <div className="my-3 h-px bg-[#eef0ee]" />
            <p className="text-[11px] text-[#6b7280]">Your cohort</p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="flex -space-x-2">
                {(
                  [
                    [365, 130],
                    [585, 130],
                    [140, 283],
                  ] as const
                ).map(([cx, cy]) => (
                  <span key={cx + cy} className="rounded-full ring-2 ring-white">
                    <Face cx={cx} cy={cy} w={30} h={30} win={100} />
                  </span>
                ))}
              </span>
              <span className="text-[13px] font-medium text-[#111827]">Aisha, Tunde, Zainab</span>
            </div>
          </StepCard>

          <StepCard title="Go live and teach" body="Stream, draw on the board, run buzzer rounds, and pick raised hands — all in one room.">
            <MiniHeader label="Start today’s class" />
            <div className="mt-4 space-y-2">
              <span className="block h-3 w-4/5 rounded-full bg-[#e8f5e2]" />
              <span className="block h-3 w-full rounded-full bg-[#e8f5e2]" />
              <span className="block h-3 w-3/5 rounded-full bg-[#e8f5e2]" />
            </div>
            <div className="relative mt-5">
              <span className="flex items-center justify-center gap-2 rounded-xl bg-[#16a34a] py-3 text-[13px] font-semibold text-white">
                <span className="h-2 w-2 rounded-full bg-white" /> Go live
              </span>
              <svg aria-hidden viewBox="0 0 24 24" className="absolute -bottom-3 right-8 h-7 w-7 drop-shadow">
                <path d="M4 3l15 7.5-6.5 1.8L10 19z" fill="white" stroke="#111827" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
          </StepCard>

          <StepCard
            tilted
            title="Reward and certify"
            body="Points and the leaderboard keep students hooked; issue a verifiable certificate when they finish."
          >
            <MiniHeader label="Course completion" />
            <ul className="mt-2">
              {[true, true, false].map((done, i) => (
                <li key={i} className="flex items-center gap-3 border-b border-[#eef0ee] py-3 last:border-0">
                  {done ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#16a34a] text-white">
                      <Check weight="bold" className="h-3 w-3" />
                    </span>
                  ) : (
                    <span className="h-5 w-5 rounded-full border-2 border-[#d1d5db]" />
                  )}
                  <span className={`h-3 rounded-full bg-[#e8f5e2] ${['w-3/5', 'w-2/5', 'w-3/4'][i]}`} />
                </li>
              ))}
            </ul>
          </StepCard>
        </div>
      </div>
    </section>
  );
}

function StepCard({
  title,
  body,
  tilted = false,
  children,
}: {
  title: string;
  body: string;
  tilted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`relative z-[1] rounded-[32px] border border-lp-border bg-white p-3 shadow-[0_2px_4px_rgba(15,46,42,0.04),0_20px_40px_-24px_rgba(15,46,42,0.18)] ${
        tilted ? 'md:rotate-[3deg]' : ''
      }`}
    >
      <div aria-hidden className="flex min-h-[272px] items-center rounded-[24px] bg-[#eaf6e4] px-6 py-8 sm:px-9">
        <div className="w-full rounded-2xl bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,46,42,0.2)]">{children}</div>
      </div>
      <div className="px-6 pb-8 pt-7 text-center">
        <h3 className="text-xl font-bold tracking-tight text-[#111827]">{title}</h3>
        <p className="mx-auto mt-3 max-w-[300px] leading-relaxed text-[#6b7280]">{body}</p>
      </div>
    </article>
  );
}

function MiniHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#eef0ee] pb-3">
      <Sparkle weight="fill" className="h-4 w-4 text-[#16a34a]" />
      <span className="text-[14px] font-medium text-[#111827]">{label}</span>
      <span className="ml-auto h-5 w-5 rounded-md bg-[#f1f5f1]" />
    </div>
  );
}

/** The pen-stroke flourish over the last card: a thick loop with a soft
 *  offset shadow, a bezier handle, and two sparkles. Desktop only. */
function Flourish() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 300 110"
      className="pointer-events-none absolute -top-[84px] right-[6%] z-0 hidden h-[110px] w-[300px] md:block"
      fill="none"
    >
      <path d="M40 106C44 40 70 12 84 60c10 34 22 44 34 4 14-46 44-60 76-36" stroke="#bbf7d0" strokeWidth="14" strokeLinecap="round" transform="translate(-5 3)" />
      <path d="M40 106C44 40 70 12 84 60c10 34 22 44 34 4 14-46 44-60 76-36" stroke="#16a34a" strokeWidth="14" strokeLinecap="round" />
      <path d="M160 18l34 10 36 20" stroke="#a7c4b0" strokeWidth="1.5" />
      <circle cx="160" cy="18" r="4" fill="white" stroke="#a7c4b0" strokeWidth="1.5" />
      <circle cx="194" cy="28" r="6" fill="white" stroke="#16a34a" strokeWidth="3" />
      <circle cx="230" cy="48" r="4" fill="white" stroke="#a7c4b0" strokeWidth="1.5" />
      <path d="M150 50l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#a7c4b0" />
      <path d="M240 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#a7c4b0" />
    </svg>
  );
}
