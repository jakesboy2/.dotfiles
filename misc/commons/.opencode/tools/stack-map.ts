import { tool } from "@opencode-ai/plugin"

// Graphite's `gt log` prints each branch as a graph node line beginning with
// one of these glyphs (◉ = current branch, ◯ = other branch). Continuation
// lines (commit sha, PR info, timestamps) are prefixed with "│" or spaces.
const NODE_GLYPHS = ["◉", "◯"]

interface StackBranch {
  branch: string
  isCurrent: boolean
  isTrunk: boolean
  prNumber?: number
  prUrl?: string
}

export default tool({
  description:
    "Return the current Graphite stack as an ordered bottom→top list, with each branch's parent, PR number, and PR/review URL. Use this instead of hand-parsing `gt ls`/`gt log` output when you need the stack structure — it feeds the review-stack / stack-reviewer / address-stack-comments workflows (the `git diff {parent}...{branch}` pairs) and the affected-lint base. Deterministic; no reasoning needed to figure out branch order or parents.",
  args: {
    withPr: tool.schema
      .boolean()
      .optional()
      .describe(
        "Resolve each branch's PR number/URL (default true). Set false to skip the per-branch PR lookup and return only branch structure.",
      ),
  },
  async execute(args, context) {
    const $ = Bun.$
    const root = context.directory
    const withPr = args.withPr !== false

    // 1. `gt log --stack --reverse` prints the stack bottom→top (trunk first).
    //    PR number + review URL are printed inline per branch, so we get them
    //    for free without extra `gh` calls in the common case.
    const raw = await $`gt log --stack --reverse --no-interactive`
      .cwd(root)
      .quiet()
      .nothrow()
      .text()

    if (!raw.trim()) {
      return "Could not read the Graphite stack (`gt log --stack --reverse` produced no output). Are you in a Graphite-tracked branch? Try `gt ls`."
    }

    // 2. Parse the graph. A branch line is a node line (starts, after leading
    //    "│"/spaces, with ◉ or ◯). The lines between two node lines belong to
    //    the earlier branch (its commit/PR metadata).
    const lines = raw.split("\n")
    const branches: StackBranch[] = []
    let current: StackBranch | undefined

    const stripLeader = (line: string): string => {
      // Drop leading tree-drawing characters and whitespace.
      return line.replace(/^[\s│◉◯┐┘├─┤╷╵|]*/u, "").trim()
    }

    for (const line of lines) {
      const trimmedStart = line.replace(/^\s+/, "")
      const firstGlyph = [...trimmedStart][0]
      const isNodeLine = NODE_GLYPHS.includes(firstGlyph ?? "")

      if (isNodeLine) {
        // e.g. "◉ jacobwaldrip/foo (current)" or "◯ main (commons)"
        const rest = stripLeader(line)
        const isCurrent = / \(current\)\s*$/.test(rest)
        // Trunk is annotated with a trailing "(<repo>)" marker (e.g. "(commons)").
        // "(current)" is NOT a trunk marker; strip it before testing.
        const withoutCurrent = rest.replace(/\s*\(current\)\s*$/, "")
        const isTrunk = /\([^)]+\)\s*$/.test(withoutCurrent)
        const branchName = withoutCurrent.replace(/\s*\([^)]+\)\s*$/, "").trim()

        current = {
          branch: branchName,
          isCurrent,
          isTrunk,
        }
        branches.push(current)
        continue
      }

      // Continuation line: attach inline PR info to the branch it belongs to.
      if (current) {
        const content = stripLeader(line)
        const prMatch = content.match(/\bPR #(\d+)\b/)
        if (prMatch && current.prNumber === undefined) {
          current.prNumber = Number(prMatch[1])
        }
        const urlMatch = content.match(/https?:\/\/\S+/)
        if (urlMatch && !current.prUrl) {
          current.prUrl = urlMatch[0]
        }
      }
    }

    if (branches.length === 0) {
      return `Could not parse any branches from the Graphite stack output:\n\n${raw}`
    }

    // 3. Optionally backfill missing PR info via gh (branches with no inline PR).
    if (withPr) {
      for (const b of branches) {
        if (b.isTrunk || b.prNumber !== undefined) continue
        const out = await $`gh pr view ${b.branch} --json number,url`
          .cwd(root)
          .quiet()
          .nothrow()
          .text()
        try {
          const parsed = JSON.parse(out)
          if (parsed?.number) {
            b.prNumber = parsed.number
            b.prUrl = parsed.url
          }
        } catch {
          /* no PR for this branch; leave undefined */
        }
      }
    }

    // 4. Parent = previous branch in bottom→top order (linear-stack assumption).
    //    Detect obvious non-linearity: more than one non-trunk branch sharing
    //    the same parent cannot be represented here, but a purely linear parse
    //    from `gt log --stack` is correct for the common single-line stack.
    const reviewable = branches.filter((b) => !b.isTrunk)
    if (reviewable.length === 0) {
      return "Stack contains only the trunk branch — nothing to review. Create a branch with `gt create`."
    }

    const parentOf = (index: number): string => {
      // index is into `branches` (which includes trunk at position 0).
      const globalIdx = branches.indexOf(reviewable[index])
      return branches[globalIdx - 1]?.branch ?? "(unknown)"
    }

    const outLines: string[] = ["Graphite stack (bottom → top):", ""]
    reviewable.forEach((b, i) => {
      const parent = parentOf(i)
      const marker = b.isCurrent ? " ← current" : ""
      const pr =
        b.prNumber !== undefined
          ? `PR #${b.prNumber}${b.prUrl ? ` ${b.prUrl}` : ""}`
          : "(no PR)"
      outLines.push(
        `${i + 1}. ${b.branch}${marker}\n   parent: ${parent}\n   ${pr}`,
      )
    })

    // 5. Ready-to-use diff specs for review subagents.
    outLines.push("", "Diff specs (parent...branch):")
    reviewable.forEach((b, i) => {
      outLines.push(`  git diff ${parentOf(i)}...${b.branch}`)
    })

    return outLines.join("\n")
  },
})
