# @aegis-scan/reporters

Output reporters for the [AEGIS](https://github.com/RideMatch1/a.e.g.i.s) security-scanner suite — a paranoid stack-specific SAST scanner for Next.js + Supabase projects.

Ships five output formats:

- **Terminal** — colour-rich table with progress bars (default for `aegis scan`).
- **JSON** — machine-parseable scan result with full finding metadata.
- **SARIF 2.1.0** — drop-in for [GitHub Code Scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning).
- **HTML** — standalone dashboard with severity breakdown + per-finding cards.
- **Markdown** — PR-comment-friendly with finding tables and fix suggestions.

Each reporter consumes a `ScanResult` from `@aegis-scan/core` and is independent — adding a custom reporter does not require modifying the orchestrator.

Most consumers should depend on `@aegis-scan/cli` instead — it bundles core, scanners, and reporters into a single CLI binary. This package is exposed for advanced integrations (custom report formats, custom CI dashboards, programmatic post-processing).

## Install

```bash
npm install @aegis-scan/reporters
```

Node 20+ required. Depends on `@aegis-scan/core`.

## Supply-chain integrity

Every published version ships with SLSA v1 provenance. No install-time scripts. See the top-level [SECURITY.md](https://github.com/RideMatch1/a.e.g.i.s/blob/main/SECURITY.md) for the full supply-chain integrity posture.

## Links

- **Main repo:** https://github.com/RideMatch1/a.e.g.i.s
- **CLI on npm:** https://www.npmjs.com/package/@aegis-scan/cli
- **CHANGELOG:** https://github.com/RideMatch1/a.e.g.i.s/blob/main/CHANGELOG.md

## License

MIT
