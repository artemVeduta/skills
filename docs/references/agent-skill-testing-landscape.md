---
type: Reference
title: Agent skill testing and benchmarking landscape
description: Primary-source survey of structural validators, behavioral evaluation harnesses, and benchmarking approaches for multi-harness agent skills.
timestamp: 2026-07-10
---

# Agent skill testing and benchmarking landscape

## Scope and conclusion

This survey examines how agent skills are validated and evaluated in public tooling, and
which approaches can support this library's OpenCode, Codex, and Claude harnesses. It
distinguishes structural validity, skill selection, behavioral correctness, and comparative
benchmarking because no single tool establishes all four.

The viable architecture is layered:

1. Run deterministic format, repository-invariant, dependency-graph, link, and script tests
   on every change.
2. Project each canonical `skills/<name>/` directory into an isolated fixture for each
   harness, then verify discovery and normalized adapter behavior without model calls where
   possible.
3. Run representative behavioral cases through OpenCode, Codex, and Claude with
   deterministic state assertions as the primary oracle.
4. Run repeated with-skill versus baseline comparisons, probabilistic trigger checks, and
   model-graded assertions on a schedule or at release time rather than as ordinary PR
   gates.

Promptfoo is the strongest existing common evaluation orchestrator. Harbor is the strongest
containerized end-to-end benchmark runner. Neither replaces repository-owned validation,
fixture projection, result normalization, or acceptance policy.

## Comparison matrix

| Approach | Establishes | Determinism | Cost | CI fit | Three-harness fit |
| --- | --- | --- | --- | --- | --- |
| Agent Skills format validation | Parseable, portable skill metadata | High | Local CPU | Blocking PR gate | High |
| Repository invariant checks | This library's structure and dependency contract | High | Local CPU | Blocking PR gate | High |
| Script unit and fixture tests | Deterministic bundled behavior | High when dependencies are pinned | Local CPU/container | Blocking PR gate | High |
| Harness discovery preflight | The projected skill is visible to a harness | High for fixed versions | Local process | Blocking smoke test | High with adapters |
| Headless behavioral run | A real agent can apply the skill to a task | Low to medium | Model inference | Small smoke suite or scheduled | High with adapters |
| Promptfoo | Shared cases, assertions, grading, and reports | Depends on assertion and provider | Model inference plus optional judges | Strong | High |
| Harbor | Isolated terminal tasks and state verification | Medium for environment, low for model behavior | Model plus container compute | Scheduled or small smoke suite | High |
| LLM grader or blind comparison | Semantic quality not reducible to state checks | Low to medium | Additional model calls | Advisory/release | High after normalization |
| skills.sh signals | Popularity and advisory security findings | Low and externally mutable | Network service | Poor as a gate | Distribution-only |

## Structural validation

The Agent Skills specification defines a skill as a directory containing `SKILL.md` with
YAML frontmatter and a Markdown body. It requires `name` and `description`, constrains their
formats and lengths, and requires the directory name to match the skill name. The reference
`skills-ref validate <path>` command checks those structural rules and returns a failing exit
status for invalid input.

That validator is a useful conformance oracle, but its own README describes it as a
demonstration rather than production software. It does not validate Markdown semantics,
local references, scripts, security, runtime dependencies, or behavior. Anthropic and
OpenAI also ship small `quick_validate.py` scripts with their skill-creator material, but
their accepted fields and edge cases differ. Running all of them as co-equal gates would
reject legitimate harness extensions without establishing behavioral quality.

This library therefore needs one pinned validator under the reserved `tools/` boundary with
separate layers:

- a portable Agent Skills format floor;
- repository rules for the flat `skills/<name>/` tree, README inventory, local links,
  cross-skill path prohibition, and byte-exact contracts;
- dependency checks for declared skills, missing nodes, cycles, transitive closure, and
  undeclared runtime invocations;
- opt-in harness profiles for fields or assets specific to OpenCode, Codex, or Claude;
- language-specific unit tests for executable material owned by each skill.

Pinned Markdown and offline-link tooling can complement that validator. External-link checks
remain network-dependent and should be advisory or scheduled.

## Anthropic skill evaluation workflow

Anthropic's public skill-creator material documents an experimental method rather than a
turnkey test service. Its central pattern is to run each realistic task with the skill and
without it, or against the previous version, in clean sessions. The workflow records outputs,
transcripts, timing, token use, assertions, and aggregate deltas. Programmatic graders are
preferred; natural-language assertions use an LLM grader and may be supplemented by blind
A/B comparison and human review.

The repository includes grader and comparator prompts, an aggregate benchmark script, and a
trigger-description optimizer. The aggregator is deterministic once result files exist, but
the agent and grader runs are not. The trigger optimizer is Claude-specific and can require
hundreds of calls at its documented defaults. There is no public cross-harness conformance
suite or evidence that the example skills are continuously behavior-tested.

