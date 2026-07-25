// Deterministic recognition tests for the docs-setup VALIDATION-ENFORCEMENT and
// VERSIONLESS-CONVERGENCE slice (issue #65, spec §docs-setup "Validation
// enforcement" / "Versionless convergence"). #52 shipped the fresh path and #53
// upgrade/reinstall/repair; #65 extends the SAME skill with repository enforcement
// (discovery, planning, installation, upgrade, verification) and with retired-surface
// convergence derived from durable tombstones rather than an installed version.
//
// These are the CI-reachable deterministic layer. They assert three things and never
// run a model:
//   1. the shipped managed workflow ASSET itself satisfies its contract — it is
//      committed content, so "runs on push AND pull_request over the complete
//      bundle" is provable right here rather than only through a live run;
//   2. SKILL.md and references/enforcement.md still state every enforcement and
//      tombstone commitment a live case is meant to exercise;
//   3. each sibling live case loads, projects the real docs-setup skill, and carries
//      the oracle assertions that WOULD prove its behavior when driven by a model
//      through the test-runner CLI.
//
// The nine cases and the required matrix row each covers:
//   docs-setup-enforce-both          — BOTH surfaces: workflow + pre-push installed;
//                                      customized hook commands byte-preserved;
//                                      no native-Git or remote-governance mutation.
//   docs-setup-enforce-github-only   — GITHUB-ONLY, and INACTIVE Husky (a
//                                      devDependency + `prepare` with no configuration)
//                                      → local hook skipped.
//   docs-setup-enforce-husky-only    — ACTIVE-HUSKY-ONLY, no GitHub evidence → workflow
//                                      skipped.
//   docs-setup-noop                  — NEITHER surface → both skipped (the #53 no-op
//                                      case, extended rather than duplicated).
//   docs-setup-enforce-equivalent    — an EQUIVALENT EXISTING WORKFLOW (repository
//                                      script name) and an EQUIVALENT EXISTING HOOK
//                                      INVOCATION THROUGH A WRAPPER → no duplication.
//   docs-setup-enforce-idempotent    — the managed block already installed → a rerun
//                                      neither duplicates nor reorders.
//   docs-setup-enforce-customized    — the managed block's OWN command, inside its own
//                                      stable markers, has been hand-EDITED →
//                                      customized-until-reviewed, never blindly
//                                      overwritten; review + approval reinstalls it
//                                      byte-for-byte with unrelated commands preserved.
//   docs-setup-enforce-ambiguous     — an AMBIGUOUS enforcement surface → blocks.
//   docs-setup-retired               — retired paths ABSENT / fingerprint-or-marker
//                                      PROVEN / CUSTOMIZED / UNCERTAIN, and every OKF
//                                      knowledge file byte-preserved.
//   docs-setup-legacy-failing        — a failing legacy bundle: enforcement installed
//                                      anyway, the two results reported independently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { loadCase } from './case-loader.mjs';
import { buildFixture } from './fixture.mjs';
import { checkPortableContract } from './static-contract.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const casesRoot = join(REPO_ROOT, 'tools/tests');
const skillsRoot = join(REPO_ROOT, 'skills');
const skillDir = join(skillsRoot, 'docs-setup');

const WORKFLOW_ASSET = 'assets/github/workflows/docs-validate.yml';
const WORKFLOW_DEST = '.github/workflows/docs-validate.yml';
const PREPUSH = '.husky/pre-push';
const BLOCK_BEGIN = '# BEGIN OKF docs validation (managed by docs-setup)';
const BLOCK_END = '# END OKF docs validation (managed by docs-setup)';
// The canonical managed block, in full — the strong oracle a case exercising a
// CUSTOMIZED block needs, since the edited command otherwise still contains the
// bare command as a prefix and would satisfy a loose substring check either way.
const MANAGED_BLOCK = `${BLOCK_BEGIN}\nnpm run docs:validate\n${BLOCK_END}\n`;

// Markdown emphasis and hard wrapping are formatting, not contract.
const flat = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ');

// Every #65 case, all of which project the real docs-setup skill.
const CASES = [
  'docs-setup-enforce-both',
  'docs-setup-enforce-github-only',
  'docs-setup-enforce-husky-only',
  'docs-setup-enforce-equivalent',
  'docs-setup-enforce-idempotent',
  'docs-setup-enforce-customized',
  'docs-setup-enforce-ambiguous',
  'docs-setup-retired',
  'docs-setup-legacy-failing',
];

