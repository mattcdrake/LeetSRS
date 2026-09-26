import { useQuery } from '@tanstack/react-query';
import { type CSSProperties, type ReactNode, useId } from 'react';
import { Button } from 'react-aria-components';
import { LuArrowUpRight } from 'react-icons/lu';
import { type Grade, State } from 'ts-fsrs';
import { Difficulty } from '@/popup/components/Difficulty';
import { useTheme } from '@/popup/hooks/useTheme';
import { type CardWithProblem, ratingPreviewQueryOptions } from '@/popup/queries/cards';
import { buttonInteraction } from '@/popup/styles';
import { ratingSchema } from '@/shared/learning-document';
import { getLeetcodeProblemUrl } from '@/shared/leetcode-links';
import { getProblemTitle } from '@/shared/ui/problem-title';
import { RATING_COLORS } from '@/shared/ui/rating-colors';
import { useI18n } from '../../contexts/I18nContext';

type ReviewCardProps = {
  card: CardWithProblem;
  onRate: (rating: Grade) => void;
  isProcessing?: boolean;
  children?: ReactNode;
};

export function ReviewCard({ card, onRate, isProcessing = false, children }: ReviewCardProps) {
  const t = useI18n();
  const id = useId();
  const colors = RATING_COLORS[useTheme()];
  const preview = useQuery(ratingPreviewQueryOptions(card));

  return (
    <section className="rounded-xl bg-surface border border-current shadow-card">
      <div className="p-4 pb-3.5">
        <div className="flex items-center gap-2 text-xs text-tertiary">
          <span className="tabular-nums">{t.format.leetcodeId(card.frontendId)}</span>
          <span aria-hidden="true" className="opacity-50">
            /
          </span>
          <Difficulty difficulty={card.difficulty} />
          {card.fsrs.state === State.New && (
            <span className="ml-auto h-5 px-1.5 rounded-md bg-accent-soft text-accent text-[11px] font-medium grid place-items-center">
              {t.states.new}
            </span>
          )}
        </div>
        <a
          href={getLeetcodeProblemUrl(card)}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-1.5 flex items-start gap-1.5 text-[17px] leading-[22px] font-semibold tracking-[-0.01em] text-primary hover:text-accent rounded-sm ${buttonInteraction}`}
        >
          <span className="min-w-0 break-words">{getProblemTitle(card, card.domain)}</span>
          <LuArrowUpRight aria-hidden="true" className="size-3.5 mt-1 shrink-0 text-tertiary" strokeWidth={2} />
        </a>
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {[...ratingSchema.values].map((rating) => (
            <Button
              key={rating}
              onPress={() => onRate(rating)}
              isDisabled={isProcessing}
              aria-label={t.ratings[rating]}
              aria-describedby={`${id}-${rating}`}
              style={{ '--rating-color': colors[rating] } as CSSProperties}
              className={`h-10 min-w-0 px-1 rounded-lg bg-secondary flex flex-col items-center justify-center whitespace-nowrap duration-[120ms] data-[hovered]:bg-[color-mix(in_srgb,var(--rating-color)_10%,var(--current-bg-secondary))] ${buttonInteraction}`}
            >
              <span className="flex items-center gap-1.5 text-[13px] leading-4 font-medium text-primary">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--rating-color)]" />
                {t.ratings[rating]}
              </span>
              <span id={`${id}-${rating}`} className="text-[11px] leading-[14px] text-tertiary tabular-nums">
                {preview.data ? t.format.intervalShort(preview.data[rating]) : '…'}
              </span>
            </Button>
          ))}
        </div>
      </div>
      {children && <div className="border-t border-current px-4 py-1.5">{children}</div>}
    </section>
  );
}
