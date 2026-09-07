import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Translations } from '@/i18n';
import { useRatingMenu } from '../useRatingMenu';
import { LeetSrsButton } from './LeetSrsButton';
import { type RatingCallback, RatingMenu } from './RatingMenu';
import { Tooltip } from './Tooltip';

export type LeetSrsControlProps = {
  t: Translations;
  getTranslations: () => Promise<Translations>;
  onError: (error: unknown) => void;
  onRate: RatingCallback;
  onAddWithoutRating: () => void;
};

export function LeetSrsControl({ t, getTranslations, onError, onRate, onAddWithoutRating }: LeetSrsControlProps) {
  const container = useRef<HTMLDivElement>(null);
  const [tooltipTarget, setTooltipTarget] = useState<HTMLButtonElement | null>(null);
  const menu = useRatingMenu(getTranslations, onError);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (container.current && !event.composedPath().includes(container.current)) menu.close();
    };
    document.addEventListener('click', dismiss);
    return () => document.removeEventListener('click', dismiss);
  }, [menu.close]);

  return (
    <div ref={container} style={{ position: 'relative', display: 'flex' }}>
      <LeetSrsButton
        t={t}
        onClick={() => void menu.toggle()}
        expanded={menu.translations !== null}
        onMouseEnter={(event) => setTooltipTarget(event.currentTarget)}
        onMouseLeave={() => setTooltipTarget(null)}
      />
      {menu.translations && (
        <RatingMenu
          t={menu.translations}
          onRate={onRate}
          onAddWithoutRating={onAddWithoutRating}
          onSelect={menu.close}
        />
      )}
      {tooltipTarget && createPortal(<Tooltip target={tooltipTarget} text={t.app.name} />, document.body)}
    </div>
  );
}
