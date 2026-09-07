import { Tooltip as AriaTooltip, type TooltipProps } from 'react-aria-components';
import { THEME_COLORS, useDarkMode } from './theme';
import styles from './ui.module.css';

export function Tooltip({ text, ...props }: { text: string } & TooltipProps) {
  const colors = useDarkMode() ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <AriaTooltip
      {...props}
      placement="bottom"
      offset={8}
      className={styles.tooltip}
      style={{
        backgroundColor: colors.bgTooltip,
        border: `1px solid ${colors.borderTooltip}`,
        color: colors.textTooltip,
      }}
    >
      {text}
    </AriaTooltip>
  );
}
