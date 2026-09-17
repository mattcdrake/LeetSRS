---
name: doc-coauthoring
description: Co-author documentation, proposals, technical specs, and other substantial documents through context gathering, focused drafting, and reader review. Use when asked to draft or collaboratively refine a document; handle small copy edits directly.
---

<!-- Adapted from https://github.com/getsentry/skills/tree/main/skills/doc-coauthoring.
Local changes: remove platform-specific tools and services; scale questions,
drafting, and reader review to the task; preserve the user's requested scope.
See LICENSE. -->

# Doc Co-Authoring

Use three stages when they help: gather context, refine the draft, and check it from the reader's perspective. Start at the stage the task needs; a clear brief or existing draft does not require an interview. Follow the user's preferred workflow and proceed without approval between routine stages.

## 1. Gather Context

Read the requested document, supplied material, relevant repository instructions, and existing sources before asking questions. Establish:

- The audience and what they should understand, decide, or do after reading.
- The problem, intended outcome, and scope.
- Any required format, template, length, or terminology.
- The facts, constraints, and trade-offs that affect the document.

Infer what is clear from the request. Ask only questions whose answers would materially change the draft, preferably in a small batch. Accept shorthand, rough notes, links, or direct edits; do not make the user reorganize their input first.

Use available read tools for relevant sources. If a source is inaccessible, identify the specific gap and ask for the needed excerpt when it matters. Do not require a particular service, connector, or account.

Distinguish established facts from proposals and unresolved decisions. Verify technical claims against source code or primary references where possible. If a missing answer does not block useful drafting, make the assumption visible and continue.

## 2. Refine and Draft

Use the existing structure or supplied template when it fits. Otherwise choose the fewest sections the reader needs. For a substantial document, draft the core proposal or technical approach first and write the summary after the substance is settled.

- Brainstorm alternatives only when there is a real choice to make; do not generate fixed quotas of questions or options.
- Explain consequential structural choices briefly. Routine organization does not need approval.
- Create or edit the requested artifact using the available file or document tools. Do not create additional documentation merely to follow this workflow.
- Draft from the gathered evidence, keeping supporting detail where the reader needs it and linking to existing references instead of duplicating them.
- Mark unresolved facts or decisions specifically; do not fill gaps with invented rationale or present a proposal as implemented behavior.
- Apply feedback through focused edits. Learn from the user's direct edits as well as comments, and preserve unrelated content.
- Share a link to the current artifact when available and summarize material changes without reprinting the entire document.

For long documents, iterate section by section when the user wants that collaboration. For a clear request, produce a complete draft directly. Avoid repeated requests to confirm that a section is done or to authorize the next section.

After drafting, read the document as a whole for contradictions, missing context, repetition, unsupported claims, and unnecessary detail. Explain the important trade-offs rather than cataloging every imaginable alternative.

## 3. Check the Reader's Perspective

Check whether the document stands on its own for its intended audience. Choose a few realistic questions a reader would use it to answer, such as:

- What problem is being solved, and what action or decision is expected?
- What changes, and which constraints or trade-offs matter?
- What remains unresolved, and where can supporting evidence be found?

For substantial documents, an independent reviewer can expose assumptions shared by the author and user. If subagents are available and the review adds value, give one reviewer the document, intended audience, and relevant reader questions without the drafting conversation. Ask it to answer from the document and identify missing context, ambiguity, or contradictions. Batch the questions in one review rather than spawning an agent for each question.

If independent review is unavailable or disproportionate to the edit, review the document yourself against those questions. Do not require the user to start another chat or claim independent testing occurred.

Fix consequential gaps and recheck the affected passages. Stop when the document answers the intended questions and remaining uncertainties are explicit; do not loop on cosmetic preferences.

## Finish

- Verify affected links, paths, commands, and factual claims.
- Follow the repository's documentation formatting and validation rules.
- Provide the artifact link and briefly note material unresolved questions or verification limits.
- Leave further review available without making an extra approval round a condition of completing the requested draft.

## Attribution

Original coauthoring workflow credited to Anthropic by the [upstream skill](https://github.com/getsentry/skills/tree/main/skills/doc-coauthoring).
