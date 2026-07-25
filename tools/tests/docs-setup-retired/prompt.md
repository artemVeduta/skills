Converge THIS repository onto the current OKF (Open Knowledge Format) documentation installation contract using the docs-setup skill.

This repository was configured by an EARLIER docs-setup revision. Its managed machinery is current — the canonical validator and its test, both `docs:validate` package scripts, the marked Documentation router, the `CLAUDE.md` shim, the seed lifecycle policy, and the OKF reference. It has also accumulated real project documentation since then.

Do NOT ask any questions about the inputs; they are all below:

- Target repo root: the current working directory
- Project name: FixtureProj
- Package manager: npm

Run the mandatory read-only audits and recompute the actual state from the repository itself — do NOT read or write any suite-version or state file. Audit the retired managed surfaces specifically. For each retired path you find, classify it and say WHY:

- Is it **proven** obsolete — byte-identical to a copy this suite shipped for that path, or carrying a marker that proves suite ownership? Then plan it as an ordinary removal in the plan, so the cleanup is visible and I approve it.
- Is it **customized or uncertain** — differing from every copy you know and carrying no owner marker, or of provenance you cannot establish? Then present it as a CONFLICT and ask me for an explicit keep-or-remove decision. Do not assume my content is disposable.
- Is it **missing**? Then it is a no-op; do not report it as work.

Never treat project knowledge as a cleanup target: no concept, no `index.md`, no `log.md`, no subsystem content.

Present your COMPLETE plan in one message — the classification, every action by class (create / replace / no-op / preserve / skip / delete), and every conflict and ambiguity — and STOP. Write nothing yet. Do NOT stage, commit, push, or open a pull request.
