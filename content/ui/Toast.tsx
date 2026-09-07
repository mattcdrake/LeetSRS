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
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: '#323232',
        color: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        zIndex: '9999',
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
      }}
    >
      {message}
    </div>
  );
}
