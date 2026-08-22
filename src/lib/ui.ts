/**
 * Shared UI primitives for the app surfaces (Operate mode). The marketing
 * landing owns its louder, expressive treatment; everything behind auth uses
 * these quieter, consistent tokens so the product reads as one system:
 * white ground, deep-teal ink, one warm brand pair (teal primary + amber
 * accent) with grade-green / alert-red semantics. WCAG AA — brand text and
 * solid buttons use signal-700 (4.8:1 on white), not the lighter 600.
 */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const BTN_BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50';

const BTN_SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-sm',
  md: 'px-4.5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-[15px]',
  // Roomy on phones, settling to `lg` from sm up — pairs with the auth fields,
  // which only enlarge in mobile mode.
  xl: 'px-6 py-3.5 text-base sm:py-3 sm:text-[15px]',
};

const BTN_VARIANTS: Record<Variant, string> = {
  primary:
    'bg-signal-700 text-white shadow-sm shadow-signal-800/25 hover:bg-signal-800 focus-visible:ring-signal-500',
  accent:
    'bg-accent-600 text-white shadow-sm shadow-accent-700/25 hover:bg-accent-700 focus-visible:ring-accent-500',
  secondary:
    'border border-neutral-300 bg-white text-neutral-800 hover:border-signal-600 hover:text-signal-700 focus-visible:ring-signal-400',
  ghost:
    'text-neutral-600 hover:bg-signal-50 hover:text-signal-700 focus-visible:ring-signal-400',
  danger:
    'border border-rose-200 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50 focus-visible:ring-rose-400',
};

export function btn(
  variant: Variant = 'primary',
  size: Size = 'md',
  className?: string,
): string {
  return cn(BTN_BASE, BTN_SIZES[size], BTN_VARIANTS[variant], className);
}

export const inputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-signal-600 focus:outline-none focus:ring-4 focus:ring-signal-600/15';

export const labelClass = 'block text-sm font-medium text-neutral-700';

/**
 * Auth field styling that only enlarges in mobile mode: a taller hit area and
 * 16px text on phones (16px also stops iOS zooming on focus), settling back to
 * the standard `inputClass` metrics from sm up.
 */
export const inputClassLg =
  'w-full rounded-xl border border-neutral-300 bg-white px-4 py-3.5 text-base text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-signal-600 focus:outline-none focus:ring-4 focus:ring-signal-600/15 sm:px-3.5 sm:py-2.5 sm:text-sm';

export const labelClassLg =
  'block text-[15px] font-semibold text-neutral-800 sm:text-sm sm:font-medium sm:text-neutral-700';

export const cardClass = 'rounded-2xl border border-neutral-200 bg-white shadow-sm';

/** Up to two initials from a display name, for avatars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-signal-700',
  'bg-accent-600',
  'bg-signal-800',
  'bg-teal-600',
  'bg-amber-700',
  'bg-emerald-700',
];

/** Deterministic avatar color from a stable seed (e.g. user id or name). */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
