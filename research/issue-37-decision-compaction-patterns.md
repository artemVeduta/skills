# Decision and log compaction — precedents and constraints

> Evidence for Wayfinder ticket [#37](https://github.com/artemVeduta/skills/issues/37),
> “Decision and log compaction: one record at PR time.” Researched 2026-07-22
> against Google OKF v0.1, official Git documentation, Michael Nygard's original
> ADR proposal, AWS Prescriptive Guidance, and the UK Government Digital Service
> (GDS) standard. This note separates upstream requirements from policy choices;
> it does not change the repository's current documentation lifecycle.

## Executive findings

1. **OKF permits latest-state compaction but does not prescribe it.** Concept bodies
   are free-form Markdown with no required sections. `log.md` is optional. OKF does
   not define an amendment section, append-only decisions, one-entry-per-edit logs,
   or a PR lifecycle. It recommends Git distribution because Git supplies history,
   attribution, and diffs. [OKF §§3–4, 7, 9][okf-spec]
2. **The defensible compaction boundary is acceptance, not each editing step.** AWS
   explicitly allows the owner to approve changes while an ADR is Proposed, then
   treats it as immutable after acceptance or rejection. GDS is even more directly
   applicable to PR workflows: the PR represents the proposed state and presence on
   `main` represents acceptance. These are strong precedents for folding iterations
   from one still-open decision process into one coherent record before merge.
   [AWS ADR process][aws-adr] [GDS lifecycle][gds-source]
3. **Accepted decisions need a durable boundary.** Nygard's original ADR proposal
   keeps a reversed decision and marks it superseded; AWS requires a new ADR to change
   an accepted one; GDS permits clarifications and added consequences in place, but
   calls for a new ADR once implementation of the original decision has occurred.
   The sources differ on minor post-acceptance edits, but none supports silently
   rewriting an implemented decision into a different choice. [Nygard ADR][nygard]
   [AWS ADR process][aws-adr] [GDS lifecycle][gds-source]
4. **Git is useful provenance, not a sufficient portable audit record by itself.**
   Git explicitly supports rewriting and squashing before work is shared, while
   warning that pushed work should ordinarily be treated as final. A squash merge
   creates one commit with the branch's effect but does not record merge information.
   Therefore a policy cannot assume that every draft commit or branch topology will
   remain reachable from the mainline. [Git rewriting history][git-rewrite]
   [Git merge `--squash`][git-merge]
5. **The smallest robust retained trace is final rationale plus one accepted-change
   pointer.** The final Decision should still explain context, the choice, and its
   consequences; one dated `log.md` entry can name and link the Decision and summarize
   the net effect. A PR or commit link is a useful house-policy addition. If the change
   crosses an earlier acceptance/implementation boundary, retain an explicit
   supersession link instead of compacting the earlier accepted state away.

## Upstream requirements and precedents

### Google OKF v0.1

The normative OKF contract leaves lifecycle policy to the producer:

- A concept is a Markdown body plus frontmatter. Only non-empty `type` is required;
  there are no required body sections. `timestamp` is optional and means the time of
  the last meaningful change. [OKF §§4.1–4.2][okf-concepts]
- `log.md` is optional. When present it is a flat, newest-first list grouped by ISO
  `YYYY-MM-DD` headings. Entries are prose, and even their leading action word is only
  a convention. [OKF §7][okf-log]
- Git is a recommended distribution form specifically because it provides history,
  attribution, and diffs. [OKF §3][okf-structure]
- Conformance does not mention Decisions, ADRs, amendments, PRs, immutability,
  supersession, or the number of log entries associated with a change. OKF is
  intentionally minimally opinionated; producer rules beyond its small
  interoperability surface are allowed. [OKF §§1, 9][okf-conformance]

Consequently, replacing several same-PR amendment fragments with one latest-state
body and one conformant log entry remains valid OKF. Conversely, OKF cannot be cited as
requiring that behavior. The current repository rule to append dated `# Amendments`
and never rewrite a Decision is a producer convention, not an OKF requirement.

### ADR lifecycle guidance

Three first-party sources establish a useful acceptance boundary:

- **Before acceptance:** AWS says content changes before acceptance are approved by
  the ADR owner; review actions keep the ADR in Proposed state until it is ready.
  [AWS adoption process][aws-adr]
- **PR as proposal:** GDS says a decision's PR status represents its status until
  acceptance, and an ADR on `main` can be treated as accepted. This maps the draft to
  accepted transition directly onto PR merge. [GDS proposed and accepted states][gds-source]
- **After acceptance:** AWS treats accepted or rejected ADRs as immutable and requires
  a new ADR for change, with the old ADR marked Superseded if the replacement is
  accepted. [AWS review process][aws-adr]
- **After implementation:** GDS allows in-place clarification and new consequences,
  and may allow a new decision in the existing ADR if the prior choice was never
  implemented and stakeholders agree. Once some implementation exists, it directs
  the team to write a new ADR; a superseded ADR links to its replacement.
  [GDS implementation and supersession][gds-source]
- **Original ADR intent:** Nygard defines one short record per significant decision,
  preserving context, decision, status, and consequences. If reversed, the old record
  remains and points to its replacement because it is still relevant that it once was
  the decision. [Nygard ADR][nygard]

These sources support compaction of *iterations toward one proposed decision*. They
also constrain compaction: it must not erase evidence that a materially different
decision was previously accepted or implemented.

### Git history behavior

Official Git documentation supports tidying a proposal before it becomes shared
history:

- Git's history-rewriting guidance explicitly allows reordering, editing, squashing,
  splitting, or removing local commits before sharing. `commit --amend` replaces the
  previous commit; interactive rebase `squash` combines commits into one. The same
  guidance says pushed work should ordinarily be treated as final. [Git rewriting
  history][git-rewrite]
- `git merge --squash` prepares the aggregate tree/index effect and permits one new
  commit, but does not move `HEAD` or record `MERGE_HEAD`; the resulting commit is not
  a merge commit carrying the branch-parent relationship. [Git merge
  `--squash`][git-merge]

The inference is narrow: Git provides a good record of *committed, retained history*,
but the project must not rely on draft commits as its only durable explanation. A
squash workflow can intentionally reduce mainline history to one result, and Git does
not preserve PR review conversation. The final Decision and a mainline log pointer
therefore carry semantic history that survives repository hosting and merge-policy
changes.

## Minimum trace that should remain

The following is the smallest trace supported by the combined evidence. Only the
format constraints called out below come from OKF; the selection of these fields as a
house minimum is a policy proposal.

1. **One coherent final Decision.** Preserve the accepted context, decision, and
   consequences. Preserve alternatives where they explain why the chosen option won;
   this repository already treats Decisions as the authority for rationale and
   alternatives. Do not retain superseded wording merely to narrate drafting churn.
2. **One entry for the net PR effect in the nearest `log.md`.** Use an ISO date heading
   and a short prose item that includes an action, a link to the Decision, and the net
   outcome. Example:

   ```markdown
   ## 2026-07-22
   * **Update**: Revised [Documentation lifecycle](/conventions/documentation.md) to compact same-PR decision iterations into one accepted record ([PR #37](https://github.com/artemVeduta/skills/pull/37)).
   ```

   The date shape and newest-first organization are OKF constraints when a log exists;
   the action label, concept link, net-effect wording, and PR link are house choices.
3. **A last-meaningful-change timestamp if the producer uses one.** OKF recommends but
   does not require `timestamp`; this repository already recommends it. One final
   timestamp is preferable to preserving timestamps for every transient draft.
4. **An accepted-state link when the boundary was crossed.** If an earlier materially
   different decision reached `main` or guided implementation, keep it as a separate
   record, mark it superseded, and link old and new. Do not collapse both accepted
   states into a single latest-state file.
5. **Repository provenance as a supplement.** The merge/squash commit and PR link can
   supply authorship, review, and detailed diff context. They supplement the portable
   Decision/log trace; they do not replace it.

No upstream source requires preserving each rejected sentence, intermediate amendment
heading, duplicated same-PR log entry, fixup commit, or review comment inside the OKF
bundle.

## House-policy choices the ticket must make

The following decisions cannot be attributed to OKF or Git:

- Define “same decision episode” as changes made before the Decision is accepted on
  `main`, normally one PR. This is strongly supported by GDS/AWS precedent but remains
  the repository's lifecycle rule.
- Decide whether compaction occurs when opening the PR, when marking it ready, or just
  before merge. The cleanest invariant is “the PR diff contains one coherent Decision
  and one net log entry”; review-time corrections may update those same two records.
- Decide whether a PR URL is mandatory in the log. It improves traceability but couples
  the bundle to the forge. A merge-commit identifier is another house option and is
  weaker under migration; neither is specified by OKF.
- Define what counts as a harmless clarification versus a new decision after
  acceptance. A conservative rule—new record once the choice or implementation
  changes—satisfies AWS, GDS, and Nygard simultaneously.
- Choose whether same-PR `# Amendments` sections are prohibited, removed during
  compaction, or merely warned on. OKF has no amendment concept.

## Local-policy conflict to resolve

The present [documentation lifecycle convention][local-convention] says that revising
or reversing a Decision must append a dated `# Amendments` entry, add a `log.md` line,
and “do not rewrite history.” It also lists `# Amendments` in the conventional Decision
body. The [skills-platform PRD][local-prd] says governing Decisions remain authoritative
for rationale, alternatives, and amendments.

Adopting PR-time compaction therefore requires an explicit house-policy change. A
compatible formulation would distinguish:

- **proposed/same-PR iterations:** rewrite to one latest-state body and one log entry;
- **accepted but unimplemented clarification:** update in place under a narrowly
  defined rule, retaining one net log entry;
- **accepted and materially changed or implemented:** create a replacement Decision
  and retain the supersession trail.

That change would preserve the local PRD's rationale/alternatives authority while
removing drafting residue. It must not be presented as an OKF v0.1 requirement.

## Sources

- [Google OKF v0.1 specification at researched commit][okf-spec]
- [Google Cloud announcement: OKF is minimally opinionated][google-blog]
- [Git: Rewriting History][git-rewrite]
- [Git: `git merge --squash`][git-merge]
- [Michael Nygard: “Documenting Architecture Decisions”][nygard]
- [AWS Prescriptive Guidance: Architectural decision record process][aws-adr]
- [UK GDS: Documenting architecture decisions, source at researched commit][gds-source]
- [Local documentation lifecycle convention][local-convention]
- [Local skills-platform PRD][local-prd]

[okf-spec]: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/SPEC.md
[okf-structure]: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/SPEC.md#3-bundle-structure
[okf-concepts]: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/SPEC.md#4-concept-documents
[okf-log]: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/SPEC.md#7-log-files-optional
[okf-conformance]: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/d44368c15e38e7c92481c5992e4f9b5b421a801d/okf/SPEC.md#9-conformance
[google-blog]: https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing
[git-rewrite]: https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History
[git-merge]: https://git-scm.com/docs/git-merge#Documentation/git-merge.txt---squash
[nygard]: https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
[aws-adr]: https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html
[gds-source]: https://github.com/alphagov/gds-way/blob/e186ef046ce908fcc7f7c6b265cfb1ccd22628b8/source/standards/architecture-decisions.html.md.erb
[local-convention]: ../docs/conventions/documentation.md
[local-prd]: ../docs/specs/skills-platform.md
