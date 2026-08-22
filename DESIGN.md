# Design

<!-- Durable visual decisions for livetich-web. Product truth lives in PRODUCT.md. -->

## Thesis

**Warm, accessible, live.** livetich is one live room where a whole cohort
connects to a single instructor and competes in real time. The system is
**flat and accessible first** (WCAG AA), carried by one warm, org-rebrandable
brand pair rather than decoration. The marketing surface leads with the animated
hero network; the app surfaces stay quiet and task-first. Both read as one
system. (Design-backed by `ui-ux-pro-max` LMS guidance; the v2 direction mockup
lives at `design/mockup-v2.html`.)

## Color

Strategy: **one warm brand pair on accessible neutrals.** Education Teal is the
primary; Course Amber is the accent; grade-green / alert-red carry semantics.
Every tenant keeps the neutrals and swaps only the two brand vars.

- **Primary — Education Teal.** `--color-signal-*` is the teal ramp (kept under
  the `signal-*` name so existing usages rebrand in one place). `signal-600`
  `#0d9488` is the brand tone and the org default; **`signal-700` `#0f766e` is
  the AA-safe text/hover tone** — solid buttons and link text use 700 (4.8:1 on
  white), never the lighter 600 (only 3.7:1). Primary action = `btn('primary')`
  (signal-700 fill, white text, hover signal-800).
- **Accent — Course Amber.** `--color-accent-*` (`accent-600 #d97706`). Use soft
  fills (`accent-50/100`) with `accent-700` text for AA; reserve solid amber for
  large fills / secondary CTAs (`btn('accent')`).
- **Ground & ink.** White surfaces (`#ffffff`), faint teal-tint washes
  (`signal-50`), deep-teal ink `--foreground #0f2e2a`. Neutrals (`neutral-*`)
  carry body text and hairline borders.
- **Semantics.** Success / grade = emerald (`#15803D` family); **danger keeps
  rose/red** (`#DC2626`); warn = amber. "Live / now" state = rose `#e11d48`
  with the pulsing `animate-live` dot.
- **Org rebrand.** `--org-primary` / `--org-accent` on `:root` (see
  `globals.css`) retheme the whole app from two values; each org may also set
  `primaryColor` server-side (`Organization.primaryColor`).
- **Status** (`LIVE / STARTING_SOON / ENROLLING / IN_PROGRESS / COMPLETED`) now
  reads by **colour + weight + glyph**, not colour alone (LIVE rose, soon amber,
  enrolling/in-progress teal, completed neutral) — never colour as the only cue.

## Type

- Display: **Lexend** (`--font-display` → `--font-lexend`, next/font). Engineered
  for reading fluency; suits an all-ages learning product and pairs with Noto
  Sans Arabic for RTL. Used for hero, section titles, headings, auth headline.
- Text / UI: **Source Sans 3** (`--font-sans` → `--font-source`), base 16px,
  line-height 1.5. Mono: **Geist Mono** (verification codes, code only).
- Headings are bold with tight tracking; emphasis comes from weight/size.

## Form & components

- Radius: interactive controls = `rounded-full` (pills); cards/containers =
  `rounded-2xl`/`rounded-3xl`; inner chips = `rounded-xl`.
- Buttons via `src/lib/ui.ts` `btn()`: `primary` = signal-700 fill; `accent` =
  amber fill; `secondary` = hairline neutral outline (teal hover); `ghost` =
  neutral (teal hover); `danger` = rose. Inputs = hairline `neutral-300`, **focus
  ring teal** (`signal-600`). Shared tokens: `inputClass`, `labelClass`,
  `cardClass`. Password fields use `components/password-input.tsx`.
- **No emoji as icons** — use inline SVG / Phosphor. Emoji only as decorative
  tone (e.g. a single celebration mark), never as a structural icon.
- Flat & accessible: no heavy shadows/gradients; 44px touch targets; 3px focus
  rings; every status cue pairs colour with text or glyph.
- Editorial over boxed: prefer hairline-divided rows and generous whitespace to
  same-size icon cards. Borders are 1px `neutral-200`.
- Logo mark: rounded gradient play-button (`components/logo.tsx`).

## Motion

- Library: **motion** (`motion/react`) for React-driven motion; CSS keyframes in
  `globals.css` for simple loops (`animate-live`, `animate-fade-up`,
  `animate-marquee`). Landing scroll-reveal / count-up / word-reveal primitives
  live in `components/landing-motion.tsx` (built on motion, no GSAP).
- Signature: the hero network (`components/hero-network.tsx`) — nodes spring in,
  connections draw via `pathLength`, pulses travel the paths.
- All motion respects `prefers-reduced-motion` (motion `useReducedMotion` + the
  CSS media query) and collapses to a static render. SVG coords are rounded to
  avoid hydration drift.

## Surfaces

- **Persuade:** `/` landing — expressive; the animated network leads, with
  count-up metrics, feature-context sections, and comparison/capability tables.
- **Operate:** dashboard, courses, course detail, management surfaces, live
  classroom (`sessions/[id]`) — quiet, scannable; brand in precise details.
  Preserve all socket.io / LiveKit / tldraw behavior; visual changes only.
- **Auth:** focused white form (`components/auth-shell.tsx`); solo-instructor
  framing, invite path called out, not a company wall.

## Display-pattern rules (grid / modal / page)

Which container a data surface earns (see `design/ui-display-audit.md` for the
per-surface matrix):

- **Tabular grid** — a collection of *comparable records with many scannable
  attributes* the user sorts and compares (performance metrics, rosters, exam
  results). Metric tables should be **sortable**.
- **Modal** — a *quick single-record create/edit* that should keep the user in
  context, with a low field count (new program/section/assignment, invite,
  assign-to-group). Dismiss on Escape and backdrop click.
- **New page (own route)** — *immersive, complex, timed, or long-form* tasks
  that deserve the whole viewport and a shareable URL (take an exam/assessment,
  submit an assignment, the live classroom).
