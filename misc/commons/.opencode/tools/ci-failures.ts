import { tool } from "@opencode-ai/plugin"

// Scratch dir for large CI logs (pre-approved external work dir; never the repo).
const SCRATCH = "/Users/jacob.waldrip/tmp/opencode"

// Failure markers used to extract the meaningful lines from a large CI log.
const FAILURE_GREP = "FAIL |✕|✗|Expected|Received|Error:"

interface Check {
  name: string
  state: string
  bucket: string
  link: string
  workflow: string
}

interface ParsedLink {
  runId?: string
  jobId?: string
}

// A GitHub check `link` is one of:
//   .../actions/runs/<runId>/job/<jobId>   → both ids present
//   .../runs/<id>                          → a check-run id; treat as run id
function parseLink(link: string): ParsedLink {
  const withJob = link.match(/\/actions\/runs\/(\d+)\/job\/(\d+)/)
  if (withJob) return { runId: withJob[1], jobId: withJob[2] }
  const runOnly = link.match(/\/runs\/(\d+)/)
  if (runOnly) return { runId: runOnly[1] }
  return {}
}

export default tool({
  description:
    "For a GitHub PR, return the FAILING CI checks together with the extracted failure-log excerpts — the plumbing behind the fix-ci workflow (collapses `gh pr checks` + run-id parsing + `gh run view --log-failed` + the reusable-workflow raw-log fallback + failure grep into one call). Use this instead of hand-rolling the gh/jq/grep sequence. Pair with the `nx-project-for-file` tool to get the local repro command for each failing file.",
  args: {
    pr: tool.schema
      .string()
      .optional()
      .describe(
        "PR number or URL. Defaults to the PR for the current branch (via `gh pr view`).",
      ),
    maxLines: tool.schema
      .number()
      .optional()
      .describe("Max failure-log lines to show per failing check (default 80)."),
  },
  async execute(args, context) {
    const $ = Bun.$
    const root = context.directory
    const maxLines = args.maxLines ?? 80

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
      return "Could not resolve the GitHub repo (`gh repo view` failed). Are you authenticated (`gh auth status`)?"
    }

    // 2. Resolve PR number.
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

    // 3. List checks; isolate failures.
    const checksJson = await $`gh pr checks ${prNumber} --json name,state,bucket,link,workflow`
      .cwd(root)
      .quiet()
      .nothrow()
      .text()
    let checks: Check[] = []
    try {
      checks = JSON.parse(checksJson)
    } catch {
      return `Could not read checks for PR #${prNumber}:\n${checksJson}`
    }

    const failing = checks.filter((c) => c.bucket === "fail")
    const pending = checks.filter((c) => c.bucket === "pending")

    if (failing.length === 0) {
      const pendingNote =
        pending.length > 0
          ? ` (${pending.length} still pending — re-run when done, or \`gh pr checks ${prNumber} --watch\`)`
          : ""
      return `No failing checks on PR #${prNumber}. 🟢${pendingNote}`
    }

    // 4. For each failing check, resolve run/job ids and pull failure logs.
    await $`mkdir -p ${SCRATCH}`.quiet().nothrow()
    const out: string[] = [
      `## Failing CI checks (PR #${prNumber}) — ${failing.length} failing${pending.length ? `, ${pending.length} pending` : ""}`,
      "",
    ]

    const extractFailures = (log: string): { text: string; matched: boolean } => {
      const re = new RegExp(FAILURE_GREP)
      const hits = log.split("\n").filter((l) => re.test(l))
      if (hits.length === 0) {
        // No recognizable failure markers — show the tail (where errors usually
        // surface) rather than the setup-noise head.
        const tail = log.split("\n").filter((l) => l.trim()).slice(-maxLines)
        return { text: tail.join("\n").trim(), matched: false }
      }
      return { text: hits.slice(0, maxLines).join("\n").trim(), matched: true }
    }

    for (const check of failing) {
      out.push(`### ${check.name}`)
      out.push(`workflow: ${check.workflow}`)
      out.push(`link: ${check.link}`)

      const { runId, jobId } = parseLink(check.link)
      if (!runId) {
        out.push("(could not parse a run id from the check link — inspect manually)", "")
        continue
      }

      // Resolve the failing job id if the link didn't carry one.
      let resolvedJobId = jobId
      if (!resolvedJobId) {
        const jobsOut = await $`gh api repos/${owner}/${name}/actions/runs/${runId}/jobs --paginate -q ${'.jobs[] | select(.conclusion=="failure") | .id'}`
          .cwd(root)
          .quiet()
          .nothrow()
          .text()
        resolvedJobId = jobsOut.trim().split("\n").filter(Boolean)[0]
      }

      // Primary: gh run view --log-failed (scoped to the job when known).
      let log = ""
      if (resolvedJobId) {
        log = await $`gh run view ${runId} --job ${resolvedJobId} --log-failed`
          .cwd(root)
          .quiet()
          .nothrow()
          .text()
      } else {
        log = await $`gh run view ${runId} --log-failed`
          .cwd(root)
          .quiet()
          .nothrow()
          .text()
      }

      // Reusable/nested-workflow trap: a suspiciously short log that is only
      // caller setup ("Prepare/Download action") is NOT the real failure —
      // fall back to the raw job-log archive via the API.
      const shortAndSetup =
        log.split("\n").filter((l) => l.trim()).length < 30 &&
        /Prepare|Download action|Set up job/.test(log)
      if ((!log.trim() || shortAndSetup) && resolvedJobId) {
        const archive = await $`gh api repos/${owner}/${name}/actions/jobs/${resolvedJobId}/logs`
          .cwd(root)
          .quiet()
          .nothrow()
          .text()
        if (archive.trim()) log = archive
      }

      if (!log.trim()) {
        out.push("(no failure log retrieved — inspect the run link manually)", "")
        continue
      }

      // Persist the full log for deeper inspection, show the grepped excerpt.
      const logPath = `${SCRATCH}/ci-fail-${runId}${resolvedJobId ? `-${resolvedJobId}` : ""}.log`
      await Bun.write(logPath, log)

      const { text: excerpt, matched } = extractFailures(log)
      out.push(`full log: ${logPath}`)
      if (!matched) {
        out.push("(no failure markers matched — showing log tail; see full log for detail)")
      }
      out.push("```")
      out.push(excerpt || "(empty log)")
      out.push("```", "")
    }

    out.push(
      "---",
      "Next: for each failing file, use the `nx-project-for-file` tool to get the exact local test/lint/typecheck command, then reproduce before fixing.",
    )

    return out.join("\n")
  },
})
