# @aegis-scan/mcp-server

MCP (Model Context Protocol) server that exposes the AEGIS security-scanner
as callable tools for Claude-compatible agents: Claude Desktop, Claude Code,
Cursor, Continue, Zed, and any other MCP-compatible client.

Part of the [AEGIS](https://github.com/RideMatch1/a.e.g.i.s) suite — a
paranoid SAST scanner purpose-built for Next.js + Supabase projects. The MCP
server wraps the same scanner the `aegis` CLI drives, so an agent can run
scans, inspect findings, ask for fix-suggestions, and check compliance
coverage — all without leaving the chat loop.

## What it exposes

Five tools, all name-prefixed `aegis_`:

| Tool | Purpose |
|---|---|
| `aegis_scan` | Run a scan on a project directory. Modes: `scan` (fast — security, deps, quality, compliance, i18n) or `audit` (all scanners incl. DAST / accessibility / perf). |
| `aegis_findings` | List findings from the most recent scan. Filter by severity, scanner, or file. |
| `aegis_score` | Get the 0-1000 score, grade (S/A/B/C/D/F), and badge (`FORTRESS`/`HARDENED`/...) for the last scan. |
| `aegis_compliance` | Map findings to a compliance framework (GDPR / SOC 2 / ISO 27001 / PCI-DSS) and report per-control coverage. |
| `aegis_fix_suggestion` | Return an actionable fix suggestion for a specific finding-ID. |

State is per-process: `aegis_findings` / `aegis_score` / etc. operate on the
result of the most recent `aegis_scan` in the same MCP session.

## Install

```sh
# One-shot via npx (recommended for initial-try):
npx -y -p @aegis-scan/mcp-server aegis-mcp

# Or install globally:
npm install -g @aegis-scan/mcp-server
```

Node 20+ required. The server reads from stdin / writes to stdout using the
standard MCP stdio transport.

## Connect from Claude Desktop

Add to your `claude_desktop_config.json` (macOS:
`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "aegis": {
      "command": "npx",
      "args": ["-y", "-p", "@aegis-scan/mcp-server", "aegis-mcp"]
    }
  }
}
```

Restart Claude Desktop. The five `aegis_*` tools appear under the
server name "aegis" — Claude will call them when a prompt asks for a
security scan, audit, or compliance check on a local repo.

## Connect from other MCP clients

- **Claude Code:** add via `claude mcp add aegis -- npx -y -p @aegis-scan/mcp-server aegis-mcp`
- **Cursor / Continue / Zed:** register `aegis-mcp` as an stdio server per
  the client's MCP-config docs. Command and args match the Claude Desktop
  snippet above.

## Scope boundary

The MCP server is a **thin wrapper** — every tool delegates to the
`@aegis-scan/core` + `@aegis-scan/scanners` packages. The scan-logic, the
scoring-rubric, and the suppression-pipeline all live in those packages.
For stack-specific scanner behavior (custom role-guards, boundary-column
aliases, CSRF middleware overrides, `criticalDeps`, etc.) configure via
`aegis.config.json` in the project being scanned — the MCP server reads
the same config the CLI does.

For a `--verbose` or non-Claude workflow, prefer the `aegis` CLI directly
(`npm install -g @aegis-scan/cli`).

## Links

- **Main repo + CLI:** https://github.com/RideMatch1/a.e.g.i.s
- **CLI on npm:** https://www.npmjs.com/package/@aegis-scan/cli
- **CHANGELOG:** https://github.com/RideMatch1/a.e.g.i.s/blob/main/CHANGELOG.md
- **MCP protocol:** https://modelcontextprotocol.io/

## License

MIT — see [LICENSE](./LICENSE) in this package.
