---
description: Diagnose and fix failing tests (and lint/typecheck) from a PR's CI run using the GitHub CLI, then verify the fixes locally
---

You are an expert software engineer tasked with fixing the failing CI checks on a pull request. You will locate the PR, pull the failing CI logs, reproduce the failures locally, fix them, and verify the fixes. The primary focus is failing **tests**, but the same flow applies to failing **lint** and **typecheck** checks that share the CI pipeline.

## Phase 0: Load supporting skills

Before running anything, load the skills you will need:

- Load the `github-cli` skill for `gh` command usage (PRs, checks, workflow runs, logs).
- Load the `test-running` skill for how to run and troubleshoot Jest in this monorepo.
- Load the `lint-running` skill if any failing check is a lint check.
- Use the `nx-project-for-file` tool to resolve the owning Nx project (and the exact typecheck/lint/test command) for any file you need to run locally. Do NOT hand-roll `nx graph`/`jq`.

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

## Phase 2: Identify the failing checks

List the checks and isolate the failures. Prefer JSON so you can filter reliably on the `bucket` field (`pass`, `fail`, `pending`, `skipping`, `cancel`):

```bash
gh pr checks PR_NUMBER --json name,state,bucket,link,workflow
```

Replace `PR_NUMBER` with the number from Phase 1.

- Keep only checks where `bucket == "fail"`.
- If any relevant checks are still `pending`, tell the user they are not done yet; ask whether to wait (`gh pr checks PR_NUMBER --watch`) or proceed with only the currently-failed checks.
- If there are zero failing checks, inform the user everything is green and stop.

For each failing check, note its `name`, `workflow`, and `link` (the `link` points at the workflow run / job).

## Phase 3: Pull the failing logs

For each failing check, map it to its workflow run and fetch only the failing output:

```bash
# From the run link, extract the run ID (the numeric segment after /runs/).
gh run view <run-id> --log-failed
```
- To narrow to a single job, first `gh run view <run-id>` to list jobs, then
  `gh run view <run-id> --job <job-id> --log-failed`.
- **Reusable / nested workflows (common here — e.g. `unit_test (jest-N)` calls `module-unit-tests.yml`):**
  `gh run view --job <id> --log-failed` (and `--log`) often returns only the ~25-line CALLER setup shell,
  NOT the real test output. When the log looks suspiciously short (tens of lines, all "Prepare/Download
  action"), do NOT retry the same command — fetch the raw job log archive directly via the API:

  ```bash
  # Resolve the failing job id (filter the shard name), then pull its raw log archive.
  gh api repos/{owner}/{repo}/actions/runs/<run-id>/jobs --paginate \
    -q '.jobs[] | select(.conclusion=="failure") | {id, name}'
  gh api repos/{owner}/{repo}/actions/jobs/<job-id>/logs > /Users/jacob.waldrip/tmp/opencode/ci-fail.log
  ```

- The log can be large. Do NOT eyeball truncated terminal output — capture it to a temp file under
  `/Users/jacob.waldrip/tmp/opencode/` and `grep -nE "FAIL |✕|✗|Expected|Received|Error:"` to extract specifics.

From the logs, extract for each failure:
- The failing **test file(s)** and individual test names, plus the assertion/error output and stack trace, OR
- For lint/typecheck: the offending file(s), rule/error codes, and line numbers.

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
