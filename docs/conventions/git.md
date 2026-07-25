---
type: Convention
title: Git workflow
description: Branch, remote, and commit-message conventions for this repository.
timestamp: 2026-07-25
---

# Git workflow

- Default branch is `main`; remote is `github.com/artemVeduta/skills.git`.
- **Commit subjects are imperative prose, from 2026-07-25 onward.** Write the
  subject as an instruction ("Retire the Claude authoring adapter"), not as a
  conventional-commit prefix (`feat:`, `docs:`, …). This is a **prospective**
  convention: it binds new commits only.
- **Existing history is not evidence of it, and is not rewritten.** Commits made
  before the adoption point — including the prefixed pull-request landing
  commits — stay exactly as they are. Rewriting or rebasing existing commits to
  conform is out of scope; a mixed history is the expected and accepted state.

## Rationale

A single default branch and one imperative commit style keep new history
readable for a small personal skills library without ceremony. The convention is
prospective because the value is in future consistency, and rewriting shared
history to buy retroactive consistency costs more than it is worth.
