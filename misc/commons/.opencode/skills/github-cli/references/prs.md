# gh pr

Use `-R owner/repo` to target a repo other than the current directory’s.

## List pull requests

```bash
gh pr list [OPTIONS]
```

| Option | Effect |
|--------|--------|
| `--state open \| closed \| merged \| all` | Filter (default: open) |
| `--limit N` | Max results |
| `--author USER` | Author |
| `--assignee @me` | Assigned to you |
| `--base BRANCH` | Target branch |
| `--head USER:BRANCH` | Source branch |

## Get one PR

```bash
gh pr view <NUMBER>
```

- `--web` – open in browser  
- `--json field1,field2` – e.g. `title,body,state,mergeable`

## Get PR diff

```bash
gh pr diff <NUMBER>
```

## Get PR files

```bash
gh pr diff <NUMBER> --name-only
```

Or with the API:

```bash
gh api repos/{owner}/{repo}/pulls/<NUMBER>/files --jq '.[].filename'
```

## Get PR status / checks

```bash
gh pr checks <NUMBER>
```

> To triage **failing** checks with their log excerpts in one step, prefer the **`ci-failures`** project tool instead of parsing `gh pr checks` + fetching logs by hand.

## Get PR review comments

```bash
gh api repos/{owner}/{repo}/pulls/<NUMBER>/comments
```

> To get only the **unresolved** review threads, already bucketed into BugBot vs. human reviewers, prefer the **`pr-review-threads`** project tool instead of the raw comments/reviews endpoints below.

## Get PR reviews

```bash
gh api repos/{owner}/{repo}/pulls/<NUMBER>/reviews
```

## Get PR comments

```bash
gh api repos/{owner}/{repo}/issues/<NUMBER>/comments
```

(PRs are issues for comment threads.)

## Create PR

```bash
gh pr create --title "Title" --body "Body"
```

- `--base BRANCH` – target branch  
- `--head USER:BRANCH` – source (default: current branch)  
- `--fill` – use commit message as title/body  
- `--draft` – create as draft  
- Omit title/body to open editor

## Merge PR

```bash
gh pr merge <NUMBER> [--merge | --squash | --rebase]
```

- `--merge` (default), `--squash`, `--rebase`  
- `--delete-branch` – delete head branch after merge

## Review PR (submit review / comments)

```bash
gh pr review <NUMBER> --approve
gh pr review <NUMBER> --request-changes --body "Feedback"
gh pr review <NUMBER> --comment --body "Comment only"
```

## Other PR commands

| Action | Command |
|--------|--------|
| Close / reopen | `gh pr close <NUMBER>`, `gh pr reopen <NUMBER>` |
| Check out branch | `gh pr checkout <NUMBER>` |
| Add comment | `gh pr comment <NUMBER> --body "Text"` |
| Edit PR | `gh pr edit <NUMBER> --title "..." --body "..."` |
| Mark ready | `gh pr ready <NUMBER>` |
| Update branch | `gh pr update-branch <NUMBER>` |
| Revert | `gh pr revert <NUMBER>` |
| Lock / unlock | `gh pr lock <NUMBER>`, `gh pr unlock <NUMBER>` |
| Status in repo | `gh pr status` |
