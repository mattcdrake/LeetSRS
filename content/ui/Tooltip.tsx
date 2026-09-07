import { useEffect, useState } from 'react';
import { THEME_COLORS } from './constants';
import styles from './ui.module.css';
import { useDarkMode } from './useDarkMode';

export function Tooltip({ target, text, delay = 300 }: { target: HTMLElement; text: string; delay?: number }) {
  const isDark = useDarkMode();
  const [visible, setVisible] = useState<{ rect: DOMRect; text: string } | null>(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    setVisible(null);
    setAnimated(false);
    let frame: number | undefined;
    const timeout = setTimeout(() => {
      setVisible({ rect: target.getBoundingClientRect(), text });
      frame = requestAnimationFrame(() => setAnimated(true));
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [target, text, delay]);
  if (!visible) return null;
  const { rect } = visible;
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <div
      role="tooltip"
      className={styles.tooltip}
      data-visible={animated}
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
