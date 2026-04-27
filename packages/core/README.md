# @aegis-scan/core

Core engine for the [AEGIS](https://github.com/RideMatch1/a.e.g.i.s) security-scanner suite — a paranoid stack-specific SAST scanner for Next.js + Supabase projects.

This package provides the orchestrator, scoring engine (0-1000 with FORTRESS / HARDENED / SOLID / NEEDS_WORK / AT_RISK / CRITICAL grades), Zod-strict config loader, suppression filter, and shared types + utilities consumed by `@aegis-scan/scanners`, `@aegis-scan/reporters`, and `@aegis-scan/cli`.

Most consumers should depend on `@aegis-scan/cli` instead — it bundles core, scanners, and reporters into a single CLI binary. This package is exposed for advanced integrations (custom orchestration, programmatic API, custom reporter implementations).

## Install

```bash
npm install @aegis-scan/core
```

Node 20+ required.

## Supply-chain integrity

Every published version ships with SLSA v1 provenance:

```bash
npm audit signatures
npm view @aegis-scan/core@<version> dist.attestations.provenance.predicateType
# → https://slsa.dev/provenance/v1
```

No install-time scripts are declared in any `@aegis-scan/*` package. See the top-level [SECURITY.md](https://github.com/RideMatch1/a.e.g.i.s/blob/main/SECURITY.md) for the full supply-chain integrity posture.

## Links

- **Main repo:** https://github.com/RideMatch1/a.e.g.i.s
- **CLI on npm:** https://www.npmjs.com/package/@aegis-scan/cli
- **CHANGELOG:** https://github.com/RideMatch1/a.e.g.i.s/blob/main/CHANGELOG.md

## License

MIT
