import type { CatalogProblem } from '@/shared/catalog';
import { DIFFICULTY_COLORS } from '@/shared/ui/difficulty-colors';

export function Difficulty({ difficulty }: { difficulty: CatalogProblem['difficulty'] }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs capitalize"
      style={{ color: DIFFICULTY_COLORS[difficulty] }}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {difficulty}
    </span>
  );
}
