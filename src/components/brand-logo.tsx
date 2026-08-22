import { cn } from '@/lib/ui';

/**
 * The Livetich wordmark. Two production assets, picked by surface:
 *   - `onDark`  → `livetich-logo.png`, the light wordmark for dark grounds.
 *   - default   → `logo-daek.png`, the dark wordmark for light grounds.
 * Each renders directly (no chip / no recolouring) so the green play accent
 * stays true. `className` fully controls the height when passed.
 */
export function BrandLogo({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={onDark ? '/livetich-logo.png' : '/logo-daek.png'}
      alt="Livetich"
      className={cn('w-auto object-contain', className ?? (onDark ? 'h-18' : 'h-9'))}
    />
  );
}
