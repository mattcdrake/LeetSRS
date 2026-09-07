import { useEffect, useState } from 'react';

const TOAST_DURATION_MS = 2500;
const FADE_DURATION_MS = 300;

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    const fadeTimeout = window.setTimeout(() => setVisible(false), TOAST_DURATION_MS);
    const dismissTimeout = window.setTimeout(onDismiss, TOAST_DURATION_MS + FADE_DURATION_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(dismissTimeout);
    };
  }, [onDismiss]);

  return (
    <div
      role="status"
      className="fixed right-5 bottom-5 z-9999 rounded-lg bg-[#323232] px-4 py-3 text-[14px] text-white shadow-[0_2px_8px_rgb(0_0_0/20%)] transition-opacity ease-in-out"
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${FADE_DURATION_MS}ms`,
      }}
    >
      {message}
    </div>
  );
}