// Load a case and give it a predicate helper, so each check below reads as the
// assertion it is looking for rather than as array plumbing.
async function load(name) {
  const c = await loadCase(name, { casesRoot });
  assert.equal(c.skill, 'docs-setup', `${name} must project the real docs-setup skill`);
  return {
    ...c,
    has: (pred, why) => assert.ok(c.assertions.some(pred), `${name}: ${why}`),
    hasType: (type) => assert.ok(c.assertions.some((a) => a.type === type), `${name}: must assert ${type}`),
  };
}

const fileEquals = (path, against) => (a) => a.type === 'file-equals' && a.path === path && a.against === against;
const contains = (path, value) => (a) => a.type === 'file-contains' && a.path === path && a.value.includes(value);
const notContains = (path, value) => (a) => a.type === 'file-not-contains' && a.path === path && a.value.includes(value);
const absent = (path) => (a) => a.type === 'file-absent' && a.path === path;
const unchanged = (path) => (a) => a.type === 'file-unchanged' && a.path === path;
const onlyPaths = (paths) => (a) =>
  a.type === 'git-only-paths' && a.paths.length === paths.length && paths.every((p) => a.paths.includes(p));
const occursOnce = (path, value) => (a) =>
  a.type === 'file-occurrences' && a.path === path && a.value === value && a.count === 1;

// --- 1. the shipped asset's own contract -------------------------------------

test('the shipped managed workflow asset runs on BOTH push and pull_request over the complete bundle', async () => {
  const wf = await readFile(join(skillDir, WORKFLOW_ASSET), 'utf8');
  // Isolate the trigger block so a `pull_request:` appearing anywhere else in the
  // file (a comment, another job) cannot satisfy the trigger contract.
  const on = wf.match(/^on:\s*$([\s\S]*?)^\S/m);
  assert.ok(on, 'the managed workflow must declare a top-level `on:` trigger block');
  assert.match(on[1], /^\s+push:/m, 'the managed workflow must run on push');
  assert.match(on[1], /^\s+pull_request:/m, 'the managed workflow must run on pull_request');
  // The COMPLETE bundle: the plain script, no path filter, no diff scoping.
  assert.match(wf, /run:\s*npm run docs:validate\s*$/m, 'the workflow must run the plain docs:validate script');
  assert.doesNotMatch(wf, /^\s*paths(-ignore)?:/m, 'the workflow must not be path-filtered — the guard covers the complete bundle');
  assert.doesNotMatch(wf, /git diff|--changed|--since/, 'the workflow must not scope validation to a diff');
});

// --- 2. the contract prose ---------------------------------------------------

test('the SKILL.md documents the enforcement contract (#65)', async () => {
  const doc = flat(await readFile(join(skillDir, 'SKILL.md'), 'utf8'));

  // Ownership: setup owns discovery/planning/installation/upgrade/verification;
  // docs-validate owns running and interpreting the command.
  assert.match(doc, /discovery, planning, installation, upgrade, and verification/i);
  assert.match(doc, /docs-validate owns running and interpreting/i);

  // GitHub detection from evidence or an explicit request; absence is a reported skip.
  assert.match(doc, /GitHub is detected from evidence or an explicit request/i);
  assert.match(doc, /reported skip/i);
  assert.match(doc, /never a prompt and never a guess/i);

  // An equivalent existing workflow is a no-op — enforcement is not duplicated.
  assert.match(doc, /not duplicated/i);
  assert.match(doc, /Equivalence includes wrappers and repository-specific script names/i);

  // Otherwise the dedicated workflow, on BOTH events, and never arbitrary CI logic.
  assert.match(doc, /dedicated/i);
  assert.match(doc, /both `push` and `pull_request`/i);
  assert.match(doc, /Never modify arbitrary CI logic/i);

  // Local push enforcement only through an ACTIVE, repository-owned Husky
  // configuration; a dependency alone is insufficient.
  assert.match(doc, /active, recognizable Husky configuration/i);
  assert.match(doc, /dependency without active configuration is insufficient/i);
  assert.match(doc, /No Husky → skip/i);

  // One identifiable managed block: byte-preserved commands, idempotent, and an
  // equivalent existing invocation (including a wrapper) is a no-op.
  assert.match(doc, /one identifiable managed validation block/i);
  assert.match(doc, /byte-preserved/i);
  assert.match(doc, /repeated runs neither duplicate nor reorder/i);
  assert.match(doc, /equivalent existing invocation, including one through a repository wrapper script, is a no-op/i);

  // The complete bundle on every push — never a diff-scoped subset.
  assert.match(doc, /complete bundle on every push/i);
  assert.match(doc, /never a diff-scoped subset/i);

  // Installed even when the bundle currently fails, with the consequence stated.
  assert.match(doc, /installed even when the bundle currently fails/i);
  assert.match(doc, /pushes remain blocked until the bundle is repaired/i);

  // The absolute out-of-scope set: remote governance and native git plumbing.
  assert.match(doc, /Never call GitHub APIs or the GitHub CLI/i);
  assert.match(doc, /branch protection, rulesets, or required checks/i);
  assert.match(doc, /Never install, initialize, or upgrade Husky/i);
  assert.match(doc, /never change native Git hooks or the configured hooks path/i);

  // An ambiguous enforcement surface BLOCKS, like ambiguous project memory.
  assert.match(doc, /ambiguous enforcement surface/i);
});

