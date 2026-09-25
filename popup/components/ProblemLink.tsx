import { type ReactNode, useRef } from 'react';
import { Link } from 'react-aria-components';
import { Tooltip } from '@/popup/components/Tooltip';
import { buttonInteraction } from '@/popup/styles';

interface ProblemLinkProps {
  href: string;
  frontendId: string;
  title: string;
  className?: string;
  children?: ReactNode;
}

// A single-line problem link that shows its full label in a tooltip only when the title is truncated.
export function ProblemLink({ href, frontendId, title, className = '', children }: ProblemLinkProps) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const label = `${frontendId}. ${title}`;
  const isTruncated = () => !!titleRef.current && titleRef.current.scrollWidth > titleRef.current.clientWidth;

  return (
    <Tooltip label={label} shouldOpen={isTruncated}>
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={`flex min-w-0 items-center gap-1 rounded-sm hover:text-accent ${buttonInteraction} ${className}`}
      >
        <span className="shrink-0 text-tertiary tabular-nums">{frontendId}.</span>
        <span ref={titleRef} className="truncate">
          {title}
        </span>
        {children}
      </Link>
    </Tooltip>
  );
}
