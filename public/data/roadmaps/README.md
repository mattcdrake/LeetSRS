# Curated roadmaps

Each JSON file contains an `id`, display `name`, `sourceUrl`, and ordered `groups` array.
Each group contains an `id`, display `name`, and ordered `frontendIds` array.
These IDs are canonical string references to `../leetcode-catalog-by-id.json`.
The resolved problem's `slug` identifies the same record in `../leetcode-catalog-by-slug.json`.
Read titles, difficulty, topics, paid status, and available domains from those catalogs.

Array positions define both group order and problem order within each group. Flatten
the groups' `frontendIds` arrays to get the full roadmap sequence. A problem appears
only once within each roadmap.

NeetCode groups preserve the source's topic names; group IDs use kebab case with `&`
written as `and`. Blind 75 uses NeetCode's grouping. Grind 75 uses `week-1` through
`week-8`, named `Week 1` through `Week 8`. General problem topics come from the catalogs,
so roadmap entries do not duplicate tags or other problem metadata.

Sources checked on September 16, 2026:

| File                                   | Source and ordering                                                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [blind-75.json](blind-75.json)         | [NeetCode's Blind 75](https://neetcode.io/practice/practice/blind75), in displayed topic and problem order.                                         |
| [neetcode-150.json](neetcode-150.json) | [NeetCode 150](https://neetcode.io/practice/practice/neetcode150), in displayed topic and problem order.                                            |
| [neetcode-250.json](neetcode-250.json) | [NeetCode 250](https://neetcode.io/practice/practice/neetcode250), in displayed topic and problem order.                                            |
| [grind-75.json](grind-75.json)         | [Grind 75](https://www.techinterviewhandbook.org/grind75/), default 8 weeks / 8 hours per week, all topics and difficulties, ordered by difficulty. |

To refresh, resolve each source's LeetCode problem slug through the bundled catalog,
preserve the source groups and ordering, and run `npm test -- shared/__tests__/roadmap.test.ts`.