test('the SKILL.md reports machinery installation and bundle validity independently', async () => {
  const doc = flat(await readFile(join(skillDir, 'SKILL.md'), 'utf8'));
  assert.match(doc, /two independent results/i);
  assert.match(doc, /tooling installed successfully/i);
  assert.match(doc, /bundle validates cleanly/i);
  // A pre-existing exit 1 is a BUNDLE result and must not misclassify tooling.
  assert.match(doc, /does not misclassify tooling installation/i);
  assert.match(doc, /Enforcement belongs to the first result/i);
});

test('the SKILL.md documents versionless convergence over retired surfaces (#65)', async () => {
  const doc = flat(await readFile(join(skillDir, 'SKILL.md'), 'utf8'));

  // Versionless: no installed marker, no version-branched engine.
  assert.match(doc, /no suite-version marker/i);
  assert.match(doc, /no version-branched migration engine/i);
  assert.match(doc, /durable retired-surface tombstones/i);
  assert.match(doc, /historical fingerprints or managed markers/i);

  // Coverage spans tooling, wiring, adapters, workflows, router sections, helpers.
  assert.match(doc, /tooling, wiring, adapters, workflows, managed router sections, and legacy helper copies/i);
  // The retired Claude-only docs-authoring adapter is named as retired BY this contract.
  assert.match(doc, /`?\.claude\/rules\/docs-authoring\.md`? — the Claude-only docs-authoring adapter, retired by this contract/i);
  assert.match(doc, /docs-maintenance\.md/);

  // The three classifications, and the one thing never removed.
  assert.match(doc, /removal in the normal plan/i);
  assert.match(doc, /visible and approved/i);
  assert.match(doc, /Customized or uncertain → a conflict requiring an explicit keep\/remove decision/i);
  assert.match(doc, /Missing retired path → a silent no-op/i);
  assert.match(doc, /every OKF knowledge file is byte-preserved by setup/i);
});

test('references/enforcement.md carries the enforcement mechanics and the tombstone table', async () => {
  const raw = await readFile(join(skillDir, 'references/enforcement.md'), 'utf8');
  const doc = flat(raw);

  // SKILL.md must point at it RELATIVELY (the projected pack moves; an absolute
  // path would break, and the static portable contract enforces this too).
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
  assert.match(skill, /references\/enforcement\.md/, 'SKILL.md must point at the relative enforcement reference');
  assert.doesNotMatch(skill, /\]\(\/[^)]*enforcement\.md\)/, 'the enforcement reference must never be linked absolutely');

  // The three GitHub detection signals, spelled out.
  assert.match(doc, /a GitHub remote/i);
  assert.match(doc, /existing GitHub workflow structure/i);
  assert.match(doc, /an explicit user request/i);

  // The full equivalence set, including the wrapper indirection and its
  // unresolvable case.
  assert.match(doc, /npm run docs:validate/);
  assert.match(doc, /node scripts\/validate-docs\.mjs/);
  assert.match(doc, /repository-specific script name/i);
  assert.match(doc, /wrapper/i);
  assert.match(doc, /Follow one indirection/i);
  assert.match(doc, /treat the workflow as ambiguous/i);
  // A partial (diff-scoped or path-filtered) invocation is NOT conformant.
  assert.match(doc, /path-filtered invocation\) is not conformant/i);

  // The exact managed block markers the fixtures and the writer share.
  assert.ok(raw.includes(BLOCK_BEGIN), 'the reference must publish the exact BEGIN marker');
  assert.ok(raw.includes('# END OKF docs validation (managed by docs-setup)'), 'the reference must publish the exact END marker');
  assert.match(doc, /appended at the end of the hook/i);
  assert.match(doc, /replaced in place/i);

  // The tombstone table with its ownership-proof column and the never-removed rule.
  assert.match(doc, /Proof of suite ownership/i);
  assert.match(doc, /historical fingerprint is byte-identity/i);
  assert.match(doc, /managed marker is an in-file marker naming this suite/i);
  assert.match(doc, /Every OKF knowledge file is byte-preserved by setup/i);
});

