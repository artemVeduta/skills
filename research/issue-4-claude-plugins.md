# Claude Code plugins and marketplaces for `artemVeduta/skills`

Research date: 2026-07-10

## Executive conclusion

Keep `skills/<name>/SKILL.md` as the portable source of truth and add a thin
Claude-native distribution layer. The least-complex first design is one aggregate
plugin rooted at this repository:

```text
skills/
├── .claude-plugin/
│   ├── marketplace.json
│   └── plugin.json
├── skills/
│   └── <name>/SKILL.md
└── scripts/
```

The marketplace can list one plugin with `"source": "./"`; the plugin's default
`skills/` scan then exposes the existing portable skills without copies or generated
mirrors. Anthropic explicitly documents marketplace-root plugin sources and the
default `skills/` scan. A marketplace-root entry can use the whole `skills/` folder,
while listing narrower paths makes those paths the complete skill set for that entry
([marketplace root sources and skill paths](https://code.claude.com/docs/en/plugin-marketplaces#advanced-plugin-entries)).

This produces namespaced Claude commands such as `/artem-skills:okf-docs-setup`.
The current symlink installer can remain available for people and non-Claude
harnesses that want plain skills, live working-copy updates, or unnamespaced commands.

## Canonical package layout

A plugin is a self-contained directory. Its optional manifest is
`.claude-plugin/plugin.json`; if present, `name` is the only required field. Default
component locations such as `skills/`, `agents/`, `hooks/`, `.mcp.json`, and
`.lsp.json` are siblings of `.claude-plugin/`, not children of it
([plugin manifest and layout reference](https://code.claude.com/docs/en/plugins-reference#plugin-manifest-schema),
[plugin structure guide](https://code.claude.com/docs/en/plugins#plugin-structure-overview)).

A marketplace repository has `.claude-plugin/marketplace.json` at its root. The
catalog requires a marketplace `name` and a `plugins` array; each plugin entry needs
at least `name` and `source`. A relative source starts with `./` and resolves from the
marketplace root, not from `.claude-plugin/`
([marketplace schema](https://code.claude.com/docs/en/plugin-marketplaces#create-the-marketplace-file),
[relative sources](https://code.claude.com/docs/en/plugin-marketplaces#relative-paths)).
Anthropic's official marketplace uses the same catalog and source forms in practice,
including relative plugin directories and pinned `git-subdir` sources
([official marketplace catalog](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)).

For this repository, the minimal manifests would conceptually be:

`.claude-plugin/plugin.json`:

```json
{
  "name": "artem-skills",
  "description": "Portable agent skills packaged for Claude Code"
}
```

`.claude-plugin/marketplace.json`:

```json
{
  "name": "artem-veduta",
  "owner": { "name": "Artem Veduta" },
  "plugins": [
    {
      "name": "artem-skills",
      "source": "./",
      "description": "Portable agent skills packaged for Claude Code"
    }
  ]
}
```

This is a proposed repository design, not a claim that those identifiers already
exist. It deliberately omits `version`: for a relative source in a git-hosted
marketplace, Claude Code then uses the source commit SHA as the version, so every new
commit is updateable. If an explicit version is added later, it must be bumped for
users to receive changes
([version resolution](https://code.claude.com/docs/en/plugin-marketplaces#version-resolution-and-release-channels)).

An alternative is one marketplace plugin per portable skill, with entries sourced
from `./skills/<name>` and configured as single-skill plugins. That permits selective
installation and smaller cache copies, but duplicates catalog metadata and release
surface for every skill. It should wait until independent installation is a concrete
requirement.

## How plugin skills are exposed

Plugin skills are discovered automatically from
`<plugin>/skills/<skill>/SKILL.md`; Claude can invoke them based on task context, and
users can invoke them explicitly. A plugin may also expose one root `SKILL.md` as a
single skill. Installed plugin skills are namespaced with the plugin name to prevent
collisions, for example `/quality-review-plugin:quality-review`
([plugin skills reference](https://code.claude.com/docs/en/plugins-reference#skills),
[marketplace walkthrough](https://code.claude.com/docs/en/plugin-marketplaces#walkthrough-create-a-local-marketplace)).

This differs intentionally from plain skills. A directory such as
`~/.claude/skills/foo/SKILL.md` is a plain skill named `foo`; if that same directory
contains `.claude-plugin/plugin.json`, Claude treats it as an in-place
`foo@skills-dir` plugin. Marketplace plugins, by contrast, are copied into a versioned
plugin cache
([skills-directory plugins](https://code.claude.com/docs/en/plugins-reference#skills-directory-plugins),
[plugin cache behavior](https://code.claude.com/docs/en/plugins-reference#plugin-caching-and-file-resolution)).

Implications for this repo:

- Do not move or rewrite the portable `skills/<name>/SKILL.md` files for Claude.
- Do not install both the aggregate marketplace plugin and the same plain symlinked
  skills into one profile unless duplicate capability listings are acceptable.
- Marketplace installation is snapshot/cache based, not the current installer's
  live symlink behavior. Files outside the plugin root cannot be referenced with
  `../`; a root-sourced aggregate plugin avoids that boundary problem. Claude copies
  marketplace plugins to its cache, and old versions are retained as orphaned cache
  entries for seven days before cleanup
  ([cache and path rules](https://code.claude.com/docs/en/plugins-reference#plugin-caching-and-file-resolution)).
- Because `source: "./"` copies the plugin from the repository root, unrelated repo
  material may also enter the cache. This is acceptable for a small initial package;
  if cache size becomes material, introduce a dedicated plugin wrapper. Anthropic
  documents that symlinks from a plugin to content elsewhere in the same marketplace
  are dereferenced into the cache, which can support such a wrapper later
  ([symlinks in marketplaces](https://code.claude.com/docs/en/plugins-reference#share-files-within-a-marketplace-with-symlinks)).

## Installation, validation, and updates

After the manifests exist in the GitHub repository, the non-interactive flow would
be:

```sh
claude plugin validate .
claude plugin marketplace add artemVeduta/skills
claude plugin install artem-skills@artem-veduta
```

The interactive equivalents are `/plugin marketplace add`, `/plugin install`, and
`/plugin validate`. Claude accepts GitHub `owner/repo`, full git URLs, local
directories, and direct marketplace JSON URLs. Relative plugin sources work with a
git or local-directory marketplace, but not a direct JSON URL because only the JSON
file is downloaded
([marketplace add and source forms](https://code.claude.com/docs/en/discover-plugins#add-marketplaces),
[validation](https://code.claude.com/docs/en/plugin-marketplaces#validation-and-testing)).

Installation is user-scoped by default. `--scope project` records the enabled plugin
in `.claude/settings.json`; `--scope local` uses
`.claude/settings.local.json`. Project configuration can recommend a marketplace via
`extraKnownMarketplaces` and enable a plugin via `enabledPlugins`, but each collaborator
still receives an install-and-trust prompt rather than silently executing external
plugin content
([installation scopes](https://code.claude.com/docs/en/plugins-reference#plugin-installation-scopes),
[team marketplace configuration](https://code.claude.com/docs/en/discover-plugins#configure-team-marketplaces)).

Manual refresh/update commands are distinct:

```sh
claude plugin marketplace update artem-veduta
claude plugin update artem-skills@artem-veduta
```

The first refreshes the catalog; the second installs the plugin's latest resolved
version. Third-party and local-development marketplaces have startup auto-update off
by default, while official Anthropic marketplaces have it on. Users can toggle it in
the marketplace UI
([marketplace update CLI](https://code.claude.com/docs/en/plugin-marketplaces#plugin-marketplace-update),
[plugin update CLI](https://code.claude.com/docs/en/plugins-reference#plugin-update),
[auto-update behavior](https://code.claude.com/docs/en/discover-plugins#configure-auto-updates)).
After installing or updating during a running session, `/reload-plugins` applies the
change without a restart
([reload plugins](https://code.claude.com/docs/en/discover-plugins#apply-plugin-changes-without-restarting)).

## Custom configuration roots and profiles

`CLAUDE_CONFIG_DIR` is the supported profile-root mechanism. Its default is
`~/.claude`; the official environment-variable reference states that settings,
credentials, session history, and plugins live below the selected path and explicitly
gives side-by-side accounts as a use case:

```sh
alias claude-work='CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude'
```

([`CLAUDE_CONFIG_DIR` reference](https://code.claude.com/docs/en/env-vars),
[configuration-directory map](https://code.claude.com/docs/en/claude-directory)).

Therefore `~/.claude-work` is not a separately auto-discovered conventional profile.
It becomes a Claude profile only when the process is launched with
`CLAUDE_CONFIG_DIR=~/.claude-work`. Under that launch, the current installer's
`~/.claude-work/skills` target is the correct personal plain-skills directory, and
marketplace/plugin state belongs under `~/.claude-work/plugins`. A normal `claude`
launch continues to use `~/.claude`.

Each root can independently add/install/update the marketplace:

```sh
claude plugin marketplace add artemVeduta/skills
claude plugin install artem-skills@artem-veduta

CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude plugin marketplace add artemVeduta/skills
CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude plugin install artem-skills@artem-veduta
```

`CLAUDE_CODE_PLUGIN_CACHE_DIR` is a separate, lower-level override for the entire
plugins root (marketplaces and cache, despite its name). Leave it unset when profile
isolation is desired; use it only when intentionally relocating or pre-populating
plugin storage, such as container seed construction
([plugin storage environment variables](https://code.claude.com/docs/en/env-vars),
[container seed layout](https://code.claude.com/docs/en/plugin-marketplaces#pre-populate-plugins-for-containers)).

One nuance is authentication: the environment reference describes credentials as
profile-root data, while the authentication guide says macOS stores credentials in
Keychain and Linux/Windows use `.credentials.json` under the selected config root.
Thus plugin/settings/history separation is clearly documented across platforms, but
multiple-login behavior on macOS should be verified against the installed Claude Code
version before promising completely isolated credentials
([credential storage](https://code.claude.com/docs/en/authentication#credential-management)).

## Recommended implementation sequence

1. Add `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` at repo root
   with one aggregate root-sourced plugin and no explicit version.
2. Validate both the marketplace root and plugin root with
   `claude plugin validate .`; test from a disposable config root so existing personal
   and work profiles are untouched.
3. Document the two distribution modes separately: portable/live symlink install via
   `scripts/install.sh`, and Claude-native cached/versioned install via the marketplace.
4. Document that the `~/.claude-work` target requires launching Claude with
   `CLAUDE_CONFIG_DIR=~/.claude-work`; the directory name alone has no profile
   semantics.
5. Add per-skill marketplace entries only if users actually need selective Claude
   installation. Until then, one manifest pair is the single source of Claude package
   metadata and keeps the portable skill tree unchanged.
