# Codex-native plugin packaging for `artemVeduta/skills`

Research date: 2026-07-10. Sources are current OpenAI product documentation, the bundled OpenAI `plugin-creator` materials, Codex CLI 0.133.0 help, and OpenAI Codex source at commit [`b45fef0`](https://github.com/openai/codex/tree/b45fef0774a02f4107ccab9eb22d81f8c866c474).

## Conclusion

The repository can remain a portable, flat skill library and also become one Codex-native, skills-only plugin without duplicating any skill directories. Put `.codex-plugin/plugin.json` at the repository root and point its `skills` field at the existing `./skills/` tree. Add a repo marketplace at `.agents/plugins/marketplace.json` whose single local entry points back to `./` (the plugin root). This preserves `scripts/install.sh` and its symlink-based portable installation while adding Codex marketplace installation.

For remote consumers, the repository is not installed as a bare plugin URL. It is first registered as a marketplace, then its plugin entry is installed:

```sh
codex plugin marketplace add artemVeduta/skills
codex plugin add artem-veduta-skills@artem-veduta
```

`codex plugin marketplace add` accepts GitHub shorthand, Git URLs, SSH URLs, and local marketplace roots; `codex plugin add` accepts only a plugin selector from a configured marketplace. Thus a GitHub repository can be consumed directly as a **marketplace source**, but there is no documented `codex plugin add owner/repo` direct-plugin form. The marketplace CLI supports `--ref` pinning and sparse checkout for Git-backed marketplace repositories. ([OpenAI: Build plugins, “Add a marketplace from the CLI”](https://developers.openai.com/codex/plugins/build#add-a-marketplace-from-the-cli))

## Package and manifest contract

Every plugin has exactly one required entry point: `.codex-plugin/plugin.json`. Optional components live at the plugin root, not inside `.codex-plugin/`: `skills/`, `hooks/`, `.app.json`, `.mcp.json`, and `assets/`. Manifest paths are relative to the plugin root, begin with `./`, and stay inside the plugin root. ([OpenAI: plugin structure and path rules](https://developers.openai.com/codex/plugins/build#plugin-structure))

A minimal skills-only manifest for this repository is therefore:

```json
{
  "name": "artem-veduta-skills",
  "version": "0.1.0",
  "description": "Portable reusable agent workflows from artemVeduta/skills.",
  "skills": "./skills/"
}
```

The public docs call `.codex-plugin/plugin.json` the required entry point and describe the other manifest fields as optional, while recommending richer publisher and `interface` metadata for published plugins. The bundled OpenAI `plugin-creator` validator is intentionally stricter for a presentation-ready ingestion contract: it requires strict semver, `author.name`, and an `interface` containing `displayName`, `shortDescription`, `longDescription`, `developerName`, `category`, `capabilities`, and `defaultPrompt`. For this repo, use the richer shape before public submission, but the four-field manifest above is enough for the documented local skills-only starting point. ([OpenAI: complete manifest and manifest fields](https://developers.openai.com/codex/plugins/build#manifest-fields); [bundled validator source](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/skills/src/assets/samples/plugin-creator/scripts/validate_plugin.py))

One current version-skew caveat: the public docs support a `hooks` manifest field (and default discovery at `hooks/hooks.json`), but the bundled 0.133.0 `plugin-creator` validator rejects `hooks`. This does not affect the proposed skills-only plugin; if hooks are added later, validate against the runtime/docs as well as the helper. ([OpenAI: bundled hooks](https://developers.openai.com/codex/plugins/build#bundled-mcp-servers-and-lifecycle-hooks); [bundled validator allowed fields](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/skills/src/assets/samples/plugin-creator/scripts/validate_plugin.py#L91-L111))

## Marketplace and installation model

A marketplace is a JSON catalog, not a package registry. Codex recognizes:

- a repo marketplace at `$REPO_ROOT/.agents/plugins/marketplace.json`;
- a legacy-compatible repo marketplace at `$REPO_ROOT/.claude-plugin/marketplace.json`;
- a personal marketplace at `~/.agents/plugins/marketplace.json`;
- configured Git or local marketplaces added through the CLI;
- OpenAI/workspace curated marketplaces. ([OpenAI: how the desktop app uses marketplaces](https://developers.openai.com/codex/plugins/build#how-the-chatgpt-desktop-app-uses-marketplaces))

For this repository, the smallest DRY catalog is:

```json
{
  "name": "artem-veduta",
  "interface": {
    "displayName": "artemVeduta skills"
  },
  "plugins": [
    {
      "name": "artem-veduta-skills",
      "source": {
        "source": "local",
        "path": "./"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Developer Tools"
    }
  ]
}
```

The docs require each local path to be `./`-prefixed, relative to and inside the marketplace root; a local entry may also be a plain string path. Because the repository root is simultaneously the marketplace root and plugin root, `./` avoids a second copy under `plugins/`. This is a direct inference from the documented path rules and should be smoke-tested with `codex plugin marketplace add .`, `codex plugin list`, and `codex plugin add artem-veduta-skills@artem-veduta` when implemented. If the runtime rejects a root plugin source, the fallback is a thin `plugins/artem-veduta-skills/` package, but that would require links or generated content to preserve the single source of truth. ([OpenAI: marketplace metadata](https://developers.openai.com/codex/plugins/build#marketplace-metadata))

Marketplace entries may alternatively point to Git-backed plugin sources: use `source: "url"` when the plugin is at a repository root, or `source: "git-subdir"` with `path` when it is nested; `ref` and `sha` selectors are supported. NPM packages are also supported. For this same-repository case, a local `./` entry inside the Git marketplace snapshot is simpler and avoids cloning the same repository twice. ([OpenAI: Git- and npm-backed entries](https://developers.openai.com/codex/plugins/build#marketplace-metadata))

Installation is a snapshot/copy model, not the live symlink model used by this repository’s installer. Installed plugins are cached under `$CODEX_HOME/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION` (`~/.codex/...` at the default root); local plugins use version `local`. Codex loads the cache copy, not the marketplace source. Enable/disable state is stored in the Codex configuration. Start a new task/session after install so bundled skills and tools are discovered. ([OpenAI: marketplace cache behavior](https://developers.openai.com/codex/plugins/build#how-the-chatgpt-desktop-app-uses-marketplaces); [OpenAI: plugin clients and new-session behavior](https://developers.openai.com/codex/plugins#overview))

During local iteration, the bundled `plugin-creator` recommends changing only a semver build-metadata cachebuster (`0.1.0+codex.<token>`), reinstalling with `codex plugin add PLUGIN@MARKETPLACE`, and testing in a new task. The personal marketplace at `~/.agents/plugins/marketplace.json` is discovered implicitly; non-default marketplace paths must be added explicitly with `codex plugin marketplace add`. ([OpenAI bundled update workflow](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/skills/src/assets/samples/plugin-creator/references/installing-and-updating.md))

For public listing in OpenAI’s directory, a repository marketplace is not enough: submit the plugin through the OpenAI Platform plugin submission portal. Skills-only plugins are eligible; public submissions require Apps Management write access and a verified developer or business identity. ([OpenAI: Submit plugins](https://learn.chatgpt.com/docs/submit-plugins))

## Relationship to portable skill locations

Direct skills and plugin skills are two discovery paths for the same authoring format:

- The canonical direct user location is now `$HOME/.agents/skills`; repo skills are discovered from `.agents/skills` from the working directory up to the repo root. Symlinked skill directories are supported. ([OpenAI: where to save skills](https://developers.openai.com/codex/skills#where-to-save-skills))
- `$CODEX_HOME/skills` (normally `~/.codex/skills`) is still scanned but is explicitly marked deprecated in current Codex source for backward compatibility. Bundled OpenAI system skills remain a special case under `$CODEX_HOME/skills/.system`. ([Codex skill loader](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/core-skills/src/loader.rs#L296-L347))
- Plugin-contributed skill roots are appended separately from installed/enabled plugins and tagged with the plugin ID and namespace. They are not copied into `$HOME/.agents/skills` or `$CODEX_HOME/skills`. ([Codex skill loader](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/core-skills/src/loader.rs#L263-L281))
- Codex presents plugin skill names with the plugin namespace (for example `artem-veduta-skills:okf-docs-setup`), while direct installation presents the skill by its own name. If both are installed, they are independent entries; Codex does not merge duplicate skill names. ([OpenAI: duplicate skill names](https://developers.openai.com/codex/skills#where-to-save-skills); [Codex plugin instructions](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/core/src/plugins/render_tests.rs#L20))

Therefore the existing installer’s `~/.agents/skills` target is already the correct portable Codex target. Adding `~/.codex/skills` as another default would install into a deprecated compatibility directory and can create duplicate selectors; it should remain available only through the existing custom target escape hatch, if at all.

## Multiple profiles and configuration roots

`CODEX_HOME` is the real isolation boundary. It defaults to `~/.codex`; current source resolves config from it, stores plugin marketplace snapshots under `$CODEX_HOME/.tmp/marketplaces`, and stores installed plugin cache/data under `$CODEX_HOME/plugins/cache` and `$CODEX_HOME/plugins/data`. Separate `CODEX_HOME` values therefore isolate plugin marketplace configuration, installed copies, plugin data, and enablement state. ([Codex `find_codex_home`](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/core/src/config/mod.rs#L4340-L4358); [marketplace install root](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/core-plugins/src/installed_marketplaces.rs#L9-L17); [plugin store roots](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/core-plugins/src/store.rs#L20-L65))

Named config profiles are not equivalent isolation. Codex CLI 0.133.0 exposes `--profile-v2`, which layers `$CODEX_HOME/<name>.config.toml`, but current plugin subcommand dispatch does not pass that profile override into `plugin add/list/remove/marketplace`; those commands resolve `CODEX_HOME` and load the base configuration with only `-c` overrides. Even where a runtime profile changes effective enablement, the installed cache remains shared inside that `CODEX_HOME`. Use separate `CODEX_HOME` values for genuinely separate personal/work Codex installations. ([Codex CLI profile declaration and plugin dispatch](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/cli/src/main.rs#L1047-L1100); [plugin command context](https://github.com/openai/codex/blob/b45fef0774a02f4107ccab9eb22d81f8c866c474/codex-rs/cli/src/plugin_cmd.rs#L579-L600))

`$HOME/.agents/skills` is intentionally outside `CODEX_HOME`, so direct portable skills are shared across multiple Codex config roots that use the same OS home. Conversely, deprecated `$CODEX_HOME/skills` and plugin-contributed skills are config-root-specific. This gives the repository a clean split:

- use `~/.agents/skills` for the current shared, harness-neutral portable install;
- use a marketplace/plugin install per `CODEX_HOME` when a Codex profile needs the packaged plugin;
- do not install both forms in the same Codex environment unless duplicate direct and namespaced selectors are wanted.

## Exact repository changes implied

1. Add root `.codex-plugin/plugin.json` with plugin name/version/description and `"skills": "./skills/"`; add richer `author` and `interface` metadata before public distribution.
2. Add `.agents/plugins/marketplace.json` with one marketplace entry for the root plugin; first test the DRY `source.path: "./"` layout locally.
3. Keep every portable skill at `skills/<name>/SKILL.md`. Do not create Codex-specific copies or move them under `.codex/`.
4. Leave `scripts/install.sh` mechanics unchanged: `~/.agents/skills` is the canonical shared Codex skill directory, and its symlinks are supported. Do not add `~/.codex/skills` as a named default.
5. Document two distinct install modes: `scripts/install.sh` for live portable symlinks; `codex plugin marketplace add ...` plus `codex plugin add ...` for snapshot-based Codex plugin installation.
6. For personal/work separation, run the plugin CLI with the intended `CODEX_HOME`; do not rely on `--profile`/`--profile-v2` to isolate installations.
7. On plugin updates, bump version/cachebuster, refresh/reinstall, and test in a new task. Validate the manifest with the bundled `plugin-creator` helper, while accounting for its current `hooks` schema lag if hooks are ever introduced.

