# Skills

44 composable agent skills for real engineering — merged from [obra/superpowers](https://github.com/obra/superpowers) and [mattpocock/skills](https://github.com/mattpocock/skills). Planning, TDD, debugging, code review, grilling, domain modeling, and delivery workflows.

## Installation

### Claude Code

```bash
claude plugins install skills
```

Or from inside a session:

```
/plugin install skills
```

Also available via marketplace:

```
/plugin marketplace add artemVeduta/skills
/plugin install skills@skills
```

### Codex

```
/plugin install skills
```

### OpenCode

```
Fetch and follow instructions from https://raw.githubusercontent.com/artemVeduta/skills/main/.opencode/INSTALL.md
```

## How It Works

Skills trigger automatically. Your agent sees you want to build something and steps back — asks what you're really trying to do, teases out a spec, builds a plan, then dispatches subagents to execute each task with TDD, code review, and verification at every step.

Or you invoke skills directly: `/grilling` to align on design, `/tdd` for red-green-refactor, `/to-spec` to write a spec.

## Skills Index

### Workflow & Quality (from superpowers)

- **brainstorming** — Socratic design refinement, saves design doc
- **subagent-driven-development** — Dispatch fresh subagent per task, two-stage review
- **dispatching-parallel-agents** — Concurrent subagent workflows
- **finishing-a-development-branch** — Verify, present merge/PR options, clean up worktree
- **using-git-worktrees** — Isolated workspace per branch, clean test baseline
- **test-driven-development** — RED-GREEN-REFACTOR, deletes code written before tests
- **verification-before-completion** — Evidence before claiming done

### Collaboration (from superpowers)

- **requesting-code-review** — Pre-review checklist against plan
- **receiving-code-review** — Respond to feedback with technical rigor

### Meta (from superpowers)

- **using-superpowers** — Introduction to the skills system
- **writing-skills** — Create new skills following best practices

### Engineering — User-invoked (from mattpocock)

- **ask-matt** — Router: which skill fits your situation
- **grill-with-docs** — Grilling session that builds domain model, ADRs
- **triage** — Move issues through triage state machine
- **improve-codebase-architecture** — Scan codebase for deepening opportunities, visual HTML report
- **setup-matt-pocock-skills** — Configure repo for the engineering skills
- **to-spec** — Turn conversation into a spec, publish to issue tracker
- **to-tickets** — Break plan into tracer-bullet tickets with blocking edges
- **implement** — Build work described by spec/tickets, drive /tdd at seams
- **wayfinder** — Plan huge work as shared map of decision tickets

### Engineering — Model-invoked (from mattpocock)

- **prototype** — Throwaway prototype to answer design question
- **diagnosing-bugs** — Disciplined 6-phase diagnosis: feedback loop → minimise → hypothesise → instrument → fix → post-mortem. Includes root-cause-tracing, defense-in-depth, and condition-based-waiting techniques.
- **research** — Investigate against primary sources, capture as cited Markdown
- **tdd** — Red-green-refactor, one vertical slice at a time
- **domain-modeling** — Build and sharpen project's domain model
- **codebase-design** — Vocabulary for designing deep modules
- **resolving-merge-conflicts** — Resolve hunk by hunk, traced to intent
- **wizard** — Generate interactive bash wizard for manual steps

### Productivity — User-invoked (from mattpocock)

- **handoff** — Compact conversation into handoff document
- **teach** — Teach a skill or concept over multiple sessions
- **to-questionnaire** — Turn undecided question into Markdown questionnaire
- **wait-what** — Re-pitch the last message with missing context

### Productivity — Model-invoked (from mattpocock)

- **grilling** — Interview the user relentlessly about a plan, decision, or idea until every branch is resolved
- **writing-for-agents** — Writing documents for agents: skills, AGENTS.md, etc.

### Misc & In-progress

- **git-guardrails-claude-code** — Git safety rules for Claude Code
- **migrate-to-shoehorn** — Migration helper
- **scaffold-exercises** — Exercise scaffolding
- **setup-pre-commit** — Pre-commit hook setup
- **claude-handoff** — Handoff for Claude (beta)
- **loop-me** — Iteration loop (beta)
- **setup-ts-deep-modules** — TypeScript deep module setup (beta)
- **writing-beats** — Story beats writer (beta)
- **writing-fragments** — Fragment writer (beta)
- **writing-shape** — Shape writer (beta)

## Philosophy

- **Test-Driven Development** — Write tests first, always
- **Systematic over ad-hoc** — Process over guessing
- **Simplicity** — Complexity reduction as primary goal
- **Small skills, composable** — Each skill does one thing, skills compose
- **Seam-first design** — Care about module boundaries before writing code
- **Evidence over claims** — Verify before declaring success

## License

MIT — see [LICENSE](LICENSE)
