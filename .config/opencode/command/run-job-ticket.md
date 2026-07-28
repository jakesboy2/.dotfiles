---
description: Create a Linear runbook sub-ticket to execute a Commons backfill/repair job in production, with exact curl invocations and a dry-run → run → re-audit → idempotency verification loop.
---

# Runbook: Run a Backfill Job in Production

You are tasked with turning a completed Commons job (a file in
`commons-packages/backend/src/jobs/`) into a precise, operational **runbook sub-ticket**
in Linear. The implementing work is done; this ticket tells a human (or a future agent)
exactly how to execute the job safely in production and how to verify it worked.

## Philosophy

- The runbook is only as good as your understanding of the job's actual parameters. Read
  the job file — do not assume the schema.
- Safety first: always stage a dry-run, capture a baseline, then run, then re-verify.
- This is a **READ-ONLY** operation except for the final Linear ticket creation. Do not
  edit code, run builds, or execute the job.

## Arguments

Parse from the user prompt below:

<user-prompt>
$ARGUMENTS
</user-prompt>

- Expected: a **job file path or slug** and a **parent Linear ticket ID** (e.g.
  `repair-cross-enrollment-patient-enrollment-id GROW-474`).
- If either is missing, ask the user for it and STOP until provided.

## Steps to Execute

Use the todowrite tool to track progress.

### 1. Load Skills

Load the `create-job` skill (for the invocation conventions and curl auth patterns) and
the `graphite-cli`/`github-cli` skills only if you need to reference the delivering PR.

### 2. Read the Job File

- Read the job file in `commons-packages/backend/src/jobs/`.
- Extract and record:
  - **Endpoint slug** — the filename without `.ts` → `POST /jobs/<slug>`.
  - **Request schema** — every field in the Zod schema, its type, and its default. Call
    out `isDryRun` / dry-run flags, `batchSize`, `targetTables`/scoping arrays, and any
    other safety controls.
  - **What it does** — a 3–6 bullet summary of the transformation, the selection
    predicate, and any special-cased tables (unique constraints, huge tables).
  - **Idempotency** — state precisely why a re-run is (or is not) a no-op.
  - **Verification source** — any audit SQL, sibling ticket, or query the job's results
    should be checked against (search `notes/` and the job's doc comments / linked tickets).

### 3. Pull Parent Context via Linear MCP

- `linear-mcp_get_issue` on the parent (pass `includeRelations: true`) to get the team,
  wire up cross-references, and find the delivering ticket + audit ticket.
- `linear-mcp_list_comments` on the audit ticket (if any) to capture real mismatch/row
  counts to seed expectations in the runbook.

### 4. Draft the 5-Step Runbook

Build the ticket body around this exact structure. Fill in real values — no placeholders.

1. **Dry run (staging)** — `isDryRun: true`; verify per-table counts are sane / in range.
2. **Dry run (production)** — `isDryRun: true`; record the baseline totals (e.g.
   `totalMismatchesFound`) before any write.
3. **Full production run** — the real invocation. Provide BOTH the run-everything variant
   and a cautious **targeted-subset** variant (a small `targetTables` first pass) when the
   job supports scoping.
4. **Post-run verification** — re-run the audit SQL / verification query; assert the
   expected zero-state (e.g. every table returns `0` mismatches).
5. **Idempotency check** — run once more; assert zero writes (e.g.
   `totalRecordsUpdated = 0`).

For each run step, emit the exact `curl` per the `create-job` skill's invocation section
(local, staging, and production forms with the correct auth header). Substitute the real
slug and a concrete example body built from the Zod schema.

### 5. File the Sub-Ticket

- Create the ticket via `linear-mcp_save_issue`:
  - `parentId` = the parent ticket, `team` = the parent's team, `assignee` = `me` unless
    told otherwise, `priority` = inherit or default to High for data repairs.
  - `title` = `Run <slug> job in production` (or a clearer phrasing).
  - `description` = the runbook from Step 4, plus a **Context** header (link the
    delivering PR + tickets), a **Request schema** block, a **What the job does** section,
    and **Acceptance criteria** that explicitly cover any edge-case outputs (e.g.
    nulled-out rows, soft-deleted duplicates).
- Cross-reference the delivering ticket, the audit ticket, and the forward-fix ticket by
  their identifiers so Linear links them.

### 6. Report Back

Return the new ticket ID + URL and a one-line summary of the 5 runbook steps. Do not
execute the job.

## Important Notes

- **READ-ONLY** except the final Linear write. Never run the job or run builds.
- Pull the schema from the code, not from memory — defaults drift.
- Always include the dry-run → baseline → run → re-audit → idempotency loop; never a
  bare "just POST it" instruction for a data-mutating job.
