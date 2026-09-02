## Global

* Please speak in Simplified Technical English - aka `asd-ste100`
  * We should strive to be clear and precise in our communication, rather than speaking around the problem and using flowery language
* Remember to use sub-agents where it makes sense to do so. By your nature, being an experienced servant, you know when it is appropriate to delegate tasks to others.
* The notes/ directory is a symlink to an external location. Files there are NOT tracked by this repo's git. Only commit code changes within the main repository.

## Skills

- **BEFORE writing any code or running commands**, review the task and load ALL potentially relevant skills:
  - Task involves tests? → Load `test-running` skill FIRST
  - Task involves database changes? → Load `database-migration` skill FIRST
  - Task involves React components? → Load `react-component-writing` skill FIRST
  - Task involves feature flags? → Load `feature-flag-create-or-remove` skill FIRST
  - Task involves git/branches/PRs? → Load `graphite-cli` skill FIRST
  - Task involves GitHub PRs, issues, CI checks, releases, or the GitHub API? → Load `github-cli` skill FIRST
  - Task is a data-integrity / "why does this data look wrong" investigation? → Load `data-integrity-investigation` skill FIRST
  - Anything else that you deem potentially relevant

## Graphite CLI

- Use Graphite CLI (`gt`) for all git branch and PR operations
- Load the `graphite-cli` skill for complete command reference and examples
- Run `gt` commands via the Bash tool (not via MCP)

## Handling Pre-existing CI/Test Failures

When running validation commands (typecheck, tests, build), if failures occur:
1. First check if the failing files are in your changeset (`git status`)
2. If failing files are NOT in your changeset, note them as pre-existing issues and proceed
3. Do NOT spend time investigating or fixing unrelated failures unless explicitly asked
4. Document pre-existing failures in commit messages or plan notes for visibility

## Grepping and Searching
- AWLAYS try to use the `grep` tool first
    - If you must search from bash, ALWAYS choose `rg` (ripgrep) over `grep`

## Code Comments
- Default to **minimal comments**; lean toward removal.
- **Never add ticket-reference or "why-I-changed-this" comments** (e.g. `// GROW-123: ...`). Rationale for a change belongs in the commit message / PR description, not the code.
- Keep a comment only for a genuinely non-obvious invariant that the code cannot express. When in doubt, leave it out. Do not add a comment just because a plan suggested one.
