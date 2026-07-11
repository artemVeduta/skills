---
type: Reference
title: obra/superpowers skill library
description: Example-reference skill library whose authoring and portability ideas this library deliberately borrows; snapshot researched at v6.1.1 (commit d884ae0).
resource: https://github.com/obra/superpowers
timestamp: 2026-07-11
---

# obra/superpowers skill library

[obra/superpowers](https://github.com/obra/superpowers) is a widely distributed,
multi-harness library of process skills (TDD, debugging, planning). This repository
treats it as an **example-reference project**: we study it and deliberately borrow core
ideas, but we do not depend on it or track its releases. The full primary-source
research snapshot lives in `research/reference-obra-superpowers.md` (pinned to commit
`d884ae0`, v6.1.1); this concept records only why the project matters here.

Ideas this library borrows from it:

- **Trigger-only descriptions.** Frontmatter `description` starts with "Use when…",
  states only triggering conditions, and never summarizes the workflow — backed by
  their documented regression where a workflow-summarizing description made agents
  skip half the skill.
- **Skills name actions, not tools.** Skill bodies describe harness-agnostic actions
  ("dispatch a subagent", "read the file"), never harness-specific tool names — the
  mechanism that lets one skill tree run byte-identical across many harnesses.
- **Cross-skill references with strength markers.** `**REQUIRED SUB-SKILL:**` /
  `**REQUIRED BACKGROUND:**` versus plain optional mentions — an obligation-level
  vocabulary that complements our
  [skill-dependency contract](/decisions/skill-dependencies.md).
- **Baseline-fail before writing.** The RED-phase habit from their TDD-for-skills
  process: watch an agent fail *without* the skill and record the actual failure
  before writing the skill's content.

Consciously not copied: the seven-manifest plugin/marketplace machinery (our
[distribution decision](/decisions/skill-distribution-channels.md) covers packaging),
their unenforced word-count targets, and the adversarial rationalization-proofing tone
sized for a widely-shared library. Notably, they run **no CI lint over skill content**;
behavioral evaluation lives in a separate evals repo.

# Citations

- https://github.com/obra/superpowers at commit
  [`d884ae0`](https://github.com/obra/superpowers/commit/d884ae04edebef577e82ff7c4e143debd0bbec99)
  (v6.1.1, 2026-07-02)
- Full research notes with per-claim citations:
  `research/reference-obra-superpowers.md` (repo root, outside the docs bundle)
