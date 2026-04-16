# Getting Started with AEGIS

Zero-install first scan in 30 seconds. Real project walk-through in 5 minutes.
After this guide you will know how to scan a codebase, interpret the output,
suppress the unavoidable false positives, and plug AEGIS into CI.

> If you hit anything that isn't covered here, the full
> [README](../README.md) has the exhaustive scanner list, scoring rules,
> and MCP / VS Code / GitHub Action details.

---

## 1. Your first scan — 30 seconds

No install needed. Run:

```bash
npx @aegis-scan/cli scan .
```

from the root of any Node / TypeScript project. The CLI fetches the latest
package from npm, walks the repo, runs the scanners, and prints a score +
grade + findings grouped by severity:

```
AEGIS scan complete: 7/10 scanners ran (3 unavailable)

Score: 842/1000 — GRADE A (HARDENED)
Blockers: 0
Critical: 2
High: 11
Medium: 18
Low: 3

Top findings:
  CRITICAL — apps/web/api/users/route.ts:42  Missing auth guard
  CRITICAL — lib/db.ts:88                     SQLi via .rpc() template
  HIGH     — app/api/admin/delete/route.ts:14 Mass-assignment on .insert()
  ...

Run `aegis audit .` for the full report, or `aegis fix <finding-id>` to auto-patch.
```

Exit code `1` when blocker-severity findings exist (hardcoded secret,
`eval` with user input, JWT `none` algorithm). Otherwise `0`.

---

## 2. A real project walk-through — 5 minutes

Pick a Next.js + Supabase starter if you don't have one handy:

```bash
# One known-clean example — Vercel's commerce starter
git clone --depth 1 https://github.com/vercel/commerce.git demo
cd demo
npx @aegis-scan/cli scan .
```

### Interpreting the output

- **Score 0-1000** — weighted aggregate. Blockers subtract a lot; Low-sev
  findings hardly move the number. 1000 is fiction; real codebases land
  500-900.
- **Grade** — FORTRESS (950+) ▸ A (850-949) ▸ B (700-849) ▸ C (500-699) ▸
  D (300-499) ▸ F (<300). **CRITICAL** badge appears when any blocker
  exists regardless of numeric score — a single `eval(userInput)` drags
  your grade to F.
- **Blocked** — hard gate for CI. `aegis scan` exits 1 when any
  `severity: "blocker"` finding exists. Fix the blocker or add an
  inline suppression with a reason.
- **Top findings** — sorted by severity, then by scanner confidence.
  The CLI prints the first 20; `--format json` gives you the full list.

### Finding the blocker first

```bash
npx @aegis-scan/cli scan . --format json | jq '.findings[] | select(.severity == "blocker")'
```

Blockers are the work item. Everything else is a backlog.

### Auto-fixing a specific finding

```bash
npx @aegis-scan/cli fix TAINT-014
```

`fix` emits a targeted prompt (XML-fenced, injection-hardened) your AI
assistant can consume to patch the offending line. It does not apply
changes directly — review before commit.

---

## 3. Configuring aegis.config.json

Drop an `aegis.config.json` at the repo root to scope the scan. Every
key is optional; the scanner runs with sensible defaults when the file
is absent.

```json
{
  "ignore": [
    "**/dist/**",
    "**/build/**",
    "**/__fixtures__/**"
  ],
  "scanners": {
    "ssrf-checker": { "severity": "high" }
  },
  "suppressions": [
    {
      "file": "lib/legacy/**",
      "rule": "console-checker",
      "reason": "Legacy module scheduled for removal in v3; logs are intentional."
    },
    {
      "file": "app/webhooks/stripe/route.ts",
      "rule": "CWE-918",
      "reason": "Stripe webhook endpoint — URL is validated against signed timestamp, not a user-supplied host."
    }
  ],
  "suppressionOptions": {
    "warnUnused": true,
    "warnNaked": true
  }
}
```

Key fields:

- **ignore** — glob patterns relative to the project root. Skipped
  entirely; no scanner reads them.
- **suppressions** — array of `{ file, rule, reason }`. `rule` can be a
  scanner name (`"rls-bypass-checker"`) or a CWE id (`"CWE-78"`). The
  `reason` is required to be ≥10 characters — future-you will thank you.
