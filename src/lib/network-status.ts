'use client';

import { useEffect, useState } from 'react';
import { clearRealtimeToken } from './client-token';

/**
 * React hook to observe browser online / offline network state.
 * Automatically clears the cached realtime auth token on network restoration
 * so subsequent socket reconnection attempts fetch a fresh, valid token.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Network returned — clear cached realtime token so any reconnecting
      // sockets re-authenticate cleanly with a fresh token.
      clearRealtimeToken();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
