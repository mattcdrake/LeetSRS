import { expect, it } from 'vitest';
import catalog from '@/public/data/leetcode-catalog.json';
import { translations } from '@/shared/i18n';

it.each([
  ['zh-CN', 'a-search', 'A* Search'],
  ['en', 'unknown-topic', 'unknown-topic'],
] as const)('labels %s topic %s as %s', (language, topic, label) => {
  expect(translations[language].topicLabel(topic)).toBe(label);
});

it('provides an English display label for every bundled catalog topic', () => {
  const topics = new Set(catalog.flatMap((problem) => problem.topics));
  const missing = [...topics].filter((topic) => {
    const label = translations.en.topicLabel(topic);
    return !label.trim() || label === topic;
  });
  expect(missing).toEqual([]);
});
