# @aegis-scan/scanners

Scanner registry for the [AEGIS](https://github.com/RideMatch1/a.e.g.i.s) security-scanner suite — a paranoid stack-specific SAST scanner for Next.js + Supabase projects.

Ships:

- **41 built-in regex checkers** — auth-enforcer, tenant-isolation-checker, rls-bypass-checker, zod-enforcer, sql-concat-checker, template-sql-checker, xss-checker, ssrf-checker, csrf-checker, rate-limit-checker, path-traversal-checker, prompt-injection-checker, redos-checker, rsc-data-checker, mass-assignment-checker, open-redirect-checker, cors-checker, header-checker, config-auditor, cookie-checker, entropy-scanner, jwt-detector, jwt-checker, timing-safe-checker, upload-validator, error-leakage-checker, env-validation-checker, http-timeout-checker, next-public-leak, middleware-auth-checker, dep-confusion-checker, supply-chain, gdpr-engine, soc2-checker, iso27001-checker, pci-dss-checker, pagination-checker, i18n-quality, logging-checker, console-checker, crypto-auditor.
- **1 AST cross-file taint analyzer** — TypeScript Compiler API + module-graph + function-summary cache; per-CWE sanitizer awareness.
- **20 external-tool wrappers** — Semgrep, Bearer, Gitleaks, TruffleHog, OSV-Scanner, npm-audit, license-checker, Nuclei, OWASP-ZAP, Trivy, Hadolint, Checkov, testssl.sh, React-Doctor, axe-Lighthouse, Lighthouse-Performance, Subfinder (passive subdomain recon, pentest-mode only), Strix, PTAI, Pentest-Swarm-AI (LLM-agent pentest, pentest-mode only). All auto-skip when the underlying binary is absent on PATH.
- **5 attack probes** — auth-probe, header-probe, rate-limit-probe, privesc-probe, race-probe. Used only in `aegis siege` mode against an explicit live target.

Most consumers should depend on `@aegis-scan/cli` instead — it bundles core, scanners, and reporters into a single CLI binary. This package is exposed for advanced integrations.

## Install

```bash
npm install @aegis-scan/scanners
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
