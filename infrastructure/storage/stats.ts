import { z } from 'zod';
import { storage } from '#imports';
import { type DailyStats, dailyStatsSchema } from '@/domain/statistics';
import { STORAGE_KEYS } from './storage-keys';

const statsSchema = z.record(z.string(), dailyStatsSchema);

export async function getStats(): Promise<Record<string, DailyStats>> {
  const stats = await storage.getItem<unknown>(STORAGE_KEYS.stats);
  return statsSchema.parse(stats ?? {});
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
