import { expect, it } from 'vitest';
import catalog from '@/public/data/leetcode-catalog.json';
import { translations } from '@/shared/i18n';

it('provides an English display label for every bundled catalog topic', () => {
  const topics = new Set(catalog.flatMap((problem) => problem.topics));
  const missing = [...topics].filter((topic) => {
    const label = translations.en.topicLabel(topic);
    return !label.trim() || label === topic;
  });
  expect(missing).toEqual([]);
});
