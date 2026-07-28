---
description: Review an entire Graphite stack with per-branch and overall feedback
---

You are reviewing a Graphite stack from bottom to top. Your goal is to provide individual code reviews for each branch plus an overall stack assessment.

## Phase 1: Discover the Stack

**Call the `stack-map` tool.** It returns the stack as an ordered bottom→top list with each branch's parent, PR number, and ready-to-use `git diff {parent}...{branch}` specs — no manual `gt ls`/`gt log` parsing needed. Use its output directly to drive the per-branch reviews below.

> Fallback (only if the `stack-map` tool is unavailable — e.g. outside the Commons repo): run `gt ls` (supplement with `gt log` for parent info) and parse the ordered trunk→top list yourself.

## Phase 2: Parallel Branch Reviews

For each branch in the stack (excluding trunk), spawn a parallel Task subagent:

- **subagent_type:** `stack-reviewer`
- **prompt:** "Review branch `{branch_name}` against its parent `{parent_branch}`. Run `git diff {parent_branch}...{branch_name}` to get the changes and provide a thorough code review following your output format."

Launch all branch reviews in parallel for efficiency.

## Phase 3: Sequential Output

Once all subagents complete, present their reviews in order from bottom of stack to top:

---
### Branch: {branch_name} (1 of N)
{review from subagent}

---
### Branch: {branch_name} (2 of N)
{review from subagent}

(continue for all branches)

## Phase 4: Stack Synthesis

After presenting all individual reviews, provide an overall stack assessment:

---
## Overall Stack Assessment

**Stack Structure:** Describe the logical flow of changes through the stack

**Cross-Branch Dependencies:** Summarize any dependency issues found across branches (e.g., Branch 3 uses a function defined in Branch 4)

**Stack Quality:** Overall impression of the stack's organization and code quality

**Recommendations:** Suggestions for reordering, combining, or splitting branches if applicable
