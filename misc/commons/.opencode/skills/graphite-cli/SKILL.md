---
name: graphite-cli
description: Use Graphite CLI (gt) for stacked PRs and branch management. Use when creating branches, committing changes, submitting PRs, syncing with trunk, or managing stacked pull requests.
---

# Graphite CLI (gt)

Graphite CLI simplifies stacked PR workflows by automating branch management, rebasing, and PR creation.

## Key Concepts

| Term       | Definition                                                            |
| ---------- | --------------------------------------------------------------------- |
| **Stack**  | A sequence of PRs, each building on its parent (main <- PR1 <- PR2)   |
| **Trunk**  | The base branch stacks merge into (usually `main`)                    |
| **Upstack**| PRs above a given PR (descendants)                                    |
| **Downstack** | PRs below a given PR (ancestors)                                   |

## Agent Usage Notes

**CRITICAL: Always use `--no-interactive` for automation.** Many commands prompt for input by default.

```bash
# Non-interactive submission (required for agents)
gt submit --no-interactive

# Or use --no-edit to skip PR metadata prompts
gt submit --no-edit
```

**Branch names are POSITIONAL, not flags:**
```bash
# CORRECT
gt create my-feature --all --message "feat: add feature"

# WRONG - branch name is not a flag
gt create --branch my-feature --all --message "feat: add feature"
```

**The force-rename trap (renaming a branch that already has a PR):**

`gt rename <new> --force` on a branch with an open PR **detaches the Graphite↔PR
association**. The next `gt submit` creates a *brand-new* PR for the renamed branch; the
original PR is left orphaned on the old branch name. There is no "repurpose the existing
PR under a new branch name" path — GitHub PR head refs + Graphite tracking do not survive
the force.

- If the goal is to **reuse an existing PR as a stack's bottom**, do NOT rename. Keep the
  original branch name as the bottom branch and split the *upper* work off it, so the
  original PR stays attached.
- If a rename is unavoidable, set expectations up front that the old PR will be
  closed/superseded by a fresh one.

## Core Workflow

### 1. Create a Branch with Changes

```bash
# Stage all changes, create branch, commit with message
gt create my-branch-name --all --message "feat: description of changes"
```

### 2. Submit to GitHub

```bash
# Submit current branch and ancestors (creates/updates PRs)
gt submit --no-interactive

# Submit entire stack including descendants
gt submit --stack --no-interactive
```

### 3. Update a Branch (Address Feedback)

```bash
# Amend current commit with new changes (restacks descendants automatically)
gt modify --all

# Or create a new commit instead of amending
gt modify --commit --all --message "fix: address review feedback"
```

### 4. Sync with Trunk

```bash
# Fetch latest trunk, rebase all branches, prompt to delete merged branches
gt sync
```

## Command Reference

### Core Workflow Commands

| Command | Description | Key Flags |
| ------- | ----------- | --------- |
| `gt create [name]` | Create branch stacked on current, commit staged changes | `-a/--all`, `-m/--message`, `-i/--insert` |
| `gt modify` | Amend current commit or add new commit, auto-restacks | `-a/--all`, `-c/--commit`, `-m/--message` |
| `gt submit` | Push branches to GitHub, create/update PRs | `-s/--stack`, `-d/--draft`, `-r/--reviewers`, `-m/--merge-when-ready`, `--no-edit` |
| `gt sync` | Sync with remote, rebase branches, cleanup merged | `-f/--force`, `-a/--all`, `--no-restack` |

### Stack Navigation

| Command | Description | Alias |
| ------- | ----------- | ----- |
| `gt checkout [branch]` | Switch branch (interactive picker if no arg) | `co` |
| `gt up [steps]` | Go to child branch | `u` |
| `gt down [steps]` | Go to parent branch | `d` |
| `gt top` | Go to tip of current stack | `t` |
| `gt bottom` | Go to base of current stack (closest to trunk) | `b` |

### Branch Info

| Command | Description | Key Flags |
| ------- | ----------- | --------- |
| `gt log` | Show stack visualization | `-s/--stack`, `-r/--reverse` |
| `gt log short` | Compact stack view | alias: `gt ls` |
| `gt log long` | Full commit ancestry graph | alias: `gt ll` |
| `gt info [branch]` | Show branch details | `-d/--diff`, `-p/--patch`, `-b/--body` |
| `gt parent` | Show parent branch | |
| `gt children` | Show child branches | |
| `gt trunk` | Show trunk branch | `-a/--all` |

