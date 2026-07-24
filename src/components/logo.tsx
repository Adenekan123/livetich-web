/** livetich wordmark + gradient play-button mark. Shared across all surfaces. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="url(#lt-logo-grad)" />
      <path d="M13 11.5v9l7.5-4.5L13 11.5Z" fill="white" />
      <defs>
        <linearGradient id="lt-logo-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#818cf8" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
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
