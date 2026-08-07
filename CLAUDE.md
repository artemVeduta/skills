# Skills — Repo Guide

Skills are organized flat under `skills/`. Every skill has a `SKILL.md` that defines its triggers, behavior, and invocation rules.

Each skill is either **user-invoked** (reachable only when typed, e.g. `/grill-me`) or **model-invoked** (agent can reach for it automatically when the task fits).

## Directory Layout

```
.
├── .agents/           — Internal docs (ADRs, invocation rules, docs templates)
├── .claude-plugin/    — Claude Code plugin manifest
├── .codex-plugin/     — Codex plugin manifest
├── .opencode/         — OpenCode plugin + install instructions
├── skills/            — All 53 skills (flat, one directory per skill)
├── scripts/           — Dev scripts (link-skills, list-skills, bump-version)
├── docs/              — External docs and per-harness READMEs
├── hooks/             — Git hooks
├── assets/            — Plugin assets (icons, logos)
├── AGENTS.md          — This file
└── CLAUDE.md          — Same as AGENTS.md
```

## Skill Rules

- Every skill in `skills/` must have a `SKILL.md` at its root.
- Every skill must appear in the top-level `README.md`.
- User-invoked skills set `disable-model-invocation: true`. See [.agents/invocation.md](.agents/invocation.md).
- The `.claude-plugin/plugin.json` lists no explicit skills array — auto-discovery finds all `SKILL.md` files under `skills/`.

## Plugin Manifests

- `.claude-plugin/plugin.json` — Claude Code plugin manifest (auto-discovery mode)
- `.claude-plugin/marketplace.json` — Self-hosted marketplace entry
- `.codex-plugin/plugin.json` — Codex plugin manifest
- `.opencode/plugins/superpowers.js` — OpenCode runtime bootstrap

## Linking Skills (Local Dev)

To symlink every skill into your local harness directories:

```bash
scripts/link-skills.sh
```

Each entry is a symlink into this repo. `git pull` keeps installed skills current.

## Install Commands

Install commands are documented in the top-level [README.md](README.md). Keep them in sync.

## Contributing

1. Follow [writing-skills](skills/writing-skills/SKILL.md) for creating new skills.
2. Skills must work across supported harnesses (Claude Code, Codex, OpenCode).
3. Test changes locally before submitting.

## Sources

This repo merges skills from:
- [obra/superpowers](https://github.com/obra/superpowers) (MIT)
- [mattpocock/skills](https://github.com/mattpocock/skills) (MIT)