> **Prefer the `stack-map` tool** to read the whole stack programmatically. Instead of parsing `gt log`/`gt ls` output by hand, call `stack-map` to get the ordered bottom→top branch list with each branch's parent, PR number/URL, and ready-to-use `git diff {parent}...{branch}` specs. Use the raw `gt log`/`gt ls` commands above only for interactive inspection or as a fallback.

### Stack Management

| Command | Description | Key Flags |
| ------- | ----------- | --------- |
| `gt restack` | Rebase stack to ensure proper ancestry | `--upstack`, `--downstack`, `--only` |
| `gt reorder` | Reorder branches (opens editor) | |
| `gt move` | Rebase branch onto different parent | `-o/--onto <branch>` |
| `gt fold` | Merge branch into parent | `-k/--keep` (keep current name) |
| `gt absorb` | Smart-amend staged changes to relevant commits | `-a/--all`, `-f/--force`, `-d/--dry-run` |
| `gt split` | Split branch into multiple single-commit branches | `-c/--by-commit`, `-h/--by-hunk` |
| `gt squash` | Squash all commits in branch into one | `-m/--message`, `--no-edit` |

### Branch Management

| Command | Description | Key Flags |
| ------- | ----------- | --------- |
| `gt delete [name]` | Delete branch and metadata | `-f/--force` |
| `gt rename [name]` | Rename branch (⚠ `--force` on a branch with an open PR **detaches** the PR; the next `gt submit` creates a NEW PR — see "The force-rename trap") | `-f/--force` |
| `gt track [branch]` | Start tracking branch with Graphite | `-p/--parent`, `-f/--force` |
| `gt untrack [branch]` | Stop tracking branch | `-f/--force` |
| `gt get [branch]` | Sync branch/PR from remote | `-d/--downstack`, `-f/--force` |
| `gt pop` | Delete branch but keep working tree changes | |
| `gt revert [sha]` | Create revert branch for trunk commit | `--sha` (required) |
| `gt unlink [branch]` | Unlink PR from branch | |

### GitHub/Web Commands

| Command | Description | Key Flags |
| ------- | ----------- | --------- |
| `gt pr [branch]` | Open PR page in browser | `--stack` |
| `gt merge` | Merge PRs from trunk to current branch | `--dry-run`, `-c/--confirm` |
| `gt dash` | Open Graphite dashboard | |

### Recovery Commands

| Command | Description | Key Flags |
| ------- | ----------- | --------- |
| `gt continue` | Resume operation paused by conflict | `-a/--all` |
| `gt abort` | Abort operation paused by conflict | `-f/--force` |
| `gt undo` | Undo most recent Graphite mutation | `-f/--force` |

## Global Options

Available on all commands:

| Flag | Description |
| ---- | ----------- |
| `--no-interactive` | Disable prompts (required for automation) |
| `--no-verify` | Skip git hooks |
| `--quiet` / `-q` | Minimize output (implies `--no-interactive`) |
| `--debug` | Write debug output |
| `--cwd <path>` | Run in different directory |
| `--help` | Show command help |

## Conflict Resolution

When a rebase conflict occurs:

1. Graphite pauses and reports which files have conflicts
2. Resolve conflicts in your editor
3. Stage resolved files: `git add <file>`
4. Resume: `gt continue`
5. Or abort: `gt abort`

## Best Practices

1. **One logical change per branch** - Keep PRs focused and reviewable
2. **Use `gt sync` regularly** - Stay up to date with trunk
3. **Submit frequently** - Keep PRs updated on GitHub
4. **Use `gt log`** - Visualize your stack before operations
5. **Plan stacks before coding** - Present stack structure to user for confirmation

## Handling Pre-commit Hooks

If a pre-commit hook modifies files:

```bash
# After hook runs and modifies files, amend to include changes
gt modify --all
```

If hooks fail and you need to skip them:

```bash
gt create my-branch --all --message "feat: changes" --no-verify
gt submit --no-verify
```

## See Also

- [SPLITTING.md](./SPLITTING.md) - Split one multi-file commit into a file-grouped stack (read before splitting a branch)
- [EXAMPLES.md](./EXAMPLES.md) - Detailed workflow examples
- `gt docs` - Official documentation
- `gt demo` - Interactive demos
- `gt guide` - Extended guides
