import { useState, useEffect } from 'react';

/**
 * Tracks how many pixels of the layout viewport are currently covered by the
 * on-screen (soft) keyboard on mobile. Returns `0` when no keyboard is open or
 * when `visualViewport` is unavailable (desktop / older browsers).
 *
 * Why this exists: on Android Chrome the soft keyboard overlays the layout
 * viewport without changing `window.innerHeight`, so a vertically-centered modal
 * (or a downward-opening combobox list) can render *behind* the keyboard where
 * options are unselectable. Feed this inset into modal padding / dropdown
 * max-height so interactive content always stays above the keyboard.
 *
 * Originally inlined in RecordViolationModal (P21); extracted here so every
 * searchable dropdown can share the exact same behaviour.
 */
export default function useKeyboardInset() {
  const [kbInset, setKbInset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const onResize = () => setKbInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    onResize();
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  return kbInset;
}
