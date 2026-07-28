import { tool } from "@opencode-ai/plugin"

interface ReviewComment {
  id: string
  body: string
  author: { login: string } | null
  createdAt: string
  url: string
}

interface ReviewThread {
  isResolved: boolean
  isOutdated: boolean
  path: string | null
  line: number | null
  comments: { nodes: ReviewComment[] }
}

const QUERY = `
query($owner: String!, $name: String!, $pr: Int!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          isResolved
          isOutdated
          path
          line
          comments(first: 50) {
            nodes { id body author { login } createdAt url }
          }
        }
      }
    }
  }
}`

const truncate = (s: string, n = 100): string => {
  const oneLine = s.replace(/\s+/g, " ").trim()
  return oneLine.length > n ? `${oneLine.slice(0, n - 1)}…` : oneLine
}

export default tool({
  description:
    "Fetch, filter, and bucket the UNRESOLVED review threads on a GitHub PR in one call — the plumbing behind the address-comments / address-stack-comments workflows. Runs the paginated GraphQL reviewThreads query, keeps only unresolved threads, and groups them into BugBot (cursor[bot]) vs. human reviewers, ready to present for selection. Use this instead of hand-rolling the `gh api graphql` query and jq filtering.",
  args: {
    pr: tool.schema
      .string()
      .optional()
      .describe(
        "PR number or URL. Defaults to the PR for the current branch (via `gh pr view`).",
      ),
    includeResolved: tool.schema
      .boolean()
      .optional()
      .describe("Include resolved threads too (default false)."),
  },
  async execute(args, context) {
    const $ = Bun.$
    const root = context.directory

    // 1. Resolve owner/repo.
    const repoJson = await $`gh repo view --json owner,name`
      .cwd(root)
      .quiet()
      .nothrow()
      .text()
    let owner = ""
    let name = ""
    try {
      const parsed = JSON.parse(repoJson)
      owner = parsed?.owner?.login ?? ""
      name = parsed?.name ?? ""
    } catch {
      return `Could not resolve the GitHub repo (\`gh repo view\` failed). Are you authenticated (\`gh auth status\`)?`
    }
    if (!owner || !name) {
      return `Could not resolve owner/repo from \`gh repo view\`: ${repoJson}`
    }

    // 2. Resolve PR number (arg → trailing digits; else current branch).
    let prNumber: number | undefined
    if (args.pr) {
      const m = args.pr.match(/(\d+)\s*$/)
      if (m) prNumber = Number(m[1])
    }
    if (prNumber === undefined) {
      const prJson = await $`gh pr view --json number`
        .cwd(root)
        .quiet()
        .nothrow()
        .text()
      try {
        prNumber = JSON.parse(prJson)?.number
      } catch {
        /* fall through */
      }
    }
    if (prNumber === undefined) {
      return "No PR found. Pass a PR number/URL, or check out a branch that has an open PR."
    }

    // 3. Page through reviewThreads deterministically.
    const threads: ReviewThread[] = []
    let endCursor: string | null = null
    for (let page = 0; page < 50; page++) {
      const cursorArgs = endCursor ? ["-F", `endCursor=${endCursor}`] : []
      const out = await $`gh api graphql -F owner=${owner} -F name=${name} -F pr=${prNumber} ${cursorArgs} -f query=${QUERY}`
        .cwd(root)
        .quiet()
        .nothrow()
        .text()
      let parsed: any
      try {
        parsed = JSON.parse(out)
      } catch {
        return `GraphQL query failed for PR #${prNumber}:\n${out}`
      }
      const rt = parsed?.data?.repository?.pullRequest?.reviewThreads
      if (!rt) {
        return `Unexpected GraphQL response for PR #${prNumber}:\n${out}`
      }
      threads.push(...(rt.nodes ?? []))
      if (!rt.pageInfo?.hasNextPage) break
      endCursor = rt.pageInfo.endCursor
    }

    // 4. Filter + bucket.
    const kept = args.includeResolved
      ? threads
      : threads.filter((t) => !t.isResolved)

    if (kept.length === 0) {
      return `No ${args.includeResolved ? "" : "unresolved "}review comments on PR #${prNumber}. 🎉`
    }

    const bot: ReviewThread[] = []
    const human: ReviewThread[] = []
    for (const t of kept) {
      const first = t.comments?.nodes?.[0]
      if (first?.author?.login === "cursor[bot]") bot.push(t)
      else human.push(t)
    }

    // 5. Render numbered, grouped output (Phase-3 shape the commands expect),
    //    plus a full-body machine trailer.
    const heading = args.includeResolved
      ? `## PR Review Comments (PR #${prNumber}, incl. resolved)`
      : `## Unresolved PR Comments (PR #${prNumber})`
    const out: string[] = [heading, ""]
    let n = 0
    const full: string[] = []

    const render = (list: ReviewThread[], showAuthor: boolean) => {
      for (const t of list) {
        n++
        const loc = `${t.path ?? "(general)"}:${t.line ?? "?"}`
        const first = t.comments?.nodes?.[0]
        const author = first?.author?.login ?? "unknown"
        const authorTag = showAuthor ? ` (${author})` : ""
        const replies = (t.comments?.nodes?.length ?? 1) - 1
        const replyTag = replies > 0 ? ` [+${replies} repl${replies === 1 ? "y" : "ies"}]` : ""
        out.push(`${n}. **${loc}**${authorTag} — "${truncate(first?.body ?? "")}"${replyTag}`)

        full.push(
          `--- [${n}] ${loc} (${author})${t.isOutdated ? " [outdated]" : ""} ${first?.url ?? ""}`,
        )
        for (const c of t.comments?.nodes ?? []) {
          full.push(`  ${c.author?.login ?? "unknown"}: ${c.body.replace(/\s+/g, " ").trim()}`)
        }
      }
    }

    out.push(`### BugBot (cursor[bot]) — ${bot.length} comment${bot.length === 1 ? "" : "s"}`)
    if (bot.length === 0) out.push("(none)")
    render(bot, false)
    out.push("")
    out.push(`### Human Reviewers — ${human.length} comment${human.length === 1 ? "" : "s"}`)
    if (human.length === 0) out.push("(none)")
    render(human, true)

    out.push("", "---", "Full thread bodies (for context when fixing):", ...full)

    return out.join("\n")
  },
})
