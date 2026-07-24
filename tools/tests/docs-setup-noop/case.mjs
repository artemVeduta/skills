// No-op / idempotent-rerun case for docs-setup (issue #53, spec §docs-setup).
// Projects the real `docs-setup` skill. The fixture is a repository ALREADY at
// the exact current-v2 state: canonical `scripts/validate-docs.mjs` and its test
// byte-identical to the shipped assets, both `docs:validate` package scripts, a
// complete and current `docs/` bundle, the marked AGENTS.md router, and the exact
// CLAUDE.md shim. Nothing is missing and nothing differs.
//
// This is the single behavioral proof of TWO acceptance criteria at once:
//   (a) exact current-v2 managed files are NO-OPS, and
//   (b) a current-v2 rerun is IDEMPOTENT — it produces a no-change plan.
// It is a single read-only turn (no follow-up): docs-setup audits, recomputes
// state, classifies the target as CURRENT, and reports a no-change plan without
// writing anything. The headline oracle assertion is git-unchanged: on a current
// target the fixture stays EXACTLY at its baseline commit — the strongest proof
// that a rerun mutates nothing and touches no Git state.
//
// Assets are read and per-install-substituted (date/project/pm) via the shared
// pure asset helper so the fixture is a genuinely current install. The helper is
// NOT a shared fixture module — this case still owns its own inputs and
// assertions; only the stateless asset-substitution boilerplate is shared, and
// the install date is computed at build time (not hardcoded) so the no-op proof
// reproduces on any calendar day.
import { asset, installed, indexMd, AGENTS } from '../_setup-assets.mjs';

export default {
  skill: 'docs-setup',
  // No follow-up: a current target is a no-op, so there is nothing to approve —
  // turn 1 audits, classifies current, reports a no-change plan, and writes
  // nothing.
  followUps: [],
  inputs: [
    { path: 'CLAUDE.md', content: '@AGENTS.md\n' },
    { path: 'AGENTS.md', content: AGENTS },
    { path: 'README.md', content: '# fixtureproj\n\nA fixture project. (SENTINEL readme-keep-me)\n' },
    {
      path: 'package.json',
      content: `${JSON.stringify(
        {
          name: 'fixtureproj',
          private: true,
          scripts: {
            'docs:validate': 'node scripts/validate-docs.mjs',
            'docs:validate:test': 'node --test scripts/validate-docs.test.mjs',
          },
        },
        null,
        2,
      )}\n`,
    },
    { path: 'package-lock.json', content: '{\n  "lockfileVersion": 3\n}\n' },
    // Every managed file present and current (byte-identical to the assets, with
    // the same per-install substitutions docs-setup applies).
    { path: 'scripts/validate-docs.mjs', content: asset('scripts/validate-docs.mjs') },
    { path: 'scripts/validate-docs.test.mjs', content: asset('scripts/validate-docs.test.mjs') },
    { path: 'docs/index.md', content: indexMd },
    { path: 'docs/log.md', content: installed('docs/log.md') },
    { path: 'docs/conventions/index.md', content: asset('docs/conventions/index.md') },
    { path: 'docs/conventions/documentation.md', content: installed('docs/conventions/documentation.md') },
    { path: 'docs/glossary/index.md', content: asset('docs/glossary/index.md') },
    { path: 'docs/references/index.md', content: asset('docs/references/index.md') },
    { path: 'docs/references/okf.md', content: installed('docs/references/okf.md') },
  ],
  assertions: [
    // Live AC evidence: turn 1 recomputed state and classified the target as
    // current with a NO-CHANGE plan (idempotent rerun).
    { type: 'output-contains', value: 'no-change' },
    // Headline: on a current target NOTHING is written — the fixture stays
    // EXACTLY at its baseline commit (no writes, no staging, no commit, no
    // remote). This proves both the no-op classification and idempotency.
    { type: 'git-unchanged' },
    { type: 'portable-contract' },
  ],
};
