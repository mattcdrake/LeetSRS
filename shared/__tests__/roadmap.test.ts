import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { roadmapSchema } from '@/shared/roadmap';

it.each(['blind-75', 'neetcode-150', 'neetcode-250', 'grind-75'])('%s matches the roadmap schema', (id) => {
  const data = JSON.parse(readFileSync(`public/data/roadmaps/${id}.json`, 'utf8'));
  expect(() => roadmapSchema.parse(data)).not.toThrow();
});
