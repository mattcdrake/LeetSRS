import type { CatalogProblem } from '@/shared/catalog';

export function Difficulty({ difficulty }: { difficulty: CatalogProblem['difficulty'] }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs capitalize"
      style={{ color: `var(--current-difficulty-${difficulty})` }}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {difficulty}
    </span>
  );
}
