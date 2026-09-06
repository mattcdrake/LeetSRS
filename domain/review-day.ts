import type { Card } from './cards';

export function formatLocalDate(date: Date, dayStartHour: number = 0): string {
  const adjustedDate = new Date(date);
  if (dayStartHour) {
    adjustedDate.setHours(adjustedDate.getHours() - dayStartHour);
  }
  const year = adjustedDate.getFullYear();
  const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
  const day = String(adjustedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDueByDate(card: Card, referenceDate: Date, dayStartHour: number = 0): boolean {
  const dueDate = new Date(card.fsrs.due);

  const referenceDateStr = formatLocalDate(referenceDate, dayStartHour);
  const dueStr = formatLocalDate(dueDate, dayStartHour);
  return dueStr <= referenceDateStr;
}