// --- 3. the live cases -------------------------------------------------------

test('the both-surfaces case installs the workflow and one pre-push block, preserving unrelated hook commands', async () => {
  const c = await load('docs-setup-enforce-both');
  assert.equal(c.followUpPrompts.length, 1, 'the write path needs one explicit approval turn');

  // The workflow is byte-identical to the shipped asset, and both triggers are
  // named so the CONTRACT fails rather than only byte drift.
  c.has(fileEquals(WORKFLOW_DEST, 'skills/docs-setup/assets/github/workflows/docs-validate.yml'),
    'must assert the installed workflow is byte-identical to the asset');
  c.has(contains(WORKFLOW_DEST, 'push:'), 'must assert the push trigger');
  c.has(contains(WORKFLOW_DEST, 'pull_request:'), 'must assert the pull_request trigger');
  // Arbitrary CI logic is never modified.
  c.has(unchanged('.github/workflows/ci.yml'), 'must assert the unrelated workflow is byte-unchanged');

  // Exactly ONE managed block — the count, not merely its presence.
  c.has(occursOnce(PREPUSH, BLOCK_BEGIN), 'must assert the managed block was appended exactly once');
  // The COMPLETE bundle: the plain script, and provably not diff-scoped.
  c.has(contains(PREPUSH, 'npm run docs:validate'), 'must assert the pre-push guard runs the plain script');
  c.has(notContains(PREPUSH, 'git diff'), 'must assert the guard is not diff-scoped');
  // Every unrelated hook command survives, in its original order, with the block
  // appended AFTER them.
  for (const sentinel of ['hook-lint-keep-me', 'hook-test-keep-me', 'hook-deploy-keep-me']) {
    c.has(contains(PREPUSH, sentinel), `must assert the unrelated hook command ${sentinel} is preserved`);
  }
  c.has(
    (a) =>
      a.type === 'file-contains-ordered' &&
      a.path === PREPUSH &&
      a.values[a.values.length - 1] === BLOCK_BEGIN,
    'must assert the managed block is appended after the existing commands (no reordering)',
  );

  // The absences: native git plumbing, remote governance, and any stray write.
  c.hasType('git-hooks-untouched');
  c.hasType('git-uncommitted');
  c.has(onlyPaths([WORKFLOW_DEST, PREPUSH]), 'must assert the change set is EXACTLY the two enforcement files');
  c.hasType('portable-contract');
});

test('the GitHub-only case installs the workflow and skips the local hook for an INACTIVE Husky', async () => {
  const c = await load('docs-setup-enforce-github-only');
  assert.equal(c.followUpPrompts.length, 1);

  // The fixture must actually be the tempting wrong answer: a husky
  // devDependency AND a `prepare` script, with no configuration anywhere. Without
  // that the skip would be proven only by nothing being there.
  const pkg = c.inputs.find((i) => i.path === 'package.json');
  assert.ok(pkg, 'the case must seed a package.json');
  assert.match(pkg.content, /"husky"/, 'the fixture must carry a husky devDependency (insufficient evidence)');
  assert.match(pkg.content, /"prepare"/, 'the fixture must carry a prepare script (still insufficient evidence)');
  assert.ok(
    !c.inputs.some((i) => i.path.startsWith('.husky/')),
    'the fixture must seed NO .husky configuration — that is what makes the dependency insufficient',
  );

  c.has(fileEquals(WORKFLOW_DEST, 'skills/docs-setup/assets/github/workflows/docs-validate.yml'),
    'must assert the managed workflow was installed byte-identical to the asset');
  c.has(contains(WORKFLOW_DEST, 'push:'), 'must assert the push trigger');
  c.has(contains(WORKFLOW_DEST, 'pull_request:'), 'must assert the pull_request trigger');

  // The skip is real: no hook file, no Husky install, no native fallback.
  c.has(absent(PREPUSH), 'must assert no pre-push hook was created');
  c.has(unchanged('package.json'), 'must assert package.json is byte-unchanged (no husky install, no prepare rewrite)');
  c.hasType('git-hooks-untouched');
  c.has(onlyPaths([WORKFLOW_DEST]), 'must assert the change set is EXACTLY the managed workflow');
  c.hasType('git-uncommitted');
  c.hasType('portable-contract');
});

