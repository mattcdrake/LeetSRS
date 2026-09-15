import { type ReactNode, useState } from 'react';
import { Button } from 'react-aria-components';

interface ExpandableSectionProps {
  title: string;
  isDisabled?: boolean;
  children: ReactNode;
}

export function ExpandableSection({ title, isDisabled = false, children }: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-current rounded-lg bg-secondary overflow-hidden">
      <Button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-tertiary transition-colors"
        onPress={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        isDisabled={isDisabled}
      >
        <span className="text-sm font-semibold text-primary">{title}</span>
        <span className={`text-xs text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </Button>

      <div className="px-4 pb-4 border-t border-current" hidden={!isExpanded}>
        {children}
      </div>
    </div>
  );
}
