---
description: Fetch unresolved PR review comments (BugBot and human), let the user pick which to address, then autonomously fix them
---

You are an expert software engineer tasked with addressing inline review comments on a pull request. You will fetch comments, present them for selection, and then autonomously implement fixes for the selected ones.

## Phase 1: Discover the PR

Parse the user prompt below for an optional PR number or URL:

<user-prompt>
$ARGUMENTS
</user-prompt>

- If a PR number or URL was provided, use it directly
- If no argument was provided, auto-detect the PR from the current branch:

```bash
gh pr view --json number,url,headRefName
```

If no PR is found, inform the user and stop.

Store the PR number for use in subsequent phases.

## Phase 2: Fetch Unresolved Inline Review Comments

**Call the `pr-review-threads` tool** — pass the PR number from Phase 1 (or no argument to auto-detect from the current branch). It runs the paginated GraphQL `reviewThreads` query, keeps only unresolved threads, and returns them already numbered and bucketed into **BugBot (cursor[bot])** vs. **Human reviewers**, each with `path:line`, a truncated body, and (in the trailer) the full thread bodies for context when fixing.

- If it reports **zero unresolved comments**, inform the user and stop.
- The tool's output already matches the presentation format used in Phase 3, so you can present it with minimal reformatting.

### Fallback (only if the `pr-review-threads` tool is unavailable — e.g. outside the Commons repo)

Load the `github-cli` skill and run the query manually, then filter to `isResolved == false` and bucket by `comments.nodes[0].author.login == "cursor[bot]"`:

```bash
gh api graphql --paginate -F owner='{owner}' -F name='{repo}' -F pr=PR_NUMBER -f query='
  query($owner: String!, $name: String!, $pr: Int!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100, after: $endCursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            isResolved isOutdated path line
            comments(first: 50) { nodes { id body author { login } createdAt url } }
          }
        }
      }
    }
  }
'
```

## Phase 3: Present Summary & Let User Pick

Present the comments to the user in a clear, organized format:

```
## Unresolved PR Comments

### BugBot (cursor[bot]) — N comments
1. **file.ts:42** — "Brief summary of the comment..."
2. **other-file.ts:108** — "Brief summary..."

### Human Reviewers — M comments
3. **file.ts:15** (reviewer-name) — "Brief summary..."
4. **utils.ts:77** (another-reviewer) — "Brief summary..."
```

For each comment, show:
- The number (for selection)
- File path and line number
- Author (for human comments)
- The comment body (truncated to ~100 chars if longer, with full body available)

Then use the `question` tool with `multiple: true` to let the user select which comments to address. Include an option for "All comments" as the first choice.

If the user selects "All comments", address every listed comment. Otherwise, address only the selected ones.

## Phase 4: Autonomously Fix Selected Comments

Use the `todowrite` tool to create a todo item for each selected comment.

For each selected comment, in order:

1. Mark its todo as `in_progress`
2. Read the full thread context (all replies in the thread) to understand:
   - What the reviewer is asking for
   - Any follow-up clarifications or discussion
   - The specific code change requested
3. Read the referenced file to understand the surrounding code
4. If more context is needed (e.g., understanding a type, finding a related function), use the `grep` or `read` tools to gather it
5. Implement the fix using the `Edit` tool
6. Mark the todo as `completed`
7. Move to the next comment

### Important Fix Guidelines

- **Do NOT commit changes** — leave everything uncommitted for the user to review
- **Do NOT push** to the remote
- **Be precise** — make minimal, targeted changes that directly address the comment
- **Preserve style** — match the existing code style and conventions in the file
- If a comment is ambiguous or you cannot determine what change to make, note it in your output and skip it rather than making a wrong change
- If fixing one comment would conflict with another selected comment, note the conflict

## Phase 5: Summary

After all selected comments have been addressed, provide a summary:

```
## Changes Made

1. **file.ts:42** — [Brief description of what was changed]
2. **other-file.ts:108** — [Brief description of what was changed]

## Skipped (if any)
- **utils.ts:77** — [Reason it was skipped]

All changes are uncommitted. Run `git diff` to review.
```