The transferable design is the paired baseline, isolated trials, deterministic assertions,
multiple attempts, and preserved provenance. The Claude-specific trigger runner should not
be adopted as the library's common authority.

## skills.sh and the skills CLI

The `skills` CLI discovers and installs minimally parseable `SKILL.md` files. Its parser
requires string `name` and `description` values but does not enforce the full Agent Skills
specification. The skills.sh directory ranks skills from deduplicated installation telemetry;
its “official” designation identifies first-party authorship rather than benchmarked quality.

skills.sh also displays asynchronous third-party security audits. These are advisory: audit
timeouts, missing results, or critical findings do not make installation fail. They are
valuable external risk signals, but they do not prove functional correctness and are not a
stable deterministic CI contract. This library should treat skills.sh as a distribution,
discovery, popularity, and security-signal channel only.

## Direct headless harness execution

All three target harnesses expose programmatic execution, but their configuration, event,
permission, and skill-discovery contracts differ.

### OpenCode

`opencode run --format json --dir <fixture> <prompt>` emits newline-delimited execution
events, including completed tool calls and step-finish cost and token data. The v2 SDK can
create isolated sessions, subscribe to events, abort runs, and request JSON-Schema-constrained
model output. OpenCode discovers project skills in `.opencode/skills`, `.agents/skills`, and
`.claude/skills`; its native `skill` tool gives direct selection evidence.

Tests must isolate `HOME`, all XDG roots, OpenCode configuration, project files, plugins,
and credentials. OpenCode permissions are policy gates, not an operating-system sandbox, so
write-enabled tests still need a disposable workspace or container.

### Codex

`codex exec --ephemeral --json --output-schema <file> <prompt>` provides non-interactive
execution, JSONL events, structured output, usage data, and filesystem sandbox modes. Clean
tests require isolated `HOME` and `CODEX_HOME`, ignored user configuration and rules, and a
fixture containing `.agents/skills/<name>/SKILL.md`.

Codex does not expose the same first-class skill-call event as OpenCode. Tooling may infer
selection from a successful read of the expected `SKILL.md`, but behavioral assertions must
remain authoritative. A process timeout and external usage accounting are needed because the
stable CLI does not provide Claude's per-run turn and dollar caps.

### Claude

`claude -p` supports JSON or stream-JSON output, JSON-Schema-constrained results, isolated
session persistence, tool allow/deny lists, turn limits, and an estimated dollar budget.
Claude Agent SDK adds typed events, hooks, cancellation, and explicit environment control.
Project skill tests place the skill under `.claude/skills/<name>/SKILL.md` and use an isolated
`CLAUDE_CONFIG_DIR`.

Tool permissions are not an outer sandbox. The `--bare` flag is useful for generic isolation
but skips project skills, so direct skill tests require a clean fixture and explicit setting
sources instead.

### Common adapter contract

A repository-owned adapter layer should normalize, at minimum:

- status, terminal error, and final output;
- structured result and produced artifacts;
- tool calls and successful skill-selection evidence;
- token categories, estimated cost, duration, and harness/model versions;
- raw trace location and fixture/skill digest.

The fixture builder should project the canonical skill into each harness's discovery path
without modifying the source. Discovery, selection, and successful application are separate
assertions. Exact transcript or prose equality across harnesses is not meaningful.

## Promptfoo

Promptfoo provides official Claude Agent SDK, Codex SDK, and OpenCode SDK providers, plus
custom script and JavaScript provider interfaces. Its skill-testing guide covers fixture
workspaces, positive and negative routing cases, `skill-used` assertions, structured output,
and cross-provider comparison. It also supplies deterministic and model-graded assertions,
caching, repeats, concurrency controls, result exports, and CI-oriented exit statuses.

Its normalized skill-selection evidence is not equally strong across providers: OpenCode and
Claude expose native skill calls, while Codex selection is inferred from a successful skill
file read. Promptfoo also does not own canonical-skill projection or fully isolate inherited
harness configuration. Repository code must prepare disposable fixtures and normalize policy
around those provider differences.

Promptfoo is viable as the shared case runner and reporter, provided its version is pinned
and deterministic fixture/state assertions remain the required gates. Caching is useful for
local economics but must be disabled for runs intended to measure variance.

## Harbor and Terminal-Bench

Harbor is the current execution framework from the Terminal-Bench maintainers. A task packages
instructions, an isolated environment, an optional reference solution, and an executable
verifier that emits one or more numeric rewards. Harbor records trial artifacts, trajectories,
usage, cost, and provenance, and supports repeated attempts and custom dataset metrics.

Harbor can inject arbitrary local or Git-hosted skills and has installed-agent adapters for
OpenCode, Codex, and Claude Code. It projects skills into each adapter's expected location.
This makes it a strong fit for stateful end-to-end tasks, cross-harness comparisons, hidden or
separate verifiers, and no-network container tests.

