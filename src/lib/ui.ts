/**
 * Shared UI primitives for the app surfaces (Operate mode). The marketing
 * landing owns its louder, expressive treatment; everything behind auth uses
 * these quieter, consistent tokens so the product reads as one system:
 * white ground, near-black neutral ink, fully monochrome (no chromatic accent).
 */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BTN_BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50';

const BTN_SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-sm',
  md: 'px-4.5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-[15px]',
};

const BTN_VARIANTS: Record<Variant, string> = {
  primary:
    'bg-signal-600 text-white shadow-sm shadow-signal-700/25 hover:bg-neutral-800 focus-visible:ring-signal-500',
  secondary:
    'border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-900 hover:text-neutral-950 focus-visible:ring-neutral-400',
  ghost:
    'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-neutral-400',
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
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-950 shadow-sm transition placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-4 focus:ring-neutral-900/10';

export const labelClass = 'block text-sm font-medium text-neutral-700';

export const cardClass = 'rounded-2xl border border-neutral-200 bg-white shadow-sm';

/** Up to two initials from a display name, for avatars. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-neutral-900',
  'bg-signal-500',
  'bg-neutral-700',
  'bg-signal-700',
  'bg-neutral-800',
  'bg-signal-600',
];

/** Deterministic avatar color from a stable seed (e.g. user id or name). */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
