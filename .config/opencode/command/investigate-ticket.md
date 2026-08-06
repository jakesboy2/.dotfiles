---
description: Investigate a reported issue via the Linear MCP and codebase, hunt the root cause, grill the user, then produce a Linear ticket for /plan-ticket to consume.
---

# Investigate a Ticket

You are tasked with investigating a reported issue and **producing a Linear ticket** that captures the root cause clearly enough for `/plan-ticket` to turn into an implementation plan. You will gather context (from an existing Linear ticket or a free-text problem description), trace the described behavior to its root cause in the codebase, **grill the user** to illuminate behavior the code cannot reveal, and only then write the ticket.

## Philosophy

- **The deliverable is a Linear ticket, not code, not a PR, and not a fleshed-out implementation plan.** Your job is to find and document *why* the issue happens — not to design or build the fix. Leave the "how" to `/plan-ticket`.
- An investigation is only as good as your understanding of the reported symptom AND the current state of the code. Do the research before you ask questions, so your questions are grounded in reality rather than assumption.
- Chase the root cause relentlessly. A symptom is not a cause. Trace the described behavior to specific files and lines, and form hypotheses ranked by likelihood.
- The code does not always tell the whole story. Runtime behavior, reproduction steps, timelines, and user expectations often live only in the user's head — extract them.
- **Data is an optional tool, not a requirement.** The user is able to run SQL queries for you IF you need more data to confirm a hypothesis. Only propose a query when it would resolve a genuine unknown the code cannot answer. It is perfectly fine to reach a root cause from the code alone.
- The codebase is **READ-ONLY**. You do not edit code, run builds, or make changes. The only write you perform is creating or updating the Linear ticket at the final step, and only after the user confirms.

## Steps to Execute

Use the todowrite tool to track your progress through these steps.

### 1. Parse the Argument

Parse the input from the user prompt below. It may be a Linear ticket identifier (e.g. `ENG-1234`) **or** a free-text description of a problem/bug.

<user-prompt>
$ARGUMENTS
</user-prompt>

- If a Linear ticket identifier was provided, treat it as the starting point and plan to update it (or spin off a child/related ticket if that fits better).
- If a free-text problem description was provided, treat it as the raw report; you will create a new ticket at the end.
- If nothing usable was provided, ask the user for either a ticket identifier or a description of the issue, and STOP until they provide one.

### 2. Gather Context

Establish exactly what is being reported before you touch the code.

- If you have a ticket identifier:
  - Use `linear-mcp_get_issue` to fetch the ticket's full details (description, status, assignee, labels). Pass `includeRelations: true` to surface blocking/related/duplicate tickets.
  - Use `linear-mcp_list_comments` to read the discussion and any inline description comments.
  - If the ticket is complex, references other tickets, or needs a deeper synthesis, delegate to the `@linear-analyzer` subagent to analyze the ticket(s) and report back.
- If you only have a free-text description, restate it as a structured problem report.
- Summarize back to the user, concisely:
  - The **reported symptom** (what is observed going wrong).
  - The **expected behavior** vs. the **actual behavior**, as far as it is known so far.
  - Any linked, blocking, or related tickets worth knowing about.

### 3. Root-Cause Reconnaissance

Now ground yourself in the current state of the code and hunt for the cause. Spawn agents **in parallel**, then **WAIT** for them all to complete before moving on:

- Use `@code-locator` agents (in parallel) to find the files, components, and directories implicated by the reported symptom.
- Use `@code-analyzer` agents (in parallel) to trace the described behavior through the implicated code paths and explain how the relevant area actually works.

Then synthesize:

- Trace the reported symptom to the specific code paths that produce it.
- Form one or more **root-cause hypotheses**, ranked by likelihood, each tied to concrete `file:line` evidence.
- Note, for each hypothesis, what evidence supports it and what remains unconfirmed (the gaps you will close in Step 5).

### 4. Load Relevant Skills

Now that you understand both the reported issue and the shape of the code it touches, identify which skills apply to the investigation and load them **before** you grill the user, so your questions and ticket are informed by the proper workflows.

- Review the symptom and your research findings against the skills available to you.
- Load **every** skill that could plausibly apply, for example:
  - A data-integrity / "why does this data look wrong" investigation? → load the `data-integrity-investigation` skill. (This is a prime candidate for this command — load it whenever data correctness is in question.)
  - Touches the database / migrations? → load the `database-migration` skill.
  - Touches tests? → load the `test-running` skill.
  - Touches React components? → load the `react-component-writing` skill.
  - Touches feature flags? → load the `feature-flag-create-or-remove` skill.
  - Touches git, branches, or PRs? → load the `graphite-cli` skill.
  - Touches GitHub PRs, issues, CI, releases, or the GitHub API? → load the `github-cli` skill.
  - Anything else you deem relevant.
