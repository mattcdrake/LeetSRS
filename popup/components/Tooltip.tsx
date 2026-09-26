import { type ReactNode, useState } from 'react';
import { Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components';

interface TooltipProps {
  label: string;
  isDisabled?: boolean;
  /** Checked each time the tooltip would open, for conditions that depend on layout. */
  shouldOpen?: () => boolean;
  children: ReactNode;
}

// Labels icon-only controls on hover and keyboard focus.
export function Tooltip({ label, isDisabled, shouldOpen, children }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TooltipTrigger
      delay={500}
      closeDelay={0}
      isDisabled={isDisabled}
      isOpen={isOpen}
      onOpenChange={(open) => setIsOpen(open && (shouldOpen?.() ?? true))}
    >
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
