---
name: docs-validate
description: Validate the docs/ OKF bundle for conformance (parseable frontmatter + non-empty type) and report soft warnings. Use when the user asks to "validate docs", "check the docs bundle", "find docs conformance issues", or invokes /docs-validate directly.
---

# docs-validate

## First, read the canonical policy

**MANDATORY:** read `docs/conventions/documentation.md` first — it defines the
frontmatter standard, reserved-file rules, and what is hard vs soft. This skill does not
restate them.

## The command

Run from the **repo root** (your Claude launch directory):

```
npm run docs:validate
```

It walks every `.md` file under `docs/` uniformly (non-Markdown sidecars are ignored;
there is no exclusion or suppression grammar) and prints a report. Do not pass flags —
the script accepts only an optional root path argument and has no flags or alternate
strict entrypoint.

```
"docs:validate": "node scripts/validate-docs.mjs"
```

## The exit contract (strict)

| Exit | Meaning                                                                  |
| ---- | ------------------------------------------------------------------------ |
| `0`  | Clean, or warnings only. Warnings never block.                           |
| `1`  | One or more hard bundle errors (unparseable frontmatter; bad `type`).    |
| `2`  | Validator malfunction — e.g. a missing or unreadable docs root.          |

## How to read the output

| Section                               | Meaning                                                                                                                                                             | Action                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ERRORS — OKF §9 conformance`         | A non-reserved file's frontmatter is not a parseable YAML mapping (missing/unterminated `---` delimiters, invalid YAML, duplicate keys, non-mapping) or `type` is missing, empty, or non-scalar. **This is the hard bar.** | Fix the frontmatter before considering the bundle conformant.      |
| `Warnings — recommended/soft`         | Missing `title`/`description`/`timestamp`, malformed timestamp, `status: superseded` without `superseded_by`, broken internal link, reserved-file structure, missing local `index.md`, concepts not linked by exact bundle path from their local index, or a `timestamp` older than the newest dated `# Amendments` entry. | Triage. Broken links may be not-yet-written knowledge (tolerated). |
| `OKF bundle conformant; no warnings.` | Clean.                                                                                                                                                                | Report success.                                                    |

## Resolution flow

1. Show the user the full report.
2. **Errors** — for each, open the file and add/fix the `type` (and the `---` fences).
   Propose the edit; apply only after the user approves.
3. **Warnings** — propose fixes (add recommended fields, fix the link target or remove
   the link, add the missing `index.md` entry, bump a stale `timestamp`). Apply only
   after approval.
4. Re-run `npm run docs:validate` and confirm it exits `0` with an empty ERRORS section.

## Enforcement recipes (documented, never auto-installed)

The strict exit makes the command hook- and CI-ready. Wire the **pre-push** hook with
whichever recipe matches what the repo already uses — never install husky or add
package lifecycle (`prepare`) scripts for this:

- **Plain Git hook** (no dependencies): create `.git/hooks/pre-push` containing
  `npm run docs:validate` and mark it executable.
- **husky v4** (only if the repo already uses husky v4): add to `package.json`:
  `"husky": { "hooks": { "pre-push": "npm run docs:validate" } }`.
- **husky v8/v9** (only if the repo already uses husky v8/v9): append
  `npm run docs:validate` to `.husky/pre-push`.

An optional minimal GitHub Actions workflow (shipped by setup as
`github/workflows/docs-validate.yml`, installed to `.github/workflows/`) runs the same
command on pull requests; exit `1` fails the job.

## Things to NEVER do

- Never treat a warning as a failure — warnings never block and there is no suppression
  grammar; broken links and missing optional fields are tolerated by OKF.
- Never add frontmatter to a non-root `index.md` to "fix" it — that is itself a violation.
- Never invent CLI flags (`--fix`, `--json`, `--strict`); there are none.
- Never install husky (or any hook manager) just to enforce validation — use the recipe
  matching what the repo already has.
