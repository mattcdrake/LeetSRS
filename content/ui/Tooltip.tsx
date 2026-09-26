import { Tooltip as AriaTooltip, type TooltipProps } from 'react-aria-components';
import { useSurfaceTheme } from './theme';

export function Tooltip({ title, text, ...props }: { title: string; text: string } & TooltipProps) {
  const theme = useSurfaceTheme();
  return (
    <AriaTooltip
      {...props}
      placement="bottom"
      offset={8}
      className="pointer-events-none z-50 animate-tooltip-enter motion-reduce:animate-none"
    >
      <div
        data-theme={theme}
        className="flex items-center gap-1.5 rounded-[7px] bg-surface px-2.5 py-1.5 text-[12px] leading-normal whitespace-nowrap text-fg shadow-(--ls-shadow)"
      >
        <span className="font-medium">{title}</span>
        <span className="text-fg-3">{text}</span>
      </div>
    </AriaTooltip>
  );
}