test('the active-Husky-only case installs the pre-push block and skips the workflow with no GitHub evidence', async () => {
  const c = await load('docs-setup-enforce-husky-only');
  assert.equal(c.followUpPrompts.length, 1);

  // The fixture must carry a genuinely ACTIVE configuration (the manager's runtime
  // helper beside a real hook), and NO GitHub evidence at all.
  assert.ok(
    c.inputs.some((i) => i.path === '.husky/_/husky.sh'),
    'the fixture must seed an active hook manager runtime',
  );
  assert.ok(
    !c.inputs.some((i) => i.path.startsWith('.github/')),
    'the fixture must seed NO GitHub evidence — that is the skip under test',
  );

  c.has((a) => a.type === 'file-exists' && a.path === PREPUSH, 'must assert the pre-push file was created');
  c.has(occursOnce(PREPUSH, BLOCK_BEGIN), 'must assert exactly one managed block');
  c.has(contains(PREPUSH, 'npm run docs:validate'), 'must assert the guard runs the plain script');
  c.has(notContains(PREPUSH, 'git diff'), 'must assert the guard is not diff-scoped');
  // The manager's other hooks are untouched.
  c.has(unchanged('.husky/pre-commit'), 'must assert an unrelated managed hook is byte-unchanged');
  // No GitHub surface was invented.
  c.has(absent(WORKFLOW_DEST), 'must assert no workflow was installed without GitHub evidence');
  c.has(onlyPaths([PREPUSH]), 'must assert the change set is EXACTLY the pre-push hook');
  c.hasType('git-hooks-untouched');
  c.hasType('git-uncommitted');
  c.hasType('portable-contract');
});

test('the neither-surface case reports both skips and stays git-unchanged', async () => {
  // docs-setup-noop is the #53 no-op case EXTENDED to cover the fourth
  // enforcement cell, rather than a duplicate fixture asserting the same outcome.
  const c = await load('docs-setup-noop');
  assert.equal(c.followUpPrompts.length, 0, 'a current target needs no approval turn');
  assert.ok(
    !c.inputs.some((i) => i.path.startsWith('.github/') || i.path.startsWith('.husky/')),
    'the fixture must carry NEITHER enforcement capability',
  );
  c.has((a) => a.type === 'output-contains' && a.value === 'skip', 'must assert the skips were reported');
  c.hasType('git-unchanged');
  c.has(absent(WORKFLOW_DEST), 'must assert no workflow was invented');
  c.has(absent(PREPUSH), 'must assert no hook was invented');
  c.hasType('git-hooks-untouched');
});

test('the equivalent-enforcement case proves no duplication for a repository script name and a wrapper', async () => {
  const c = await load('docs-setup-enforce-equivalent');
  assert.equal(c.followUpPrompts.length, 0, 'an already-conformant target is a no-change plan');

  // The fixture must require FOLLOWING an indirection on each surface, otherwise
  // "recognized as equivalent" degenerates into string-matching `docs:validate`.
  const pkg = c.inputs.find((i) => i.path === 'package.json');
  assert.match(pkg.content, /"docs:check"/, 'the workflow equivalence must go through a repository-specific script name');
  const wf = c.inputs.find((i) => i.path === '.github/workflows/ci.yml');
  assert.match(wf.content, /docs:check/, 'the existing workflow must invoke the repository script name');
  assert.doesNotMatch(wf.content, /docs:validate/, 'the existing workflow must NOT name docs:validate directly');
  const hook = c.inputs.find((i) => i.path === PREPUSH);
  assert.match(hook.content, /ci-checks\.sh/, 'the hook equivalence must go through a repository wrapper script');
  assert.doesNotMatch(hook.content, /docs:validate/, 'the hook must NOT name docs:validate directly');
  assert.ok(
    c.inputs.some((i) => i.path === 'scripts/ci-checks.sh' && /docs:validate/.test(i.content)),
    'the wrapper must be present and resolvable read-only (the ambiguous case owns the unreadable variant)',
  );

  // Nothing at all was written, and the two duplications are named.
  c.hasType('git-unchanged');
  c.has(absent(WORKFLOW_DEST), 'must assert the managed workflow was NOT installed beside an equivalent one');
  c.has(notContains(PREPUSH, BLOCK_BEGIN), 'must assert no managed block was added beside an equivalent invocation');
  c.hasType('git-hooks-untouched');
  c.hasType('portable-contract');
});

