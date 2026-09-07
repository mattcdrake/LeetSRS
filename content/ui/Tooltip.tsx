import { useEffect, useState } from 'react';
import { THEME_COLORS, useDarkMode } from './theme';
import styles from './ui.module.css';

export function Tooltip({ target, text, delay = 300 }: { target: HTMLElement; text: string; delay?: number }) {
  const isDark = useDarkMode();
  const [visible, setVisible] = useState<{ rect: DOMRect; text: string } | null>(null);
  useEffect(() => {
    setVisible(null);
    const timeout = setTimeout(() => {
      setVisible({ rect: target.getBoundingClientRect(), text });
    }, delay);
    return () => {
      clearTimeout(timeout);
    };
  }, [target, text, delay]);
  if (!visible) return null;
  const { rect } = visible;
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <div
      role="tooltip"
      className={styles.tooltip}
      style={{
        backgroundColor: colors.bgTooltip,
        border: `1px solid ${colors.borderTooltip}`,
        color: colors.textTooltip,
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      }}
    >
      {visible.text}
    </div>
  );
}