- **suppressionOptions.warnUnused** — prints `[aegis] Unused suppression
  in <file>:<line>` when a suppression never matched a finding. Set to
  `false` in noisy repos; set to `true` in disciplined ones.
- **customSinks / customSources / customSanitizers** — project-specific
  taint registry extensions. See [custom-rules.md](./custom-rules.md).

Generate a starter config:

```bash
npx @aegis-scan/cli init .
```

---

## 4. Fixing false positives

AEGIS aims for precision over recall, but every static scanner misses
context. Three escape hatches, in order of preference:

### Inline suppression (finest grain)

Add a `// aegis-ignore` comment on the line above the finding:

```ts
// aegis-ignore CWE-918 — URL is validated by signed webhook timestamp
await fetch(signedCallbackUrl);
```

- Reason after `—` is mandatory; bare `// aegis-ignore CWE-918`
  triggers `[aegis] Naked suppression` warnings.
- Optional CWE narrows the suppression to one class — other CWEs on
  the same line still emit.

### Config-level suppression (file-glob grain)

Matches a whole tree via `suppressions[].file`:

```json
{
  "file": "lib/legacy/auth/**",
  "rule": "auth-enforcer",
  "reason": "Deprecated auth flow — do NOT extend; tracked for removal in RB-1824."
}
```

Use when an entire module is knowingly broken-but-frozen.

### When to file a bug vs suppress

- **File a bug** when the finding is wrong on a pattern that should
  generalize — the scanner has a precision gap affecting every user who
  writes that pattern.
- **Suppress** when the finding is wrong only in *your specific
  context* — a webhook whose URL is trusted via signature, a test
  fixture deliberately storing a fake secret, an intentional
  `console.log` in a CLI tool.

If you're unsure: **file the bug with a minimal reproducer** and
suppress locally in the meantime. The repo is at
[github.com/RideMatch1/a.e.g.i.s](https://github.com/RideMatch1/a.e.g.i.s).

---

## 5. MCP server — connecting AEGIS to your AI agent

If you use Claude Code / Cursor / an MCP-aware agent, AEGIS exposes its
scanners as tools:

```bash
npm install -g @aegis-scan/mcp-server
```

```json
{
  "mcpServers": {
    "aegis": {
      "command": "aegis-mcp",
      "args": []
    }
  }
}
```

The agent can now call these five tools directly:

| Tool | Purpose |
|---|---|
| `aegis_scan` | Run the security scan on a project directory (`mode: 'scan' \| 'audit'`) |
| `aegis_findings` | Fetch detailed findings from the last scan, optionally filtered by severity or scanner |
| `aegis_score` | Get the current 0-1000 score + grade for a project |
| `aegis_compliance` | Check a project against a compliance framework (`gdpr` / `soc2` / `iso27001` / `pci-dss`) |
| `aegis_fix_suggestion` | Request a fix suggestion for a specific finding id |

See the **MCP Server** section of the [README](../README.md) for the
full input schemas + example agent prompts.

---

## 6. CI/CD — fail PRs on regressions

Minimal GitHub Actions workflow:

```yaml
name: AEGIS Security Scan
on: [pull_request]
jobs:
  aegis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npx @aegis-scan/cli scan . --format sarif > aegis.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with: { sarif_file: aegis.sarif }
```

For the full action (PR comments, threshold gates, security-review
integration) see the **GitHub Action** section of the
[README](../README.md).

---

## 7. What's next

- **[Full scanner list](../README.md#what-aegis-finds-that-generic-sast-tools-miss)** — 39 built-in scanners + 16 external tool wrappers
- **[Scoring rules](../README.md#scoring)** — how the 0-1000 score is weighted
- **[Custom rules](./custom-rules.md)** — project-specific sources / sinks / sanitizers
- **[Suppression DSL](./suppressions.md)** — inline + config, all supported forms
- **[Corpus-level precision](./corpus/README.md)** — multi-project dogfood
  methodology if you want to validate scanner precision yourself

Bug reports, feature requests, and PRs welcome at
[github.com/RideMatch1/a.e.g.i.s](https://github.com/RideMatch1/a.e.g.i.s).
