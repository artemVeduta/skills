---
type: Reference
title: mattpocock/skills skill library
description: Example-reference skill library and stated inspiration baseline; snapshot researched at commit 391a270, including its writing-great-skills quality bar and invocation-axis convention.
resource: https://github.com/mattpocock/skills
timestamp: 2026-07-11
---

# mattpocock/skills skill library

[mattpocock/skills](https://github.com/mattpocock/skills) is this library's stated
inspiration baseline (see the wayfinder map, issue #1) and is treated as an
**example-reference project**: we study it and deliberately borrow core ideas, but we
do not depend on it or track its releases. The full primary-source research snapshot
lives in `research/reference-mattpocock-skills.md` (pinned to commit `391a270`,
2026-07-10); this concept records only why the project matters here.

Ideas this library borrows from it:

- **Minimal frontmatter surface.** Across all 39 skills only four keys appear: `name`,
  `description`, `disable-model-invocation`, `argument-hint`. The invocation axis
  (user-invoked vs model-invoked) is one boolean with a hard consequence: user-invoked
  skills cannot be fired by other skills.
- **Progressive disclosure via named sibling files.** Reference material moves out of
  `SKILL.md` into same-folder files named for their content (`GLOSSARY.md`,
  `*-FORMAT.md`, `LOGIC.md`/`UI.md`), linked by relative path — composing cleanly with
  our flat [library structure](/decisions/skill-library-structure.md).
- **A meta-skill as the quality bar.** `writing-great-skills` encodes the authoring
  standard as an invocable, versioned skill with a named failure-mode vocabulary
  (Premature completion, Duplication, Sediment, Sprawl, No-op, Negation) instead of a
  wiki page.
- **Prose-only `/skill-name` cross-references, never cross-skill filesystem paths** —
  independent confirmation of our
  [skill-dependency decision](/decisions/skill-dependencies.md).
- **`~/.agents/skills` as the harness-agnostic install target** alongside
  `~/.claude/skills` in its maintainer link script — a primary-source data point for
  the Agent-Skills convention our
  [distribution channels](/decisions/skill-distribution-channels.md) also target.

Consciously diverged from: bucket folders (we chose a flat tree), the external docs
site, and its **zero automated skill-quality gates** — the repo has no lint, tests, or
CI over skill content, whereas this library is choosing to have some.

# Citations

- https://github.com/mattpocock/skills at commit
  [`391a270`](https://github.com/mattpocock/skills/tree/391a2701dd948f94f56a39f7533f8eea9a859c87)
  (2026-07-10)
- Full research notes with per-claim citations:
  `research/reference-mattpocock-skills.md` (repo root, outside the docs bundle)
- The `npx skills` installer CLI is owned by vercel-labs, not Matt Pocock
  (`npm view skills repository`); its behavior is covered in
  `research/issue-6-npx-dependency-resolution.md`
