# Issue 4 research: portable installation for OpenCode and Antigravity

Research snapshot: **2026-07-10**. The CLI source inspected is
`vercel-labs/skills` **v1.5.15**, commit
[`4ce6d48`](https://github.com/vercel-labs/skills/tree/4ce6d48ac44c8b637db87b2102fea3baca719df1).
Only first-party sources are used below: `skills.sh`, the CLI repository, OpenCode,
and Google.

## Bottom line

The proposed categories are sound only with a scope qualifier:

1. **Codex-native plugin:** install through Codex's plugin mechanism, not `npx skills`.
2. **Claude-native plugin:** install through Claude's plugin mechanism, not `npx skills`.
3. **Portable standalone skill:** use the Agent Skills format and prefer
   **project-local `.agents/skills`** for the remaining compatible harnesses.

`npx skills` manages `SKILL.md` skill bundles; its documented inputs and install flow are
skills, not Codex or Claude plugin manifests. The CLI's supported-agent table does include
Codex and Claude Code as *skill targets*, but that is distinct from installing a native
plugin ([CLI README, supported targets](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/README.md#L242-L289)).

`.agents/skills` is a strong **project-level interoperability convention**, but it is not
a universal global directory. OpenCode explicitly discovers both project and global
`.agents/skills`; Antigravity officially documents project `.agents/skills`, while its
global locations vary by product and current Google documentation. Consequently,
“everything else via `.agents`” should mean **portable project skills**, not “one global
directory guaranteed to work in every harness.”

## What the official CLI actually installs

### Canonical store and links

In symlink mode, the CLI does **not** link an agent directly to the source repository.
It first copies the selected skill into a canonical store:

- project: `<project>/.agents/skills/<skill>`;
- global: `~/.agents/skills/<skill>`.

It then creates a per-skill symlink from an agent-specific directory to that canonical
copy when the agent is not classified as “universal.” Agents whose project `skillsDir`
is `.agents/skills` use the canonical directory directly and receive no redundant
symlink. If symlink creation fails, the CLI falls back to a copy
([canonical path and install algorithm](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/installer.ts#L98-L120),
[copy/link/fallback behavior](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/installer.ts#L289-L411)).

The README describes symlinks as the recommended single-source-of-truth method and
`--copy` as independent copies. The implementation prompts for the method only when
selected agents have multiple distinct project skill directories; if every selected
agent shares one directory, it defaults to copying directly there because a symlink has
no value ([documented methods](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/README.md#L94-L104),
[method selection](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/add.ts#L751-L778)).

This differs materially from this repository's `scripts/install.sh`: the local script
links each target directly to `skills/<name>` in the working copy, so edits are live and
no fetch/update step exists. Migrating to `npx skills` would change that contract to a
**copied snapshot in the canonical store**, optionally linked onward to native agent
directories.

### OpenCode paths

The CLI advertises OpenCode as:

| Scope | Published target |
| --- | --- |
| Project | `.agents/skills/` |
| Global native path | `~/.config/opencode/skills/` |

([CLI supported-agent table](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/README.md#L465-L510)).

OpenCode itself confirms a broader discovery contract. It loads project skills from
`.opencode/skills`, `.claude/skills`, and `.agents/skills`, and global skills from
`~/.config/opencode/skills`, `~/.claude/skills`, and `~/.agents/skills`
([OpenCode skill locations and discovery](https://opencode.ai/docs/skills/#place-files)).
Therefore the CLI's actual global canonical placement at `~/.agents/skills` is valid for
OpenCode even though the README table names OpenCode's native global directory.

### Antigravity paths and the important product split

The CLI models two targets:

| Target | Project path | Published native global path |
| --- | --- | --- |
| Antigravity | `.agents/skills/` | `~/.gemini/antigravity/skills/` |
| Antigravity CLI | `.agents/skills/` | `~/.gemini/antigravity-cli/skills/` |

([CLI table](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/README.md#L465-L474),
[agent definitions](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/agents.ts#L62-L84)).

Google's current general Antigravity codelab instead documents project
`<project>/.agents/skills` and global `~/.gemini/config/skills`, with the latter described
as available across Antigravity products
([Google, “Structure and Scope”](https://codelabs.developers.google.com/getting-started-google-antigravity#9)).
Google's dedicated Vercel-CLI integration note adds the operational caveat: `npx skills`
places global skills in `~/.agents/skills`; Antigravity picks them up there, but
**Antigravity CLI does not**, and its skills must be placed in a project or its native
global directory
([Google, “Installing Agent Skills using npx skills”](https://codelabs.developers.google.com/getting-started-with-antigravity-skills?hl=en#7)).

There is also an implementation/documentation mismatch in v1.5.15: both Antigravity
targets are classified as universal because their *project* path is `.agents/skills`.
For any universal agent, `getAgentBaseDir` returns the canonical `.agents/skills` path
even for global installs, and the installer explicitly skips a native-global symlink
([universal classification](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/agents.ts#L763-L805),
[global universal short-circuit](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/installer.ts#L362-L371)).
Thus a v1.5.15 global install targeting `antigravity-cli` still lands in
`~/.agents/skills`; selecting `--copy` does not repair that routing. Project-local
`.agents/skills` is the portable, verified option. A global Antigravity CLI install
requires a separate copy/link to the product's currently supported global directory and
should be verified against the installed product version.

### Is `.agents` truly universal?

No. “Universal” is the CLI's label for agents configured with the same **project**
`skillsDir` value; many supported agents use other project directories and need links
from the canonical store. The supported-agent table contains numerous examples such as
Claude Code (`.claude/skills`), OpenHands (`.openhands/skills`), and Pi
(`.pi/skills`) ([full table](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/README.md#L462-L529)).
Even among `.agents` consumers, global discovery can differ. Harness-owned documentation,
not the CLI's “Universal” label, is authoritative.

## Selection and interactive flow

`npx skills add <source>` performs these choices in order:

1. Discover skills and, when necessary, prompt for the skills to install.
2. Detect installed agents. With multiple detected agents, the interactive selector
   shows `.agents/skills` consumers in a locked “Universal” section and lets the user
   select other agent-specific targets. The selection is remembered for later prompts
   ([interactive selector](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/add.ts#L425-L538)).
3. Prompt for project versus global scope unless the choice was supplied.
4. Prompt for symlink versus copy only when multiple distinct target directories exist.
5. Show an overwrite summary and request confirmation.

Important consequences:

- An explicit `-a opencode -a antigravity` is deterministic, but both names resolve to
  the same project `.agents/skills` location, so the skill is physically installed once.
  Every compatible harness that scans that directory can see it, regardless of the two
  labels supplied.
- `-y` is broader than “accept prompts”: when agents are auto-detected, the code adds all
  universal targets; when none are detected, it selects all agents. Use explicit
  `--agent` and `--skill` flags in automation
  ([auto-selection](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/add.ts#L650-L718)).
- `--all` means all discovered skills to all agents, not merely “skip confirmation”
  ([CLI options and examples](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/README.md#L48-L89)).

## Update semantics

The CLI has separate state for each scope:

- global lock: `$XDG_STATE_HOME/skills/.skill-lock.json`, falling back to
  `~/.agents/.skill-lock.json`; it records source, ref, source subpath, folder hash, and
  timestamps ([global lock schema and path](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/skill-lock.ts#L10-L104));
- project lock: `<project>/skills-lock.json`, intended for version control; it records
  source, ref, source subpath, and a content hash
  ([project lock schema](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/local-lock.ts#L6-L86)).

`skills update` can target global (`-g`), project (`-p`), named skills, or auto-detected
scope with `-y` ([documented command](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/README.md#L147-L172)). It compares tracked
folder hashes, then refreshes a changed skill by invoking `skills add` again. Global
updates invoke `add ... -g -y`; project updates invoke `add ... --skill <name> -y`
([global refresh](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/update.ts#L284-L478),
[project refresh](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/update.ts#L480-L632)).

Neither ordinary lock entry records the original agent selection (the project lock only
has special placement state for Eve subagents). Updates therefore re-detect current
targets rather than reproducing an immutable original target set. Older project entries
without `skillPath` cannot be updated in place and must be reinstalled. Refreshing cleans
and recreates the canonical skill directory, so downstream per-skill symlinks continue to
point at the refreshed snapshot.

## Concrete implications for this repository

1. Keep **plugin distribution** separate from **portable skill distribution**. The
   Vercel CLI is appropriate only for the latter; it should not replace native Codex or
   Claude plugin installers.
2. The portable project command for the current top-level skill is:

   ```sh
   npx skills add . --skill okf-docs-setup \
     --agent opencode --agent antigravity -y
   ```

   That creates `.agents/skills/okf-docs-setup` plus project update metadata. Because
   both targets share the directory, it is a canonical copy, not a symlink back to this
   checkout.
3. `npx skills add .` discovers `skills/okf-docs-setup/SKILL.md`. Once it finds that
   parent skill it does not descend through its bundled `assets/` tree, so the nested
   Claude helper `SKILL.md` files remain children rather than being offered as standalone
   skills. This matches this repo's glossary and `install.sh` contract
   ([discovery priority and stop-at-skill behavior](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/skills.ts#L207-L261)).
4. Retain the current `scripts/install.sh` if the desired developer experience is
   “edit this checkout and every installed harness changes immediately.” Adopt
   `npx skills` if the desired experience is package-like snapshots, a checked-in project
   lock, source fetching, and explicit updates. These are different lifecycle contracts,
   not interchangeable implementations.
5. For global portability, document targets individually. OpenCode is safe through
   `~/.agents/skills`; Antigravity IDE currently has Google-documented support there, but
   Google names `~/.gemini/config/skills` as its cross-product global scope; Antigravity
   CLI requires its own supported global path. Do not market `~/.agents/skills` as a
   universal global install.

