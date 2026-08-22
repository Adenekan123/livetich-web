import { cn } from '@/lib/ui';

/**
 * The Livetich wordmark (`public/livetich-logo.png`). The asset is a light
 * wordmark built for dark surfaces, so on light backgrounds we sit it on a
 * compact dark chip rather than recolouring the raster (which would shift the
 * green play accent). Use `onDark` on already-dark surfaces to drop the chip.
 */
export function BrandLogo({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  // The asset carries generous transparent padding, so heights run large to
  // give the wordmark real presence. `className` (when passed) fully controls
  // the height to avoid clashing with the default.
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/livetich-logo.png"
      alt="Livetich"
      className={cn('w-auto object-contain', className ?? (onDark ? 'h-18' : 'h-9'))}
    />
  );
  if (onDark) return img;
  return (
    <span className="inline-flex items-center rounded-lg bg-neutral-950 px-1.5 py-0.5">
      {img}
    </span>
  );
}
