'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          theme?: 'auto' | 'light' | 'dark';
          size?: 'normal' | 'compact' | 'flexible';
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

interface TurnstileProps {
  theme?: 'auto' | 'light' | 'dark';
  size?: 'normal' | 'compact' | 'flexible';
  className?: string;
  onSuccess?: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

const SCRIPT_ID = 'cf-turnstile-script';
const SITE_KEY = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY?.trim();

/**
 * Cloudflare Turnstile CAPTCHA widget.
 *
 * If `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` is not set, this renders nothing
 * and adds no overhead, allowing friction-free local dev and testing.
 * When set, it renders the Turnstile challenge and injects a hidden form input
 * `name="turnstileToken"` so server actions receive the challenge token.
 */
export function Turnstile({
  theme = 'auto',
  size = 'normal',
  className = 'my-2 flex justify-center',
  onSuccess,
  onError,
  onExpire,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    let isSubscribed = true;

    function renderWidget() {
      if (!isSubscribed || !window.turnstile || !containerRef.current) return;
      if (widgetIdRef.current) return; // Already rendered

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY!,
          theme,
          size,
          callback: (newToken: string) => {
            if (!isSubscribed) return;
            setToken(newToken);
            onSuccess?.(newToken);
          },
          'expired-callback': () => {
            if (!isSubscribed) return;
            setToken('');
            onExpire?.();
          },
          'error-callback': () => {
            if (!isSubscribed) return;
            setToken('');
            onError?.();
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.warn('Failed to render Turnstile widget:', err);
      }
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src =
          'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 50);

      return () => {
        clearInterval(interval);
        isSubscribed = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore teardown error
          }
          widgetIdRef.current = null;
        }
      };
    }

    return () => {
      isSubscribed = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore teardown error
        }
        widgetIdRef.current = null;
      }
    };
  }, [theme, size, onSuccess, onError, onExpire]);

  if (!SITE_KEY) {
    return null;
  }

  return (
    <div className={className}>
      <input type="hidden" name="turnstileToken" value={token} />
      <div ref={containerRef} />
    </div>
  );
}
