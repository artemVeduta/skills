# Issue 6 research: dependency-aware selection in `npx skills`

Research snapshot: **2026-07-10**. The CLI source inspected is
`vercel-labs/skills` **v1.5.15**, commit
[`4ce6d48`](https://github.com/vercel-labs/skills/tree/4ce6d48ac44c8b637db87b2102fea3baca719df1).
Only primary sources are used: the CLI repository and the Agent Skills specification.

## Answer

No: this source repository cannot make these two unchanged commands mean:

```sh
# Explicit opt-out: install only skill-builder
npx skills add artemVeduta/skills --skill skill-builder

# Dependency-aware selection: selecting skill-builder also selects its closure
npx skills add artemVeduta/skills
```

The first behavior already exists: `--skill` filters the discovered skills to the names
supplied. The second does not. Without `--skill`, the upstream CLI either selects the sole
discovered skill, selects every discovered skill when `-y` is present, or shows an ordinary
multi-select when several skills exist. The user's selections become `selectedSkills`
unchanged; the installer then loops over exactly that array. There is no dependency graph,
closure expansion, missing-dependency rejection, or repository callback between selection
and installation
([selection branches](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/add.ts#L1243-L1334),
[installation loop](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/add.ts#L1705-L1739)).

Consequently, the desired distinction is implementable only by changing the upstream CLI
(or running a fork/wrapper instead of the published `skills` CLI). Repository layout or
metadata alone cannot add it.

## Exact behavior without `--skill`

After cloning the source and discovering skills, v1.5.15 takes one of four paths:

1. `--skill '*'`: select every discovered skill.
2. One or more explicit `--skill` values: filter by those values; no other skill is added.
3. No selector and exactly one discovered skill: select that skill.
4. No selector and several discovered skills: with `-y`, select all; otherwise show a
   user-controlled multi-select. Plugin groupings change only the prompt's presentation.

These branches are explicit in
[`src/add.ts`](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/add.ts#L1243-L1334).
The public options likewise describe `--skill` as installing named skills, `--skill '*'`
as all skills, and `--all` as all skills to all agents; they do not describe dependency
resolution
([CLI README](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/README.md#L50-L87)).

For example, if `skill-builder` depends on `domain-modeling` and `docs-add`, running the
unqualified command presents all three as independent toggles. Selecting only
`skill-builder` installs only `skill-builder`. Running the same command with `-y` installs
every skill in the repository, not just those three.

## No dependency metadata contract

The Agent Skills format has no defined skill-to-skill dependency field. Its standard
frontmatter fields are `name`, `description`, `license`, `compatibility`, `metadata`, and
experimental `allowed-tools`; `metadata` is an extension map whose semantics belong to a
client
([Agent Skills specification](https://agentskills.io/specification#frontmatter)).

The `skills` CLI only requires string `name` and `description`. It preserves arbitrary
`metadata`, but the only metadata key it interprets during discovery is
`metadata.internal`; no `dependencies` key is read
([parser](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/skills.ts#L64-L95)).
Therefore this repository may declare a private dependency convention for its own tools,
but upstream `npx skills` will treat it as opaque data.

## Manifests and hooks do not provide an extension point

Claude plugin manifests are recognized only for discovery and prompt grouping. Their
supported fields let the CLI locate local skill directories and attach a plugin name;
they do not declare dependency edges or force grouped selection
([manifest types and discovery](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/plugin-manifest.ts#L22-L111),
[grouped multi-select](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/add.ts#L1284-L1334)).

The README's compatibility table mentioning “Hooks” describes target-agent compatibility,
not an install-time extension API
([compatibility table](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/README.md#L458-L478)).
The add implementation follows a fixed clone/discover/select/copy-or-link path and passes
the resulting `selectedSkills` directly to installation
([discovery](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/add.ts#L1124-L1177),
[selection and install](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/add.ts#L1243-L1334)).
There is no source-repository install-hook call in that path, so a source repository cannot
intercept the unqualified command and rewrite `selectedSkills`.

## Feasible alternatives

### Preserve both commands exactly

This is feasible only after upstream `vercel-labs/skills` adopts a dependency convention
and the requested opt-out semantics. The necessary upstream behavior would be:

- parse a standardized or namespaced dependency list;
- expand closure only for interactive/no-`--skill` selection;
- reject missing nodes and cycles before writing;
- leave explicit `--skill` selection unexpanded as the intentional expert bypass.

Until then, documentation can tell users to select dependencies in the interactive prompt,
but cannot enforce or automatically select them.

### Preserve upstream `npx skills`, change the command contract

- `--skill skill-builder --skill domain-modeling --skill docs-add` is explicit and
  deterministic, but callers must already know the closure.
- `--skill '*'` installs the entire library, not the requested skill's closure.
- A repository-owned wrapper can resolve the closure and call upstream once with repeated
  `--skill` arguments, but its command cannot remain `npx skills add ...`.
- A maintained fork of `skills` could keep the visible syntax only if users deliberately
  arrange for `npx skills` to resolve to that fork; this is environment-dependent and
  misleading as public documentation.

### Restructure the repository

Bundling dependency content inside `skill-builder` would make that directory self-contained,
but it would duplicate content or collapse separately addressable skills into one package.
It would not install the dependencies as independent skill roots and conflicts with this
repository's canonical-skill and DRY goals.

Adding a root `SKILL.md` as an aggregate is also unsuitable. By default, discovery returns
early when the source root itself is a skill, shadowing nested skills; the explicit
`--skill skill-builder` form would then fail to discover `skill-builder`
([root-skill early return](https://github.com/vercel-labs/skills/blob/4ce6d48ac44c8b637db87b2102fea3baca719df1/src/skills.ts#L190-L203)).

## Implication for the issue-6 decision

The proposed policy is coherent as a future or repository-owned contract:

- explicit `--skill` means “install exactly what I named; I accept no dependency check”;
- interactive selection means “expand and validate dependencies.”

It is **not a capability of the current portable channel**. If the exact upstream commands
are a hard constraint, issue 6 must either accept best-effort documentation for now or make
upstream dependency support a prerequisite. If enforcement is the hard constraint, the
portable channel needs a wrapper/fork and therefore a different installation command.
