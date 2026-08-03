# Design

<!-- Durable visual decisions for livetich-web. Product truth lives in PRODUCT.md. -->

## Thesis

**White stage, black type, one live signal.** livetich is one live room where a
whole cohort connects to a single instructor and competes in real time. The
marketing surface refuses the dark glowy-SaaS hero and the uniform icon-card
grid; the app surfaces stay quiet and task-first. Both read as one system.

## Color

Strategy: **Fully monochrome** — pure white, near-black ink, and grays only. No
chromatic accent. Emphasis and energy come from weight, scale, and motion, never
from hue.

- Ground: white `#ffffff`. Ink: neutral scale (`neutral-950 #0a0a0a` … `neutral-400`).
- The former accent role is now black: the `--color-signal-*` tokens (see
  `globals.css`) map onto the neutral gray ramp and are kept only so those
  usages stay in one place. Primary action = near-black fill (`signal-600`
  = `#0a0a0a`) with white text, hover lightens to `neutral-800`.
- "Live" / now state, hero pulses, the current selection = near-black (they read
  by motion — the pulsing `animate-live` dot, traveling pulses — not by color).
- Near-black is also the inverse anchor: landing CTA band and auth brand panel.
- **Errors keep rose** as the one functional exception (an accessibility
  affordance, not brand color); no other hues appear anywhere.
- Status: LIVE / SCHEDULED / ENDED / locked all render in the neutral ramp,
  differentiated by weight and the live pulse, not color.

## Type

- Display: **Archivo** (`--font-display`, variable, weight 800–900), tight
  tracking `-0.03em`/`-0.04em`, leading `~0.95`. Used for hero, section titles,
  step numerals, auth headline. Not Inter, not a training-data default.
- Text / UI: **Geist** (`--font-sans`). Mono: **Geist Mono** (code, verification
  codes only).
- Headlines are big and bold; emphasis comes from weight/size, never gradients.

## Form & components

- Radius: interactive controls = `rounded-full` (pills); cards/containers =
  `rounded-2xl`/`rounded-3xl`; inner chips = `rounded-xl`.
- Buttons via `src/lib/ui.ts` `btn()`: primary = signal fill; secondary = hairline
  neutral outline; ghost = neutral. Inputs = hairline `neutral-300`, focus ring
  neutral. Shared tokens: `inputClass`, `labelClass`, `cardClass`.
- Editorial over boxed: prefer hairline-divided rows and generous whitespace to
  same-size icon cards. Borders are 1px `neutral-200`; no colored left-borders.
- Logo mark: near-black tile + signal-orange play triangle (`components/logo.tsx`).

## Motion

- Library: **motion** (`motion/react`) for React-driven motion; CSS keyframes in
  `globals.css` for simple loops (`animate-live`, `animate-fade-up`, `animate-marquee`).
- Signature: the hero network (`components/hero-network.tsx`) — nodes spring in,
  connections draw via `pathLength`, and signal-orange pulses travel the paths
  (SVG `animateMotion`). One orchestrated moment, not scattered hovers.
- All motion respects `prefers-reduced-motion` (motion `useReducedMotion` +
  the CSS media query). SVG coordinates are rounded to avoid hydration drift.

## Surfaces

- **Persuade:** `/` landing — expressive, the animated network leads.
- **Operate:** dashboard, courses, course detail, live classroom (`sessions/[id]`)
  — quiet, scannable; brand lives in precise details. Preserve all
  socket.io/LiveKit/tldraw behavior; visual changes only.
- **Auth:** two-pane — near-black brand panel + focused white form.