test('the idempotency case proves a rerun neither duplicates nor reorders the managed block', async () => {
  const c = await load('docs-setup-enforce-idempotent');
  assert.equal(c.followUpPrompts.length, 0, 'an already-enforced target is a no-change plan');

  // The fixture must already carry SETUP'S OWN managed block, after the
  // repository's own commands — that is what distinguishes this from the
  // equivalent-existing case.
  const hook = c.inputs.find((i) => i.path === PREPUSH);
  assert.ok(hook, 'the fixture must seed the pre-push hook');
  assert.ok(hook.content.includes(BLOCK_BEGIN), 'the fixture must already carry the managed block');
  assert.ok(
    hook.content.indexOf('hook-deploy-keep-me') < hook.content.indexOf(BLOCK_BEGIN),
    'the fixture must place the managed block AFTER the repository commands, so a reorder is detectable',
  );
  assert.ok(
    c.inputs.some((i) => i.path === WORKFLOW_DEST),
    'the fixture must already carry the managed workflow',
  );

  // The strongest possible idempotency oracle plus the two named properties.
  c.hasType('git-unchanged');
  c.has(occursOnce(PREPUSH, BLOCK_BEGIN), 'must assert the block was not duplicated');
  c.has(occursOnce(PREPUSH, 'npm run docs:validate'), 'must assert the validation command was not duplicated');
  c.has(
    (a) => a.type === 'file-contains-ordered' && a.path === PREPUSH && a.values[a.values.length - 1] === BLOCK_BEGIN,
    'must assert the existing hook commands were not reordered around the block',
  );
  c.has(fileEquals(WORKFLOW_DEST, 'skills/docs-setup/assets/github/workflows/docs-validate.yml'),
    'must assert the already-current workflow stayed byte-identical (a no-op row)');
  c.hasType('git-hooks-untouched');
  c.hasType('portable-contract');
});

test('the customized-block case proves an edited managed block is reviewed and reinstalled, never blindly overwritten', async () => {
  const c = await load('docs-setup-enforce-customized');
  assert.equal(c.followUpPrompts.length, 1, 'the write path needs one explicit approval turn');

  // The fixture must genuinely EDIT the canonical command inside the stable
  // markers — otherwise this degenerates into the idempotent or equivalent case
  // wearing a different name.
  const hook = c.inputs.find((i) => i.path === PREPUSH);
  assert.ok(hook, 'the fixture must seed the pre-push hook');
  assert.ok(
    hook.content.includes(BLOCK_BEGIN) && hook.content.includes(BLOCK_END),
    'the fixture must carry the stable managed-block markers — it is customized WITHIN them, not absent',
  );
  assert.ok(
    !hook.content.includes(MANAGED_BLOCK),
    'the fixture must NOT already carry the canonical unmodified block — it must be genuinely EDITED',
  );
  assert.match(hook.content, /SENTINEL customized-block-keep-me/, 'the fixture must mark its customization with a distinguishing sentinel');

  // The oracle must prove the CANONICAL block landed byte-for-byte — the full
  // multi-line marker+command string, not a loose substring a still-customized
  // line (which also contains "npm run docs:validate" as its own prefix) could
  // satisfy just as well.
  c.has(
    (a) => a.type === 'file-contains' && a.path === PREPUSH && a.value === MANAGED_BLOCK,
    'must assert the canonical managed block landed byte-for-byte, not merely a loose substring',
  );
  // The customization must be asserted GONE, not left alongside the reinstalled block.
  c.has(notContains(PREPUSH, 'customized-block-keep-me'), 'must assert the customization sentinel is gone after reinstall');
  c.has(notContains(PREPUSH, '--quiet'), 'must assert the customized flag is gone, not merely superseded');
  // Reinstalled exactly once — never appended as a second block beside the old one.
  c.has(occursOnce(PREPUSH, BLOCK_BEGIN), 'must assert the block was not duplicated');
  c.has(occursOnce(PREPUSH, BLOCK_END), 'must assert the end marker was not duplicated');
  // Unrelated hook commands stayed byte-preserved, in their original order, with
  // the reinstalled block still AFTER them.
  for (const sentinel of ['hook-lint-keep-me', 'hook-test-keep-me', 'hook-deploy-keep-me']) {
    c.has(contains(PREPUSH, sentinel), `must assert the unrelated hook command ${sentinel} is preserved`);
  }
  c.has(
    (a) => a.type === 'file-contains-ordered' && a.path === PREPUSH && a.values[a.values.length - 1] === BLOCK_BEGIN,
    'must assert the reinstalled block stays after the existing commands (no reordering)',
  );
  // No GitHub surface was invented — this case has no GitHub evidence.
  c.has(absent(WORKFLOW_DEST), 'must assert no workflow was invented');
  // Nothing else moved: exactly the one reviewed file changed.
  c.has(onlyPaths([PREPUSH]), 'must assert the change set is EXACTLY the pre-push hook');
  c.hasType('git-hooks-untouched');
  c.hasType('git-uncommitted');
  c.hasType('portable-contract');
});

