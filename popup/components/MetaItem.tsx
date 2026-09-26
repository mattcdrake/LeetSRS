import type { ReactNode } from 'react';

// A dot-separated item on a problem row's second line.
export function MetaItem({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`flex min-w-0 items-center gap-1 ${className}`}>
      <span aria-hidden="true">·</span>
      <span className="truncate">{children}</span>
    </span>
  );
}
