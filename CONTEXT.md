# LeetSRS

LeetSRS helps learners retain LeetCode problem-solving knowledge through spaced repetition.

## Language

**Problem**:
A LeetCode exercise, with a title, difficulty, and regional site.

**Card**:
A problem a learner tracks in LeetSRS, together with its review schedule and learning progress.

**Review**:
A rated attempt at a problem that updates its card's schedule and the learner's review statistics.

**Rating**:
The learner's assessment of a review: Again, Hard, Good, or Easy. This is distinct from the problem's Easy, Medium, or Hard difficulty.

**New card**:
A card that has not yet received its first rating.

**Paused card**:
A tracked card excluded from the review queue until the learner resumes it.

**Review day**:
A local day beginning at the learner's configured day-start hour, used for due-card eligibility and daily review statistics.

**Review queue**:
The ordered set of unpaused cards due by the current review day, with new cards limited by the remaining daily allowance.

**Note**:
The learner's text attached to a card.

**Backup**:
An exported snapshot of cards, notes, review statistics, settings, and Gist configuration that can be restored into LeetSRS.
