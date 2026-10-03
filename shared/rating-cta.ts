import { z } from 'zod';
import { storage } from '#imports';

export const CHROME_WEB_STORE_REVIEWS_URL =
  'https://chromewebstore.google.com/detail/leetsrs/odgfcigkohoimpeeooifjdglncggkgko/reviews?utm_source=item-share-cb';

// Rating prompts stay hidden on browsers without a store listing to review.
export const reviewStore =
  import.meta.env.BROWSER === 'firefox' ? null : { name: 'Chrome Web Store', url: CHROME_WEB_STORE_REVIEWS_URL };

// Set only by a rating prompt's rate or decline action. Closing a prompt leaves later prompts eligible.
export const ratingCtaItem = storage.defineItem<unknown>('local:leetsrs:ratingCta');

export const ratingCtaResolutionSchema = z.object({
  outcome: z.enum(['rated', 'declined']),
  dialogId: z.string().min(1),
});
export type RatingCtaResolution = z.infer<typeof ratingCtaResolutionSchema>;

export async function readRatingCtaResolution(): Promise<RatingCtaResolution | null> {
  return ratingCtaResolutionSchema.nullable().parse((await ratingCtaItem.getValue()) ?? null);
}

export function writeRatingCtaResolution(resolution: RatingCtaResolution): Promise<void> {
  return ratingCtaItem.setValue(resolution);
}
