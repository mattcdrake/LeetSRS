// en-CA formats local dates as YYYY-MM-DD.
export function formatLocalDate(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Includes overdue cards and cards scheduled later today. */
export function isDue(due: number, now: Date): boolean {
  return due < addLocalDays(now, 1).getTime();
}

/** Calendar days from `now` to `due`: negative when overdue, 0 when due today. */
export function localDaysUntil(due: number, now: Date): number {
  // Round calendar-day differences so DST changes do not shift the count.
  return Math.round((addLocalDays(new Date(due), 0).getTime() - addLocalDays(now, 0).getTime()) / 86_400_000);
}
