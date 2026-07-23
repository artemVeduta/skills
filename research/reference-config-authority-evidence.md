# Config-value authority — evidence bundle (ticket #32)

Gathered 2026-07-20/21 by a 4-agent dynamic workflow (field audit, validator internals,
rule-text survey, check-design sketch) for
[wayfinder ticket #32](https://github.com/artemVeduta/skills/issues/32) on
[map #28](https://github.com/artemVeduta/skills/issues/28). Working-tree asset, like
`reference-okf-docs-v2-recon.md`.

## 1. Field audit — ws-2026-fantasy-team

### The four audited constants (all in sync at audit time)

| Constant | Code | Doc sites (betting-policy.md) | Doc form |
|---|---|---|---|
| `KELLY_FRACTION = 0.50` | `scripts/betting/engine.py:19` | :16, :93 (`KELLY_FRACTION = 0.50` assignment spans), :102 (name-only) | assignment-style inline code |
| `TIER_CAPS = {"low": 0.10, "med": 0.075, "high": 0.05}` | `scripts/betting/engine.py:20` | :96, :104 as **percentages** "10% / 7.5% / 5%"; :39 bare "**5%**" | percent prose — representation diverges from code decimals |
| `MODEL_FLOOR = 0.50` | `scripts/prediction/edge.py:22` (with back-ref) | :50 bare **0.50**, :89, :232 + :253 assignment-style in amendments | three distinct textual forms in one doc |
| `SHRINK_ANCHORS` (6 tuple pairs) | `scripts/prediction/reliability.py:12-19` | :55/:57 markdown **table**; origin anchor (0.0, 0.0) code-only/implied | table vs tuple-of-tuples — hardest shape to compare |

~18 further values duplicated and verified in sync (MAX_ODDS, gaps/tolerances, EDGE_CAP,
MIN_EDGE, stakes, draw floor, gate thresholds, ten `REC_*` constants, Polymarket
qualifiers as **unnamed inline literals** `100000 / 0.03 / 15` vs doc "$100k / 3¢ / 15
minutes"). Counter-example done right: `MAX_OPEN_EXPOSURE = 0.25` (engine.py:21) appears
nowhere in docs.

### The decisive finding: the drift checker itself drifted

`tests/test_policy_drift.py` — a hand-rolled sync test with dual-form regexes
(`r"\b7\.5%\b|\b0\.075\b"`) — pins draw floor **0.29** (:19) while policy and code moved
to **0.33** on 2026-07-01. The test currently FAILS (verified by running pytest). Zero
drift exists across ~22 live values; the only drift anywhere is inside the sync
machinery. Pinned-value lists rot faster than what they guard.

### Back-ref census (code → doc comments)

10 comment/docstring back-refs across scripts/ + tests/ (canonical form:
`MODEL_FLOOR = 0.50  # betting-policy.md: model-path floor…`, plus parenthetical,
block-comment "See <path>", and module-docstring variants). Coverage: **2 of 4** audited
constants — `engine.py` (KELLY_FRACTION, TIER_CAPS, MIN_STAKE, FORCED_STAKE) carries
none; there the reference runs doc→code instead. The convention decayed unenforced.

### Authority contradiction (live)

`betting-policy.md` self-declares: "Numeric thresholds live only in
`docs/conventions/betting-policy.md`… this concept is the authority" — spec-first, the
opposite of the suite's code-authoritative rule fixed by #31.

## 2. Validator internals (scripts/validate-docs.mjs)

- Single ESM script; walks docs/, hand-rolled scalar-only frontmatter parser; findings
  are plain strings in `{errors, warnings}`; **always exits 0** (advisory).
- Standing invariants a sync check would break: **docs-only reads** (nothing outside
  rootDir today) and **zero config** (argv[2] root + hard-coded exclusion set only).
- Hook points: per-file (beside `checkLinks`) or aggregate (beside
  `checkIndexCoverage`). Any change must be byte-mirrored to
  `skills/okf-docs-setup/assets/scripts/validate-docs.mjs` + tests + SKILL.md manifest
  (byte-exact-assets convention; mechanization is #43).
- Source globs exist per-install only as the `<source-edit-path-glob>` substitution into
  a Claude rule file the validator never reads — and this repo's own installed copy
  (`.claude/rules/docs-maintenance.md`) has no `paths:` frontmatter at all.

## 3. Rule text — four near-identical layers

1. `docs/conventions/documentation.md` (repo) — "The bundle holds explanatory truth and
   **points at** executable truth — it never copies it… **Do not paste executable truth
   verbatim.** Reference it — name the file and symbol, or link it."
2. `skills/okf-docs-setup/assets/docs/conventions/documentation.md` — byte-identical on
   those sections.
3. `assets/claude/rules/docs-authoring.md` — condensed "referenced, never pasted".
4. Installed fantasy-team copy — adds one extra Linking bullet ("Docs must not duplicate
   executable logic from scripts; cite the governing script or policy instead").

Citation syntax actually used in the live bundle: markdown `[Title](/path.md)` links
confined to index/log/documentation.md; concept bodies cite code via **inline-code paths
and symbol names** (`engine.TIER_CAPS`, `scripts/betting/match_cap.py`); zero anchors,
zero relative links.

## 4. Check-design sketch — candidates and why each lost

- **A. Tag-keyed sync check** (`<!-- okf-sync: path#CONST -->`): fails loud on missing
  targets (the one property the stale drift test lacked), but ~100–150 lines breaking
  docs-only + zero-config at once; FPs on amendment history and percent/currency/table
  normalization; coverage = retro-tagging effort, and parallel manual conventions
  demonstrably rot (back-refs at 50%).
- **B. Untagged heuristic grep** (`` `NAME = value` `` spans vs source globs): worst of
  all worlds — amendment sections are indistinguishable from live statements (built from
  exactly that pattern), the two highest-value constants (TIER_CAPS percentages,
  SHRINK_ANCHORS table) never match, and the config surface has nowhere portable to
  live. ~200–250 lines, all byte-mirrored.
- **C-lint. Presence lint** (~20 lines, flag assignment spans in live sections): cheap
  and invariant-preserving, but nags doc-authoritative repos and needs an
  amendments-exclusion convention.
- **D. Hybrid** (lint untagged + sync tagged + historical tag): highest complexity;
  migration noise burst (~20+ warnings day one in the exemplar); tag-rot escape hatch
  (swap to `historical`) silently unchecks live values.

Sketch recommendation was C-lint; the human decision went lighter (no check — policy
only) on the grounds that name-only makes current-value drift structurally impossible
and the failing drift test shows sync machinery is itself a liability.

## Outcome

Resolved on the ticket: code authoritative uniformly; name-only + historical value
policy; symbol-only citations; no validator check; back-refs out of policy. Full
decision text: [#32 resolution comment](https://github.com/artemVeduta/skills/issues/32).
