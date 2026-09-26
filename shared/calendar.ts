export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
