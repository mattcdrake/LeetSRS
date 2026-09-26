import type { ReactNode } from 'react';
import { LuCircleAlert, LuCircleCheck, LuTriangleAlert } from 'react-icons/lu';

type NoticeTone = 'danger' | 'warning' | 'success';

const tones = {
  danger: { Icon: LuCircleAlert, icon: 'text-danger', background: 'bg-[var(--danger-soft)]', role: 'alert' },
  warning: {
    Icon: LuTriangleAlert,
    icon: 'text-warning',
    background: 'bg-[color-mix(in_srgb,var(--current-warning)_12%,var(--current-bg-surface))]',
    role: 'alert',
  },
  success: { Icon: LuCircleCheck, icon: 'text-accent', background: 'bg-accent-soft', role: 'status' },
} as const;

interface NoticeProps {
  tone: NoticeTone;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}

// One feedback style for errors, warnings and confirmations. Text stays primary/secondary for contrast.
export function Notice({ tone, title, body, action }: NoticeProps) {
  const { Icon, icon, background, role } = tones[tone];
  return (
    <div role={role} className={`flex items-start gap-2 rounded-lg ${background} px-2.5 py-2 text-xs leading-4`}>
      <Icon aria-hidden="true" className={`mt-px size-3.5 shrink-0 ${icon}`} />
      <div className="min-w-0 flex-1">
        <p className={body ? 'font-medium text-primary' : 'text-primary'}>{title}</p>
        {body && <p className="mt-0.5 text-secondary">{body}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
