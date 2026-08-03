/** livetich mark — near-black tile, white play button. Fully monochrome.
 *  Shared across all surfaces. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0a0a0a" />
      <path d="M12.5 10.5v11l9-5.5-9-5.5Z" fill="#ffffff" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <Logo className="inline-block h-7 w-7 align-middle" />
      <span className="ml-2 align-middle text-lg font-semibold tracking-tight">
        livetich
      </span>
    </span>
  );
}
