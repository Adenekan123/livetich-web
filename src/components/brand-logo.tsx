import { cn } from '@/lib/ui';

/**
 * The Livetich wordmark. Two production assets, picked by surface:
 *   - `onDark`  → `livetich-logo.png`, the light wordmark for dark grounds.
 *   - default   → `logo-daek.png`, the dark wordmark for light grounds.
 * Each renders directly (no chip / no recolouring) so the green play accent
 * stays true. `className` fully controls the height when passed.
 *
 * `themed` follows the landing theme toggle: it renders both assets and lets
 * CSS (keyed on data-theme) show whichever reads on the current ground — so the
 * mark flips with light/dark mode. Use it on theme-toggled surfaces; leave it
 * off for fixed grounds (e.g. the auth side panel), where `onDark` is enough.
 */
export function BrandLogo({
  onDark = false,
  themed = false,
  className,
}: {
  onDark?: boolean;
  themed?: boolean;
  className?: string;
}) {
  if (themed) {
    const cls = cn('w-auto object-contain', className ?? 'h-9');
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/livetich-logo.png" alt="Livetich" className={cn('logo-on-dark', cls)} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-daek.png" alt="Livetich" className={cn('logo-on-light', cls)} />
      </>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={onDark ? '/livetich-logo.png' : '/logo-daek.png'}
      alt="Livetich"
      className={cn('w-auto object-contain', className ?? (onDark ? 'h-18' : 'h-9'))}
    />
  );
}
