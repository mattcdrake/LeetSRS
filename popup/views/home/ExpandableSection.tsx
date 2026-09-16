import { type ReactNode, useState } from 'react';
import { Button } from 'react-aria-components';
import { FaChevronRight } from 'react-icons/fa6';

interface ExpandableSectionProps {
  title: string;
  isDisabled?: boolean;
  children: ReactNode;
}

export function ExpandableSection({ title, isDisabled = false, children }: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-t border-current">
      <Button
        className="w-full flex items-center justify-between min-h-11 py-3 rounded-lg hover:bg-secondary transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
        onPress={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        isDisabled={isDisabled}
      >
        <span className="text-sm font-medium text-primary">{title}</span>
        <FaChevronRight
          aria-hidden="true"
          className={`h-3 w-3 text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
        />
      </Button>

      <div className="pb-4" hidden={!isExpanded}>
        {children}
      </div>
    </div>
  );
}
