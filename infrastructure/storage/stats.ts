import { storage } from '#imports';
import type { DailyStats } from '@/domain/statistics';
import { STORAGE_KEYS } from './storage-keys';

export async function getStats(): Promise<Record<string, DailyStats>> {
  const stats = await storage.getItem<Record<string, DailyStats>>(STORAGE_KEYS.stats);
  return stats ?? {};
}

export async function getStatsForDate(date: string): Promise<DailyStats | null> {
  const stats = await getStats();
  return stats[date] ?? null;
}

export async function saveStats(stats: Record<string, DailyStats>): Promise<void> {
  await storage.setItem(STORAGE_KEYS.stats, stats);
}

export function removeStats(): Promise<void> {
  return storage.removeItem(STORAGE_KEYS.stats);
}
