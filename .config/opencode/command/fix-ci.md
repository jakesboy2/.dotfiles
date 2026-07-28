---
description: Diagnose and fix failing tests (and lint/typecheck) from a PR's CI run using the GitHub CLI, then verify the fixes locally
---

You are an expert software engineer tasked with fixing the failing CI checks on a pull request. You will locate the PR, pull the failing CI logs, reproduce the failures locally, fix them, and verify the fixes. The primary focus is failing **tests**, but the same flow applies to failing **lint** and **typecheck** checks that share the CI pipeline.

## Phase 0: Load supporting skills

Before running anything, load the skills you will need:

- Load the `test-running` skill for how to run and troubleshoot Jest in this monorepo.
- Load the `lint-running` skill if any failing check is a lint check.
- Use the `nx-project-for-file` tool to resolve the owning Nx project (and the exact typecheck/lint/test command) for any file you need to run locally. Do NOT hand-roll `nx graph`/`jq`.
- **Prefer the `ci-failures` tool** (available in the Commons repo's project tools) to pull the failing checks and their failure-log excerpts in one call. It collapses Phases 2–3 below — check discovery, run/job-id parsing, `gh run view --log-failed`, the reusable-workflow raw-log fallback, and the failure grep — into a single deterministic call. Load the `github-cli` skill only if you need to fall back to raw `gh` commands (e.g. working outside the Commons repo where the tool isn't available).

## Phase 1: Discover the PR

Parse the user prompt below for an optional PR number, URL, or branch:

<user-prompt>
$ARGUMENTS
</user-prompt>

- If a PR number/URL/branch was provided, use it directly.
- If no argument was provided, auto-detect the PR from the current branch:

```bash
gh pr view --json number,url,headRefName,headRefOid
```

If no PR is found, inform the user and stop.

Store the PR number for use in subsequent phases.

## Phase 2 + 3: Identify failing checks and pull their logs

**Call the `ci-failures` tool** — pass the PR number from Phase 1 (or no argument to auto-detect from the current branch). It returns each failing check with `name`, `workflow`, `link`, the path to the full captured log, and a grepped failure excerpt (`FAIL |✕|✗|Expected|Received|Error:`), handling both check-link formats, per-job resolution, and the reusable-workflow raw-log fallback automatically.

- If it reports **no failing checks**, everything is green — stop. It also notes any still-`pending` checks; if a relevant check is pending, tell the user and ask whether to wait (`gh pr checks PR_NUMBER --watch`) or proceed with only the currently-failed ones.
- From each excerpt, extract for each failure:
  - The failing **test file(s)** and individual test names, plus the assertion/error output, OR
  - For lint/typecheck: the offending file(s), rule/error codes, and line numbers.
- For a deeper look, read the full log at the path the tool prints (captured under `/Users/jacob.waldrip/tmp/opencode/`).

### Fallback (only if the `ci-failures` tool is unavailable — e.g. outside the Commons repo)

Load the `github-cli` skill and run the sequence manually:

```bash
gh pr checks PR_NUMBER --json name,state,bucket,link,workflow   # keep bucket == "fail"
gh run view <run-id> --log-failed                                # run-id = numeric segment after /runs/
```
- Narrow to one job: `gh run view <run-id> --job <job-id> --log-failed`.
- **Reusable / nested workflows** (e.g. `unit_test (jest-N)`): if the log is suspiciously short (~25 lines, all "Prepare/Download action"), fetch the raw archive instead:
  ```bash
  gh api repos/{owner}/{repo}/actions/runs/<run-id>/jobs --paginate \
    -q '.jobs[] | select(.conclusion=="failure") | {id, name}'
  gh api repos/{owner}/{repo}/actions/jobs/<job-id>/logs > /Users/jacob.waldrip/tmp/opencode/ci-fail.log
  ```
- Capture to a temp file and `grep -nE "FAIL |✕|✗|Expected|Received|Error:"` to extract specifics.

## Phase 4: Reproduce locally

1. Make sure you are on the PR's branch. If not, tell the user the working tree needs to change and ask before switching:

   ```bash
   gh pr checkout PR_NUMBER
   ```

   Do NOT switch branches silently.

2. Run `git status`, `git log --oneline -10`, and **`git show HEAD` (the full diff, not just `--stat`)** to
   confirm branch state and see exactly what the PR changed. For a failure in changed code, read the diff FIRST —
   it usually explains the behavior change directly. Do NOT theorize about schema/triggers/defaults before you
   have both (a) read the PR diff and (b) reproduced the failure locally.

3. For each failing file, use the `nx-project-for-file` tool to get the exact command, then run it locally to reproduce (per the `test-running` / `lint-running` skills). Reproduce before fixing — a failure you cannot reproduce is a signal, not a green light.

## Phase 5: Diagnose and fix

For each failure, first classify it:

- **Real defect introduced by this PR** — the failing file(s) are in the changeset (`git status`), or the failure clearly traces to changed code. Fix it.
- **Pre-existing / unrelated / environment / flaky** — the failing files are NOT in the changeset, or the failure is a known-flaky or infra issue. Per the repo's "Handling Pre-existing CI/Test Failures" guidance: do NOT rabbit-hole. Note it as pre-existing and surface it to the user rather than forcing a fix.
  - If Jest complains about a corrupt/missing migration directory or stale test DB, that is an environment issue — use the `reset-test-db` tool, do not treat it as a code defect.

When fixing:
- Make minimal, targeted changes that directly address the failure.
- Preserve the existing code style and conventions in each file.
- Prefer fixing the production code when the test correctly encodes intended behavior; only change the test when the test itself is wrong.
- Use the `todowrite` tool to track one item per failing check.

## Phase 6: Verify

- Re-run the affected project's tests locally until green (use the command from `nx-project-for-file`).
- For lint/typecheck failures, re-run that project's lint/typecheck target.
- If your fix touched code covered by other tests in the same project, run the project's suite, not just the single file.

## Phase 7: Report

Provide a concise summary:

```
## CI Failures Addressed (PR #NUMBER)

### Fixed
1. **check/workflow name** — <root cause> → <fix applied> (verified locally: <command> ✅)

### Pre-existing / not fixed (if any)
- **check name** — <reason it was not this PR's fault / why skipped>

All changes are uncommitted. Run `git diff` to review.
```

## Guardrails

- **Do NOT commit or push.** Leave all changes uncommitted for the user to review (repo convention: only commit when explicitly requested).
- **Do NOT switch branches without asking.**
- If a fix is ambiguous or you cannot determine the correct change, note it and ask rather than guessing.
