import { localDaysUntil } from '@/shared/calendar';
import type { Translations } from '@/shared/i18n/index';

export type DueTone = 'overdue' | 'today' | 'upcoming';

// Shared due wording for problem rows: "Overdue 3d", "Due today", "Due in 5d".
export function formatDue(due: number, now: number, t: Translations): { tone: DueTone; label: string } {
  const days = localDaysUntil(due, new Date(now));
  if (days < 0) return { tone: 'overdue', label: t.calendar.overdueBy(t.format.intervalShort(-days)) };
  if (days === 0) return { tone: 'today', label: t.roadmaps.dueToday };
  return { tone: 'upcoming', label: t.roadmaps.dueIn(t.format.intervalShort(days)) };
}
