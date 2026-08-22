'use client';

import { useEffect, useState } from 'react';

/**
 * A real, ticking UTC clock for the terminal header — an honest "real-time"
 * metric (the actual current time), not a fabricated stat. Renders a stable
 * placeholder on the server and starts ticking after mount to avoid hydration
 * mismatch.
 */
export function LiveClock({ className }: { className?: string }) {
  const [time, setTime] = useState<string>('--:--:--');

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-GB', {
          hour12: false,
          timeZone: 'UTC',
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={className} suppressHydrationWarning>
      {time} UTC
    </span>
  );
}