test('the ambiguous-enforcement case blocks and writes nothing', async () => {
  const c = await load('docs-setup-enforce-ambiguous');
  assert.equal(c.followUpPrompts.length, 1, 'the block is only observable on a no-write path');

  // The indirections must be genuinely UNRESOLVABLE read-only, otherwise the case
  // is the equivalent-existing case wearing a different name.
  const hook = c.inputs.find((i) => i.path === PREPUSH);
  assert.match(hook.content, /run-checks/, 'the hook must call a wrapper');
  assert.ok(
    !c.inputs.some((i) => i.path.includes('run-checks')),
    'the wrapper must be ABSENT from the fixture — that is what makes the hook ambiguous',
  );
  const mk = c.inputs.find((i) => i.path === 'Makefile');
  assert.ok(mk, 'the workflow ambiguity must go through a Makefile indirection');
  assert.match(mk.content, /\$\(CI_RUNNER\)/, 'the Makefile recipe must dead-end in an externally supplied variable');

  // Nothing written, and neither tempting guess taken.
  c.hasType('git-unchanged');
  c.has(absent(WORKFLOW_DEST), 'must assert no workflow was installed "just in case"');
  c.has(notContains(PREPUSH, BLOCK_BEGIN), 'must assert no managed block was added while the ambiguity stood');
  c.has((a) => a.type === 'output-contains' && /ambigu/i.test(a.value), 'must assert the ambiguity was surfaced');
  c.hasType('git-hooks-untouched');
  c.hasType('portable-contract');
});