- When in doubt, load the skill — the cost of loading an unneeded skill is far lower than investigating without its guidance.
- Fold any constraints or conventions the loaded skills impose into the questions you ask (Step 5) and the ticket you produce (Step 7).

### 5. Grill the User to Illuminate the Unknown

This is the most important step. Do NOT skip it and do NOT write the ticket before completing it.

Present the user with:

- A concise summary of the **current state** of the relevant code (grounded in your research from Step 3).
- Your **ranked root-cause hypotheses**, each with its supporting evidence and the gaps that remain.

Then grill them. Use the `question` tool to ask pointed questions that illuminate behavior the code cannot reveal, such as:

- **Reproduction**: What are the exact steps to reproduce? Is it consistent or intermittent?
- **Timeline & frequency**: When did this start? How often does it happen? Did it correlate with a recent change, deploy, or migration?
- **Scope**: Who/what is affected — all users, a subset, a specific environment, specific data?
- **Expected behavior**: What did the user expect to happen instead?
- **Disambiguation**: Where competing hypotheses exist, ask the question(s) whose answer would eliminate one.

**Offer SQL when — and only when — it would resolve a genuine unknown.** If a hypothesis hinges on data the code cannot confirm (e.g. the actual state of a row, a count, a distribution), present a **specific query** the user may run, and frame it as **optional**. Make clear that data verification is not required if the code already tells the whole story.

**WAIT** for the user's answers (and any query results they choose to run) before proceeding. Iterate if their answers open new questions or shift the leading hypothesis. Do not move on until the root cause is confirmed or you have exhausted what can be reasonably determined.

### 6. Confirm the Root Cause

Before writing the ticket, state your conclusion plainly:

- The **confirmed root cause** (or the best-supported hypothesis if certainty isn't achievable), with its `file:line` evidence and any data that corroborated it.
- If the cause remains ambiguous, say so explicitly and note precisely what additional evidence would resolve it.

### 7. Produce the Linear Ticket

The deliverable. First present the drafted ticket body **inline** for the user to review. Then, **only after the user confirms**, create or update the ticket in Linear via the Linear MCP (`linear-mcp_save_issue`). Structure the ticket so `/plan-ticket` can consume it directly:

```markdown
## Problem
[The observed symptom: expected vs. actual behavior.]

## Root Cause
[The confirmed (or best-supported) cause, with concrete `file:line` evidence. If ambiguous, state so and list what would resolve it.]

## Reproduction
[Exact steps to reproduce, from the user. Note consistency/frequency.]

## Supporting Data
[Any SQL findings or other evidence gathered. Omit this section if none was needed.]

## Affected Areas
[Pointers to the files, components, and code paths involved — as leads for planning, NOT a prescriptive fix.]

## Open Questions / Risks
[Anything still unresolved, edge cases to consider, or risks the planner should weigh.]
```

When creating/updating the ticket:

- Set an appropriate team and labels; link the related/blocking tickets surfaced in Step 2.
- If you started from an existing ticket, prefer updating it in place (or creating a well-linked related ticket if the scope clearly differs) — confirm which with the user.
- **Do not** include an implementation plan, task checklist, or code changes. Describe the "what" and "why"; leave the "how" for `/plan-ticket`.
- Report the resulting ticket URL back to the user.

### 8. Post a Short Summary Comment on the Input Ticket

If the investigation started from an existing Linear ticket (Step 1), draft a **short** summary comment for that ticket so watchers get the gist at a glance.

- Keep it to **3–5 sentences maximum**. Summarize the confirmed root cause and point to where the full details live (the updated ticket body or the newly created ticket).
- Present the drafted comment **inline** for the user to review, then — **only after the user confirms** — post it via the Linear MCP (`linear-mcp_save_comment`) on the input ticket.
- If you created a separate related ticket rather than updating in place, link to it from the comment.
- If the investigation started from a free-text description (no input ticket exists), skip this step.

## Important Notes

- The codebase is **READ-ONLY**. The only writes you perform are to Linear — creating/updating the ticket (Step 7) and posting the short summary comment (Step 8) — and only after the user confirms each.
- The deliverable is a **root-cause-focused Linear ticket** — never code, a PR, or a fleshed-out implementation plan. Hand `/plan-ticket` a clear brief, not a solution.
- Always gather context (Step 2), do reconnaissance (Step 3), and load relevant skills (Step 4) BEFORE grilling the user (Step 5).
- SQL is an **optional** tool. Only propose queries that would resolve a real unknown; the code alone is often enough.
- Run agents of the same type in parallel within a step, and wait for them to finish before the next step.
- **Do NOT prescribe code comments in the ticket.** Never instruct anyone to add explanatory / "why" / ticket-reference comments (this violates the repo's minimal-comments rule). Rationale belongs in the ticket prose, not in code.
