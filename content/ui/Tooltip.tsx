import { Tooltip as AriaTooltip, type TooltipProps } from 'react-aria-components';
import { THEME_COLORS, useDarkMode } from './theme';

export function Tooltip({ text, ...props }: { text: string } & TooltipProps) {
  const colors = useDarkMode() ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <AriaTooltip
      {...props}
      placement="bottom"
      offset={8}
      className="pointer-events-none z-50 animate-tooltip-enter overflow-hidden rounded-md px-3 py-1.5 text-[12px] shadow-[0_4px_6px_rgb(0_0_0/10%)]"
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
