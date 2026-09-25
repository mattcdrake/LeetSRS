import { useI18n } from '@/popup/contexts/I18nContext';
import type { CatalogProblem } from '@/shared/catalog';

export function Difficulty({ difficulty }: { difficulty: CatalogProblem['difficulty'] }) {
  const t = useI18n();
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-xs"
      style={{ color: `var(--current-difficulty-${difficulty})` }}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {t.difficulty[difficulty]}
    </span>
  );
}