test('the retired-surface case removes only PROVEN surfaces, keeps conflicts, and byte-preserves all OKF knowledge', async () => {
  const c = await load('docs-setup-retired');
  assert.equal(c.followUpPrompts.length, 1);

  // PROVEN by historical fingerprint AND by managed marker — both routes present,
  // so a fingerprint-only or marker-only implementation fails.
  const authoring = c.inputs.find((i) => i.path === '.claude/rules/docs-authoring.md');
  assert.ok(authoring, 'the fixture must seed the retired docs-authoring adapter');
  assert.match(authoring.content, /paths:\n\s+- "docs\/\*\*\/\*\.md"/, 'the fingerprint must be the exact retired shipped bytes');
  const tooling = c.inputs.find((i) => i.path === 'scripts/okf-docs-lint.mjs');
  assert.ok(tooling, 'the fixture must seed a retired managed tooling surface');
  assert.match(tooling.content, /managed by docs-setup/, 'the marker-proven surface must carry an owner marker');
  c.has(absent('.claude/rules/docs-authoring.md'), 'must assert the fingerprint-proven surface was removed');
  c.has(absent('scripts/okf-docs-lint.mjs'), 'must assert the marker-proven surface was removed');

  // CUSTOMIZED and UNCERTAIN survive the explicit KEEP, byte-for-byte.
  c.has(unchanged('.claude/rules/docs-maintenance.md'), 'must assert the CUSTOMIZED retired surface was kept byte-for-byte');
  c.has(unchanged('.claude/skills/docs-validate/SKILL.md'), 'must assert the UNCERTAIN retired surface was kept byte-for-byte');

  // ABSENT: nothing is seeded for the docs-add helper copy, and the exact change
  // set proves setup neither created nor reported work for it.
  assert.ok(
    !c.inputs.some((i) => i.path.startsWith('.claude/skills/docs-add/')),
    'the fixture must leave one retired path ABSENT so the no-op class is covered',
  );
  c.has(onlyPaths(['.claude/rules/docs-authoring.md', 'scripts/okf-docs-lint.mjs']),
    'must assert the change set EQUALS the two proven removals — nothing else touched');

  // Every OKF knowledge file byte-preserved, including accepted amendment history.
  for (const path of [
    'docs/payments/decisions/payment-retries.md',
    'docs/payments/index.md',
    'docs/index.md',
    'docs/log.md',
    'docs/conventions/documentation.md',
    'docs/references/okf.md',
  ]) {
    c.has(unchanged(path), `must assert the OKF knowledge file ${path} is byte-preserved`);
  }
  const decision = c.inputs.find((i) => i.path === 'docs/payments/decisions/payment-retries.md');
  assert.match(decision.content, /^# Amendments$/m, 'the preserved Decision must carry accepted amendment history');
  c.hasType('git-uncommitted');
  c.hasType('git-hooks-untouched');
  c.hasType('portable-contract');
});

test('the failing-legacy-bundle case installs enforcement anyway and reports the two results independently', async () => {
  const c = await load('docs-setup-legacy-failing');
  assert.equal(c.followUpPrompts.length, 1);

  // The fixture must genuinely FAIL strict validation on PRE-EXISTING content:
  // an empty `type` and unparseable frontmatter are the validator's exit-1 classes.
  const emptyType = c.inputs.find((i) => i.path === 'docs/legacy/settlement-notes.md');
  assert.ok(emptyType, 'the fixture must seed a concept with a hard content error');
  assert.match(emptyType.content, /^type:\s*$/m, 'the seeded concept must have an EMPTY type (a hard error)');
  const unparseable = c.inputs.find((i) => i.path === 'docs/legacy/gateway-matrix.md');
  assert.ok(unparseable, 'the fixture must seed a concept with unparseable frontmatter');
  assert.equal(
    (unparseable.content.match(/^---$/gm) ?? []).length,
    1,
    'the unparseable concept must have no closing frontmatter fence',
  );

  // The two results are reported INDEPENDENTLY, with the consequence stated.
  c.has((a) => a.type === 'output-contains' && a.value === 'tooling installed successfully',
    'must assert the machinery result was reported as successful');
  c.has((a) => a.type === 'output-contains' && a.value === 'bundle validates cleanly',
    'must assert the bundle result was reported separately');
  c.has((a) => a.type === 'output-contains' && a.value === 'pushes remain blocked',
    'must assert the blocked-pushes consequence was stated');
  c.has((a) => a.type === 'output-contains' && a.value === 'pre-existing',
    'must assert the content errors were attributed to pre-existing content');

  // Enforcement went in regardless of the failing content.
  c.has(fileEquals(WORKFLOW_DEST, 'skills/docs-setup/assets/github/workflows/docs-validate.yml'),
    'must assert the workflow was installed despite the failing bundle');
  c.has(occursOnce(PREPUSH, BLOCK_BEGIN), 'must assert exactly one managed block was installed despite the failing bundle');

  // And setup repaired NO content — that is docs-sync's separate run.
  c.has(unchanged('docs/legacy/settlement-notes.md'), 'must assert the failing concept was byte-preserved');
  c.has(unchanged('docs/legacy/gateway-matrix.md'), 'must assert the unparseable concept was byte-preserved');
  c.has(onlyPaths([WORKFLOW_DEST, PREPUSH]),
    'must assert the change set is EXACTLY the enforcement files — no content was silently repaired');
  c.hasType('git-uncommitted');
  c.hasType('git-hooks-untouched');
  c.hasType('portable-contract');
});

// --- 4. projection ----------------------------------------------------------

test('every #65 enforcement case projects the full suite closure and passes the static portable contract', async () => {
  for (const name of CASES) {
    const c = await loadCase(name, { casesRoot });
    const fixtureRoot = await mkdtemp(join(tmpdir(), `${name}-`));
    try {
      const { closure } = await buildFixture({
        skillName: c.skill,
        skillsRoot,
        driver: { discoverySubdir: '.claude/skills' },
        fixtureRoot,
        inputs: c.inputs,
      });
      assert.deepEqual(closure, ['docs-add', 'docs-setup', 'docs-validate'], `${name}: closure`);
      const { errors } = await checkPortableContract(fixtureRoot, { skillsSubdir: '.claude/skills' });
      assert.deepEqual(errors, [], `${name}: portable contract`);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }
});
