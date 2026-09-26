import { useI18n } from '@/popup/contexts/I18nContext';
import type { CatalogProblem } from '@/shared/catalog';

interface DifficultyProps {
  difficulty: CatalogProblem['difficulty'];
  /** `quiet` colors only the dot, so a colored label beside it stays distinct. */
  tone?: 'color' | 'quiet';
}

export function Difficulty({ difficulty, tone = 'color' }: DifficultyProps) {
  const t = useI18n();
  const color = `var(--current-difficulty-${difficulty})`;
  const isQuiet = tone === 'quiet';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-xs ${isQuiet ? 'text-secondary' : ''}`}
      style={isQuiet ? undefined : { color }}
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-current"
        style={isQuiet ? { backgroundColor: color } : undefined}
      />
      {t.difficulty[difficulty]}
    </span>
  );
}
