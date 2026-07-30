---
description: Pull a Linear ticket via the Linear MCP, research the codebase, grill the user on scope, then produce a plan.
---

# Plan a Linear Ticket

You are tasked with turning a Linear ticket into a concrete, actionable plan. You will pull the ticket down via the Linear MCP, do initial reconnaissance of the existing codebase, **grill the user on scope and approach**, and only then produce a plan.

## Philosophy

- A plan is only as good as your understanding of the ticket AND the current state of the code. Do the research before you ask questions, so your questions are grounded in reality rather than assumption.
- Scope is the enemy. Your job is to relentlessly narrow what is in and out of scope before committing to an approach.
- This is a **READ-ONLY** operation. You propose a plan; you do not implement it. Do not edit code, run builds, or make changes.

## Steps to Execute

Use the todowrite tool to track your progress through these steps.

### 1. Parse the Ticket Argument

Parse the Linear ticket identifier (e.g. `ENG-1234`) from the user prompt below:

<user-prompt>
$ARGUMENTS
</user-prompt>

- If a ticket identifier was provided, use it directly.
- If no ticket was provided, ask the user for the ticket identifier and STOP until they provide one.

### 2. Pull the Ticket Down via the Linear MCP

- Use `linear-mcp_get_issue` to fetch the ticket's full details (description, status, assignee, labels). Pass `includeRelations: true` to surface blocking/related/duplicate tickets.
- Use `linear-mcp_list_comments` to read the discussion and any inline description comments.
- If the ticket is complex, references other tickets, or needs a deeper synthesis, delegate to the `@linear-analyzer` subagent to analyze the ticket(s) and report back.
- Summarize back to the user, concisely:
  - The ticket's core intent (what problem it solves / what it asks for)
  - Acceptance criteria (explicit or inferred)
  - Any linked, blocking, or related tickets worth knowing about

### 3. Initial Codebase Reconnaissance

Now ground yourself in the current state of the code. Spawn agents **in parallel**, then **WAIT** for them all to complete before moving on:

- Use `@code-locator` agents (in parallel) to find the files, components, and directories relevant to the ticket.
- Use `@code-pattern-finder` agents (in parallel) to surface existing patterns, similar implementations, or usage examples the work should follow.

Synthesize the findings into a clear picture of how the relevant area currently works.

### 4. Load Relevant Skills

Now that you understand both the ticket and the shape of the code it touches, identify which skills apply to the work ahead and load them **before** you plan, so your questions and plan are informed by the proper workflows.

- Review the ticket's intent and your research findings against the skills available to you.
- Load **every** skill that could plausibly apply to the implementation, for example:
  - Touches tests? → load the `test-running` skill.
  - Touches the database / migrations? → load the `database-migration` skill.
  - Touches React components? → load the `react-component-writing` skill.
  - Touches feature flags? → load the `feature-flag-create-or-remove` skill.
  - Touches git, branches, or PRs? → load the `graphite-cli` skill.
  - Touches GitHub PRs, issues, CI, releases, or the GitHub API? → load the `github-cli` skill.
  - A data-integrity investigation? → load the `data-integrity-investigation` skill.
  - Anything else you deem relevant.
- When in doubt, load the skill — the cost of loading an unneeded skill is far lower than planning without its guidance.
- Fold any constraints or conventions the loaded skills impose into the questions you ask (Step 5) and the plan you produce (Step 6).

### 5. Grill the User on Scope and Approach

This is the most important step. Do NOT skip it and do NOT plan before completing it.

Present the user with:

- A concise summary of the **current state** of the relevant code (grounded in your research from Step 3).
- A restatement of **what the ticket is asking for**.

Then grill them. Use the `question` tool to ask pointed, decision-forcing questions, such as:

- **Scope boundaries**: What is explicitly in scope? What is explicitly out of scope?
- **Edge cases**: Which edge cases must be handled vs. deferred?
- **Breadth**: Should this be a narrow fix or a broader refactor? How far should the change reach?
- **Approach tradeoffs**: Where multiple viable approaches exist, lay them out as choices with their tradeoffs and recommend one.
- **Unknowns**: Anything ambiguous in the ticket that needs the user's decision.

**WAIT** for the user's answers before proceeding. Iterate if their answers open new questions. Do not move to Step 6 until scope and approach are locked.

### 6. Produce the Plan

Once scope and approach are confirmed, present a structured, checklist-style plan **inline** (do not write a file). Use this structure:

```markdown
## Plan: [Ticket ID] — [Short Title]

### Overview
[What this work accomplishes and the agreed-upon approach]

### Scope
- **In scope**: [...]
- **Out of scope**: [...]

### Key Files
| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `path/to/file.ts` | Brief description | L123-145 |

### Patterns to Follow
[Specific patterns the implementation should follow, referencing existing code. Include snippets where helpful.]

### Implementation Steps
- [ ] Step 1: [Specific, actionable task]
- [ ] Step 2: [Specific, actionable task]
- [ ] ...

### Success Criteria
- [ ] [Specific verifiable outcome]
- [ ] [Type checking passes, if applicable]
- [ ] [Relevant tests pass, if applicable]
```

Keep the plan precise and prescriptive — you have the context now, the implementing agent does not. Reference file names and line numbers wherever possible.

## Important Notes

- This command is **READ-ONLY**. Propose the plan; do not implement it.
- Always research (Steps 2–3) and load relevant skills (Step 4) BEFORE grilling the user (Step 5).
- Run agents of the same type in parallel within a step, and wait for them to finish before the next step.
- The plan is presented inline — do not write it to a file.
- **Do NOT prescribe code comments in the plan.** Never instruct the implementer to add explanatory / "why" / ticket-reference comments (this violates the repo's minimal-comments rule). "Patterns to Follow" should reference existing code and shapes, not mandate new comments. If a genuinely non-obvious invariant exists, note it in the plan prose for the human — not as a comment to be written into the code.