The full Terminal-Bench dataset is not a suitable routine regression suite for a personal
skill library. A small repository-owned Harbor dataset would provide more representative
fixtures and stable acceptance criteria. Container startup, model calls, repeated attempts,
and fast-moving framework releases make Harbor better suited to scheduled, release, or tiny
smoke suites than to every PR.

## Grading and comparison design

The oracle hierarchy should be:

1. executable tests and expected filesystem or structured state;
2. schema, exact, containment, and bounded resource assertions;
3. successful skill-selection and allowed-trajectory evidence as diagnostics;
4. rubric-based model grading only for semantic qualities that cannot be encoded;
5. blind comparison and human review for high-impact releases.

Behavioral cases need repeated fresh runs. Reports should retain individual trials and show
pass rate, score distribution, duration, token use, cost, and paired delta against no-skill or
previous-version baselines. A single stochastic failure should not be disguised as a
deterministic regression, and aggregate means should not hide consistently weak individual
tasks.

## Viable architecture for this library

The survey supports the following inputs to the later testing-architecture decision:

- own the portable validator, repository checks, fixture projection, normalized result
  schema, and acceptance policy under `tools/`;
- keep test cases and executable support material with clear ownership while avoiding
  cross-skill filesystem dependencies;
- implement OpenCode, Codex, and Claude adapters against one shared corpus;
- use Promptfoo experimentally for provider orchestration, assertions, and reports rather
  than making its metadata the repository's source of truth;
- use Harbor for containerized stateful benchmarks that justify its setup cost;
- make deterministic validation and script tests blocking on PRs;
- keep model-backed smoke tests small, isolated, and budgeted;
- run repeated trigger, semantic, paired-baseline, and multi-model comparisons on demand or
  on a schedule with raw artifacts retained.

## Risks and unresolved decisions

- Promptfoo and Harbor are moving quickly; versions and provider behavior must be pinned and
  reviewed before adoption.
- Skill-selection observability differs across harnesses, especially Codex's inferred signal.
- The later architecture must decide the common case manifest, normalized result schema,
  fixture ownership, trial counts, thresholds, artifact retention, and baseline-update policy.
- Model identifiers, provider pricing, and harness versions are part of benchmark provenance;
  a score without them is not comparable.
- API credentials, inherited configuration, network access, and writable tools require an
  explicit threat model and disposable execution boundary.

# Citations

- [Agent Skills specification](https://agentskills.io/specification) and the
  [`skills-ref` reference implementation](https://github.com/agentskills/agentskills/tree/38a2ff82958afee88dadf4831509e6f7e9d8ef4e/skills-ref).
- Anthropic's [Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills),
  [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions),
  and [`skill-creator` source](https://github.com/anthropics/skills/tree/9d2f1ae187231d8199c64b5b762e1bdf2244733d/skills/skill-creator).
- Anthropic's [programmatic Claude Code](https://code.claude.com/docs/en/headless),
  [CLI reference](https://code.claude.com/docs/en/cli-reference), and
  [Agent SDK skills](https://code.claude.com/docs/en/agent-sdk/skills).
- OpenAI's [Codex non-interactive mode](https://developers.openai.com/codex/non-interactive-mode),
  [CLI reference](https://developers.openai.com/codex/developer-commands?surface=cli#cli-codex-exec),
  and [skill documentation](https://developers.openai.com/codex/build-skills).
- OpenCode's [CLI](https://opencode.ai/docs/cli/), [SDK](https://opencode.ai/docs/sdk/),
  [skills](https://opencode.ai/docs/skills/), [configuration](https://opencode.ai/docs/config/),
  and [permissions](https://opencode.ai/docs/permissions/) documentation.
- skills.sh [documentation](https://skills.sh/docs), [API](https://skills.sh/docs/api),
  [audit directory](https://skills.sh/audits), and the
  [`vercel-labs/skills` source](https://github.com/vercel-labs/skills/tree/9513878d10e4fc1dc2aa4b03391aa558e1031056).
- Promptfoo's [agent skill testing guide](https://www.promptfoo.dev/docs/guides/test-agent-skills/),
  [OpenCode provider](https://www.promptfoo.dev/docs/providers/opencode-sdk/),
  [Codex provider](https://www.promptfoo.dev/docs/providers/openai-codex-sdk/),
  [Claude provider](https://www.promptfoo.dev/docs/providers/claude-agent-sdk/), and
  [assertion reference](https://www.promptfoo.dev/docs/configuration/expected-outputs/).
- Harbor's [task format](https://harborframework.com/docs/tasks),
  [skill injection](https://harborframework.com/docs/run-jobs/skills),
  [agent integrations](https://harborframework.com/docs/agents), and
  [dataset metrics](https://harborframework.com/docs/datasets/metrics), plus its
  [OpenCode adapter](https://github.com/harbor-framework/harbor/blob/main/src/harbor/agents/installed/opencode.py).
- [`markdownlint-cli2`](https://github.com/DavidAnson/markdownlint-cli2) and
  [lychee offline link checking](https://lychee.cli.rs/guides/cli/#--offline).
