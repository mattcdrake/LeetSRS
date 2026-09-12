import { z } from 'zod';

// Frozen learning fields shared by historical datasets through version 5.
// Keep these independent of current domain schemas so future model changes cannot
// silently accept or discard malformed historical values before conversion.
const count = z.int().nonnegative();
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });
const settingsSchema = z
  .object({
    maxNewCardsPerDay: z.number().int().min(0).max(100),
    theme: z.enum(['system', 'light', 'dark']),
    resetEditorOnEveryProblem: z.boolean(),
    resetEditorOnDueReview: z.boolean(),
    badgeEnabled: z.boolean(),
    language: z.enum(['de', 'en', 'hi', 'pl', 'zh-CN']),
  })
  .partial();
const statsSchema = z.object({
  date: calendarDate,
  totalReviews: count,
  newCards: count,
  reviewedCards: count,
  streak: count,
  gradeBreakdown: z.object({ 1: count, 2: count, 3: count, 4: count }),
});

export const historicalTimestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));

export const historicalRecordsSchema = z.looseObject({
  dataUpdatedAt: historicalTimestampSchema.optional(),
  cards: z.record(z.string(), z.unknown()).default({}),
  stats: z.record(z.string(), statsSchema).default({}),
  settings: settingsSchema.default({}),
});

export const legacyBackupSchema = z.object({
  schemaVersion: z.int().nonnegative().default(0),
  exportDate: historicalTimestampSchema,
  dataUpdatedAt: historicalTimestampSchema.optional(),
  data: z.looseObject({
    cards: z.record(z.string(), z.unknown()),
    stats: z.record(z.string(), z.unknown()),
    gistSync: z.object({ gistId: z.string(), enabled: z.boolean() }).partial().optional(),
  }),
});
