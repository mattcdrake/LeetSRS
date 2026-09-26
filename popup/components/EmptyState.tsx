import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ icon, title, description, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3.5 py-3 bg-secondary ${className}`}>
      <span className="size-8 shrink-0 rounded-full bg-accent-soft text-accent grid place-items-center">{icon}</span>
      <div>
        <p className="text-[13px] font-semibold text-primary">{title}</p>
        <p className="text-xs text-tertiary">{description}</p>
      </div>
    </div>
  );
}
