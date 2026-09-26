import type { ReactNode } from 'react';

export const settingsCard = 'rounded-xl border border-current bg-surface shadow-card';
// Inset hairlines between rows: each row carries its own horizontal margin.
export const rowDividers = '[&>*+*]:border-t [&>*+*]:border-[color:var(--current-border)]';
export const settingsRow = 'mx-3.5 flex min-h-11 items-center gap-3 py-2';

interface SettingsSectionProps {
  id: string;
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}

export function SettingsSection({ id, title, trailing, children }: SettingsSectionProps) {
  return (
    <section aria-labelledby={id} className="mb-5">
      <div className="flex min-h-7 items-end justify-between">
        <h3 id={id} className="px-1 pb-1.5 text-xs font-medium text-tertiary">
          {title}
        </h3>
        {trailing}
      </div>
      {children}
    </section>
  );
}

export function SettingsCard({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`${settingsCard} ${rowDividers} ${className}`}>{children}</div>;
}

interface RowTextProps {
  label: ReactNode;
  hint?: ReactNode;
  hintId?: string;
}

export function RowText({ label, hint, hintId }: RowTextProps) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[13px] leading-5 text-primary">{label}</div>
      {hint && (
        <div id={hintId} className="text-xs leading-4 text-tertiary">
          {hint}
        </div>
      )}
    </div>
  );
}

interface SettingsRowProps extends RowTextProps {
  children?: ReactNode;
}

export function SettingsRow({ children, ...text }: SettingsRowProps) {
  return (
    <div className={settingsRow}>
      <RowText {...text} />
      {children}
    </div>
  );
}
