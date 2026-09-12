// Historical contracts stay local: current card validation must not change this upgrade.
type PreservedCard = null | undefined | string | number | boolean | unknown[];
type HistoricalCard = Record<string, unknown> | PreservedCard;

export interface Input extends Record<string, unknown> {
  cards?: Record<string, HistoricalCard>;
}

export interface Output extends Record<string, unknown> {
  // Non-object records and truthy malformed domains are deliberately preserved.
  cards?: Record<string, (Record<string, unknown> & { domain: NonNullable<unknown> }) | PreservedCard>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateInput(data: unknown): asserts data is Input {
  if (!isRecord(data) || (data.cards !== undefined && !isRecord(data.cards))) {
    throw new Error('Migration 1 requires a dataset with an optional cards object');
  }
  for (const card of Object.values(data.cards ?? {})) {
    if (!['undefined', 'object', 'string', 'number', 'boolean'].includes(typeof card)) {
      throw new Error('Migration 1 encountered a non-JSON card');
    }
  }
}

export function validateOutput(data: unknown): asserts data is Output {
  validateInput(data);
  for (const card of Object.values(data.cards ?? {})) {
    if (isRecord(card) && (!Object.hasOwn(card, 'domain') || !card.domain)) {
      throw new Error('Migration 1 must give every object card a truthy domain');
    }
  }
}

function transform(data: Input) {
  if (data.cards === undefined) return data;
  const cards = Object.fromEntries(
    Object.entries(data.cards).map(([slug, card]) => [
      slug,
      isRecord(card) ? { ...card, domain: card.domain || 'leetcode.com' } : card,
    ])
  );
  return { ...data, cards };
}

export function convert(data: unknown): Output {
  validateInput(data);
  const output = transform(data);
  validateOutput(output);
  return output;
}
