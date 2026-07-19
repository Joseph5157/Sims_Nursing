import { useEffect, useState } from 'react';
import { useOnline } from '../hooks/useOnline';

export default function OfflineBanner() {
  const { isOnline } = useOnline();
  const [showBanner, setShowBanner] = useState(!isOnline);
  const [prevOnline, setPrevOnline] = useState(isOnline);

  // Show the banner on any online/offline transition. This is the supported
  // render-phase state adjustment (guarded so it can't loop) — "visible while
  // offline" is derived state, not something to compute inside an effect.
  if (isOnline !== prevOnline) {
    setPrevOnline(isOnline);
    setShowBanner(true);
  }

  // Once back online, keep the banner up for 2s, then hide it.
  useEffect(() => {
    if (isOnline && showBanner) {
      const timer = setTimeout(() => setShowBanner(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showBanner]);

  if (!showBanner) return null;

  return (
    <div
      className="md:hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 70,
        padding: '12px 16px',
        backgroundColor: 'var(--color-amber-bg)',
        borderBottom: '1px solid var(--color-amber-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
      role="status"
      aria-live="polite"
      aria-label={isOnline ? 'Back online' : 'You are offline'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>📡</span>
        <span
          style={{
            fontSize: 'var(--text-card)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--color-amber-text)',
          }}
        >
          {isOnline
            ? 'Back online — syncing changes'
            : "You're offline — changes will sync when connection returns"}
        </span>
      </div>
      <button
        onClick={() => setShowBanner(false)}
        aria-label="Dismiss offline banner"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-amber-text)',
          cursor: 'pointer',
          padding: '4px 8px',
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.6,
          transition: 'opacity 150ms',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
      >
        ✕
      </button>
    </div>
  );
}
