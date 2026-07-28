---
name: github-cli
description: Use the GitHub CLI (gh) for PRs, repos, search, releases, and API access from the terminal. Use when attempting to get information about other repos or about PRs in this repo.
---

# GitHub operations with gh CLI

How to use the [GitHub CLI](https://cli.github.com/manual/gh) (`gh`) for common GitHub workflows from the terminal.

## Install

`brew install gh`

Check: `gh --version`

## Authentication

Authenticate with GitHub so `gh` can access your account and repos.

**Interactive login (browser):**

```bash
gh auth login
```

Follow prompts: choose host (github.com or Enterprise), protocol (HTTPS or SSH), and complete the browser flow. The token is stored in the system credential store.

**Other auth commands:**

| Command           | Purpose                              |
| ----------------- | ------------------------------------ |
| `gh auth status`  | Show current auth and token location |
| `gh auth logout`  | Remove stored credentials            |
| `gh auth refresh` | Refresh expired token                |
| `gh auth token`   | Print the current token (for piping) |
| `gh auth switch`  | Switch between accounts              |

Minimum token scopes for normal use: `repo`, `read:org`, `gist`. Use `gh auth login -s <scope>` to request more.

## Repository context

Most commands run in the context of the current directory’s git repo. To target another repo without `cd`:

```bash
gh issue list -R owner/repo
# or set once:
export GH_REPO=owner/repo
```

Placeholders `{owner}` and `{repo}` in `gh api` endpoints are filled from the current repo or `GH_REPO`.

## Command reference by area

| Area                              | Commands            | Reference                                    |
| --------------------------------- | ------------------- | -------------------------------------------- |
| Pull requests (list, merge, etc.) | `gh pr`             | [references/prs.md](references/prs.md)       |
| Repo, branches, commits, files    | `gh repo`, `gh api` | [references/repo.md](references/repo.md)     |
| Search (issues, PRs, repos, code) | `gh search`         | [references/search.md](references/search.md) |

Open the linked file for the specific commands and flags.

## Prefer project tools for two common workflows

Two deterministic project tools wrap fiddly `gh` sequences — use them instead of hand-rolling the commands:

- **`pr-review-threads`** — fetch a PR's UNRESOLVED review threads, already filtered and bucketed into BugBot (`cursor[bot]`) vs. human reviewers. Replaces the paginated `gh api graphql` `reviewThreads` query + jq filtering. (Drives the address-comments / address-stack-comments workflows.)
- **`ci-failures`** — for a PR, return the failing checks with extracted failure-log excerpts. Replaces `gh pr checks --json` + run/job-id parsing + `gh run view --log-failed` + the reusable-workflow raw-log fallback + failure grep. (Drives the fix-ci workflow.)

Fall back to the raw `gh` commands below only if these tools are unavailable (e.g. working outside the Commons repo).
