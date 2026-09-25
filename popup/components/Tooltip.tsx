import type { ReactNode } from 'react';
import { Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components';

// Labels icon-only controls on hover and keyboard focus.
export function Tooltip({ label, isDisabled, children }: { label: string; isDisabled?: boolean; children: ReactNode }) {
  return (
    <TooltipTrigger delay={500} closeDelay={0} isDisabled={isDisabled}>
      {children}
      <AriaTooltip
        offset={6}
        className="z-[1200] max-w-56 rounded-md bg-[var(--current-text-primary)] px-2 py-1 text-[11px] text-[var(--current-bg-primary)] shadow-card"
      >
        {label}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
