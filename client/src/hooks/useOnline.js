import { useState, useEffect } from 'react';

/**
 * Hook to detect online/offline status
 * Returns: { isOnline, wasOffline }
 */
export function useOnline() {
  const [isOnline, setIsOnline] = useState(() => {
    // Initialize with actual navigator.onLine status
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Default to online on SSR
  });

  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
