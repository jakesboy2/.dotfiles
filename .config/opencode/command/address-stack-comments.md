---
description: Traverse a Graphite stack bottom-to-top, collect unresolved PR review comments across all branches, let the user pick which to address, then fix and commit per branch
---

You are an expert software engineer tasked with addressing inline review comments across an entire Graphite stack of pull requests. You will traverse the stack, collect all unresolved comments, present them for selection, then fix and commit branch-by-branch from bottom to top.

## Phase 1: Discover the Stack

**Call the `stack-map` tool.** It returns the current Graphite stack as an ordered bottom→top list, with each branch's parent and PR number/URL — no manual `gt` navigation or output-parsing needed. Use this ordered branch list (with PR numbers) for the rest of the workflow.

> Fallback (only if the `stack-map` tool is unavailable — e.g. outside the Commons repo): run `gt ls --stack` (supplement with `gt log --stack` for parent/child clarity), then walk `gt bottom` + `gt up` to confirm the ordered list.

## Phase 2: Collect All Unresolved Comments Across the Stack

For each branch in the ordered list from Phase 1 (bottom to top), that has a PR number:

**Call the `pr-review-threads` tool with that branch's PR number.** It returns the unresolved threads already bucketed into **BugBot (cursor[bot])** vs. **Human reviewers**, each with `path:line`, a truncated body, and full thread bodies in the trailer. No checkout, GraphQL, filtering, or bucketing needed — you do not need to be on the branch to fetch its comments.

- If a branch has no PR number in the `stack-map` output, note it and skip.
- Tag each returned thread with its owning branch + PR number as you collect them.
- If there are **zero unresolved comments across the entire stack**, inform the user and stop.

> Fallback (only if the `pr-review-threads` tool is unavailable): load the `github-cli` skill and, per branch, run `gh api graphql --paginate` with the `reviewThreads` query, filter `isResolved == false`, and bucket by `comments.nodes[0].author.login == "cursor[bot]"`.

## Phase 3: Present Summary & Let User Pick

Present all comments grouped by branch in a clear, organized format:

```
## Unresolved PR Comments Across Stack

### Branch: feature-base (PR #101) — X comments

#### BugBot (cursor[bot])
1. **file.ts:42** — "Brief summary of the comment..."
2. **other-file.ts:108** — "Brief summary..."

#### Human Reviewers
3. **file.ts:15** (reviewer-name) — "Brief summary..."

---

### Branch: feature-part-2 (PR #102) — Y comments

#### BugBot (cursor[bot])
4. **api.ts:23** — "Brief summary..."

#### Human Reviewers
5. **api.ts:90** (another-reviewer) — "Brief summary..."

---

### Branch: feature-part-3 (PR #103) — No unresolved comments
```

For each comment, show:
- A global number (for selection, sequential across the entire stack)
- File path and line number
- Author (for human comments)
- The comment body (truncated to ~100 chars if longer)

For branches with no unresolved comments, show a brief note like "No unresolved comments".

Then use the `question` tool with `multiple: true` to let the user select which comments to address. Include an option for "All comments" as the first choice.

If the user selects "All comments", address every listed comment. Otherwise, address only the selected ones.

## Phase 4: Fix & Commit Per Branch

Use the `todowrite` tool to create a todo item for each branch that has selected comments.

Navigate to the bottom of the stack:

```bash
gt bottom
```

Then, for each branch from bottom to top:

### Step 4a: Check out the branch

```bash
gt checkout BRANCH_NAME
```

### Step 4b: Check for selected comments on this branch

If no selected comments target this branch, output a brief note:

```
No selected comments on `BRANCH_NAME`, moving up...
```

Then skip to the next branch.

### Step 4c: Fix selected comments

For each selected comment on this branch, in order:

1. Mark its todo as `in_progress`
2. Read the full thread context (all replies in the thread) to understand:
   - What the reviewer is asking for
   - Any follow-up clarifications or discussion
   - The specific code change requested
3. Read the referenced file to understand the surrounding code
4. If more context is needed (e.g., understanding a type, finding a related function), use the `grep` or `read` tools to gather it
5. Implement the fix using the `Edit` tool
6. Mark the todo as `completed`

### Step 4d: Commit the fixes

After all selected comments on this branch have been fixed, commit using Graphite:

```bash
gt modify --all -m "fix: address PR review comments"
```

This amends the branch's commit and automatically restacks descendants.

### Step 4e: Move up the stack

```bash
gt up
```

If `gt up` fails, you've reached the top — the traversal is complete.

### Important Fix Guidelines

- **Be precise** — make minimal, targeted changes that directly address the comment
- **Preserve style** — match the existing code style and conventions in the file
- If a comment is ambiguous or you cannot determine what change to make, note it in your output and skip it rather than making a wrong change
- If fixing one comment would conflict with another selected comment on the same branch, note the conflict
- **Do NOT push** to the remote — only commit locally

## Phase 5: Summary

After all branches have been processed, provide a full summary:

```
## Stack Comment Fixes — Summary

### Branch: feature-base (PR #101)
#### Changes Made
1. **file.ts:42** — [Brief description of what was changed]
2. **other-file.ts:108** — [Brief description of what was changed]

#### Skipped (if any)
- **file.ts:15** — [Reason it was skipped]

Committed: `fix: address PR review comments`

---

### Branch: feature-part-2 (PR #102)
#### Changes Made
3. **api.ts:23** — [Brief description of what was changed]

Committed: `fix: address PR review comments`

---

### Branch: feature-part-3 (PR #103)
No comments selected — skipped.

---

All changes have been committed locally per branch. Run `gt submit --stack` to push when ready.
```
