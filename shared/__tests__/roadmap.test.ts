import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { ROADMAP_IDS, roadmapSchema } from '@/shared/roadmap';

it.each(ROADMAP_IDS)('%s matches the roadmap schema', (id) => {
  const data = JSON.parse(readFileSync(`public/data/roadmaps/${id}.json`, 'utf8'));
  expect(() => roadmapSchema.parse(data)).not.toThrow();
});
