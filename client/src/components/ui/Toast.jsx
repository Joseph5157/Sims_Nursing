import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: { bg: 'var(--color-emerald-bg)',  border: 'var(--color-emerald-border)', color: 'var(--color-emerald-text)', dot: 'var(--color-emerald-solid)' },
  error:   { bg: 'var(--color-red-bg)',      border: 'var(--color-red-border)',     color: 'var(--color-red-text)',     dot: 'var(--color-red-solid)' },
  warning: { bg: 'var(--color-amber-bg)',    border: 'var(--color-amber-border)',   color: 'var(--color-amber-text)',   dot: 'var(--color-amber-solid)' },
  info:    { bg: 'var(--color-blue-50)',     border: 'var(--color-blue-200)',       color: 'var(--color-blue-800)',     dot: 'var(--color-blue-500)' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(({ message, type = 'success', persistent = false, onClick }) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type, onClick }]);
    if (!persistent) setTimeout(() => dismissToast(id), 3500);
    return id;
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        // Above every modal (Mantine default 200, plus our stacked-modal fixes up
        // to ~300) so success/error toasts are never hidden behind an open dialog.
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        maxWidth: 340,
        pointerEvents: 'none',
      }}>
        {toasts.map((t) => {
          const s = TOAST_STYLES[t.type] ?? TOAST_STYLES.success;
          return (
            <div
              key={t.id}
              role="alert"
              aria-live={t.type === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
              onClick={t.onClick ? () => { t.onClick(); dismissToast(t.id); } : undefined}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                backgroundColor: s.bg,
                border: `1px solid ${s.border}`,
                borderLeft: `3px solid ${s.dot}`,
                borderRadius: 'var(--radius-lg)',
                padding: '10px 14px',
                fontSize: 'var(--text-card)',
                color: s.color,
                fontWeight: 'var(--weight-medium)',
                fontFamily: 'var(--font-sans)',
                boxShadow: 'var(--shadow-toast)',
                pointerEvents: 'auto',
                animation: 'fadeSlideIn 0.2s ease',
                cursor: t.onClick ? 'pointer' : 'default',
              }}
            >
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={(e) => { e.stopPropagation(); dismissToast(t.id); }}
                aria-label="Dismiss notification"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 18,
                  lineHeight: 1,
                  flexShrink: 0,
                  opacity: 0.6,
                  transition: 'opacity 150ms',
                }}
                onMouseEnter={(e) => e.target.style.opacity = '1'}
                onMouseLeave={(e) => e.target.style.opacity = '0.6'}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
