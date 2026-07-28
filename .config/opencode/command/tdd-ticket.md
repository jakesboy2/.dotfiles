---
description: Pull a Linear ticket via the Linear MCP, research the codebase, grill the user on scope, then produce a Test-Driven Development plan (failing test → implement → passing test).
---

# Plan a Linear Ticket (TDD)

You are tasked with turning a Linear ticket into a concrete, actionable **Test-Driven Development** plan. You will pull the ticket down via the Linear MCP, do initial reconnaissance of the existing codebase, **grill the user on scope and approach**, and only then produce a plan.

The **core invariant** of this command: the plan you produce MUST follow the TDD cycle — first write a failing test that reproduces the bug or proves the missing feature (red), then implement the minimal fix (green), then verify the test passes and refactor if needed. A plan without a failing-test-first step is invalid.

## Philosophy

- A plan is only as good as your understanding of the ticket AND the current state of the code. Do the research before you ask questions, so your questions are grounded in reality rather than assumption.
- Scope is the enemy. Your job is to relentlessly narrow what is in and out of scope before committing to an approach.
- **TDD is non-negotiable here.** Every plan must sequence work as: (1) a failing test that captures the desired behavior, (2) the implementation that makes it pass, (3) verification that it now passes (and the wider suite stays green). The test is written and observed failing *before* the fix exists.
- This is a **READ-ONLY** operation. You propose a plan; you do not implement it. Do not edit code, write tests, run builds, or make changes.

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
  - Acceptance criteria (explicit or inferred) — these become the assertions your failing test must encode
  - Any linked, blocking, or related tickets worth knowing about

### 3. Initial Codebase Reconnaissance

Now ground yourself in the current state of the code. Spawn agents **in parallel**, then **WAIT** for them all to complete before moving on:

- Use `@code-locator` agents (in parallel) to find the files, components, and directories relevant to the ticket — **including the relevant test suites and test file locations**.
- Use `@code-pattern-finder` agents (in parallel) to surface existing patterns, similar implementations, or usage examples the work should follow — **and especially the existing test conventions**: how tests are structured, named, and located; the test framework in use; and how the suite is run.

Synthesize the findings into a clear picture of both how the relevant area currently works AND how it is (or should be) tested — so your TDD plan is grounded in the project's real testing setup.

### 4. Load Relevant Skills

Now that you understand both the ticket and the shape of the code it touches, identify which skills apply to the work ahead and load them **before** you plan, so your questions and plan are informed by the proper workflows.

- Review the ticket's intent and your research findings against the skills available to you.
- **Always load the `test-running` skill** — this command is TDD-first, so the testing workflow is central to every plan it produces.
- Load **every** other skill that could plausibly apply to the implementation, for example:
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

Because this is a TDD plan, you MUST also lock down the test strategy before planning:

- **Failing-test target**: What observable behavior will the failing test assert? What is the precise, minimal reproduction of the bug / proof of the missing feature?
- **Test level**: Unit, integration, or end-to-end? Which is the right level for the invariant being protected?
- **Test location & framework**: Which file/suite will the new test live in, following the conventions found in Step 3?
- **Red→green signal**: What exactly should fail before the fix (and for the *right* reason), and what confirms it passes after?

**WAIT** for the user's answers before proceeding. Iterate if their answers open new questions. Do not move to Step 6 until scope, approach, AND test strategy are locked.

### 6. Produce the Plan

Once scope and approach are confirmed, present a structured, checklist-style plan **inline** (do not write a file). Use this structure:

```markdown
## TDD Plan: [Ticket ID] — [Short Title]

### Overview
[What this work accomplishes and the agreed-upon approach]

### Scope
- **In scope**: [...]
- **Out of scope**: [...]

### Key Files
| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| `path/to/file.ts` | Brief description | L123-145 |
| `path/to/file.test.ts` | Where the failing test will live | L1-40 |

### Test Strategy
- **Behavior under test**: [the specific behavior the failing test asserts]
- **Test level**: [unit / integration / e2e]
- **Test file**: `path/to/file.test.ts`
- **How to run**: `[the exact command to run this test]`
- **Expected red signal**: [what fails, and why it's the right failure, before the fix]
- **Expected green signal**: [what confirms the fix is complete]

### Patterns to Follow
[Specific patterns the implementation AND the test should follow, referencing existing code. Include snippets where helpful.]

### TDD Implementation Steps

#### 🔴 Red — Write the failing test
- [ ] Add/modify a test at `path/to/file.test.ts` that asserts [behavior].
- [ ] Run the test and confirm it FAILS for the right reason (the bug/missing feature — not a setup error).

#### 🟢 Green — Implement the fix
- [ ] Make the minimal change at `path/to/file.ts` to satisfy the test.
- [ ] Run the test and confirm it now PASSES.

#### ♻️ Refactor (if needed)
- [ ] Clean up the implementation and test while keeping the test green.

### Success Criteria
- [ ] The new test FAILS before the fix is applied (verified red).
- [ ] The new test PASSES after the fix (verified green).
- [ ] The wider test suite still passes.
- [ ] [Type checking passes, if applicable]
- [ ] [Any additional ticket-specific verifiable outcomes]
```

Keep the plan precise and prescriptive — you have the context now, the implementing agent does not. Reference file names and line numbers wherever possible.

## Important Notes

- This command is **READ-ONLY**. Propose the plan; do not implement it, and do not write the test.
- The plan **MUST** encode the full TDD cycle: a failing test first, then the implementation, then verification that it passes. A plan missing the failing-test-first step is invalid.
- Always research (Steps 2–3) and load relevant skills (Step 4, including `test-running`) BEFORE grilling the user (Step 5).
- Run agents of the same type in parallel within a step, and wait for them to finish before the next step.
- The plan is presented inline — do not write it to a file.
