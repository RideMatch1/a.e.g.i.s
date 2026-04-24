# Security Policy

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Report via GitHub's private Security Advisory channel:

👉 <https://github.com/RideMatch1/a.e.g.i.s/security/advisories/new>

Include whatever you have:

- Affected version(s) or commit SHA.
- Reproduction steps and/or a minimal proof-of-concept.
- Impact assessment (what an attacker gains; preconditions needed).

If you're unsure whether something qualifies as a vulnerability, report it — we'd rather triage a near-miss than miss the real thing.

## Response timeline

The project is maintained on a limited hobbyist/side-project budget. Timelines reflect that honestly — if you need enterprise SLA guarantees, this is not the tool for you:

| Stage | Target |
|-------|--------|
| Acknowledgement of report | within **72 hours** |
| Initial triage + severity assessment | within **7 days** |
| Fix — critical | within **30 days** |
| Fix — high | within **60 days** |
| Fix — medium | within **90 days** |
| Fix — low | best-effort, bundled into the next sprint |

We practice coordinated disclosure: a disclosure timeline is agreed with the reporter before any public release. For critical issues with active exploitation risk, we prioritise the fix + advisory publication together.

## Supported versions

Pre-1.0 (current state):

- The **latest tagged version** receives security fixes.
- Older tags are unsupported. Upgrade to the latest tag if you're on an older release.

Post-1.0 will commit to a longer support window; policy will be written into this file at v1.0 tag.

## Scope

**In-scope** (vulnerabilities in AEGIS itself):

- AEGIS CLI, scanners, reporters, core orchestrator.
- MCP server (`packages/mcp-server/`).
- Shipped benchmark and test fixtures — bugs that cause AEGIS to crash, produce wrong findings on the vulnerable-app benchmark, or leak data from the scanning environment.

**Out-of-scope**:

- **Findings AEGIS produces about user code**. Those are scanner outputs by design — if AEGIS flags a vulnerability in your project, it's doing its job. Report scanner *accuracy* issues (false positives, false negatives) as regular GitHub Issues, not as security advisories.
- **Third-party dependency vulnerabilities**. Report those to the dependency's maintainers; we'll update our lockfile once their fix lands.
- **Attacks requiring privileged local access** (arbitrary code execution on the machine running AEGIS, attacker already has file-system write). AEGIS assumes it's running in a trusted local environment.

## Supply-chain integrity invariants

These are structural guarantees about how AEGIS packages are built and shipped. Violations are compromise indicators — report immediately via the disclosure channel above.

- **No install-time code execution.** No AEGIS package (`@aegis-scan/*`, `@aegis-wizard/*`) declares a `preinstall`, `install`, `postinstall`, `preuninstall`, `postuninstall`, or `prepare` script. A consumer running `npm install @aegis-*` executes zero scripts from our namespace. If your install executes a hook from our packages, the published package has been tampered with.
- **SLSA v1 provenance on every published version.** Verify with `npm audit signatures` or `npm view @aegis-scan/<pkg>@<version> dist.attestations.provenance.predicateType`. Expected value: `https://slsa.dev/provenance/v1`. A missing attestation indicates tamper.
- **Published via GitHub Actions only.** All releases originate from `.github/workflows/publish*.yml`, triggered by a signed git tag pushed by the maintainer. No direct publishes from developer machines.
- **Deprecation over deletion.** We use `npm deprecate`, never `npm unpublish`. A deprecated version with a security note should not be installed.

**Verifying a specific installation:**

```bash
# Expected: https://slsa.dev/provenance/v1
npm view @aegis-scan/cli@<version> dist.attestations.provenance.predicateType

# Expected: empty or a subset limited to CI-build hooks the consumer can safely ignore
npm view @aegis-scan/cli@<version> scripts
```

## Responsible-use posture for `@aegis-scan/skills`

The skills library ships as an opt-in sub-package
(`@aegis-scan/skills`). Its offensive-category content — forked from
SnailSploit/Claude-Red with per-file attribution preserved — is
methodology documentation for authorized testing only. Use is scoped
to:

- Authorized security testing of systems you own or have explicit
  written permission to test.
- Bug-bounty engagements strictly within the agreed scope.
- CTF competitions and educational environments.
- Defensive security research — understanding attack classes to
  defend against them.

Use against systems you do not own or have explicit permission to
test is unauthorized and likely illegal in most jurisdictions. AEGIS
provides methodology; responsible use is the operator's obligation.
We will cooperate with legitimate abuse reports via the disclosure
channel above.

AEGIS does not provide legal counsel. If you are uncertain whether a
test is authorized or whether a specific activity falls within the
scope of your engagement, consult your own legal advisor before
proceeding. Written authorization specific to the test scope
(systems, time-window, allowed actions, prohibited actions) is the
operator's baseline obligation.

## Security-focused design decisions

These are deliberate design choices that may look like bugs but are intended behavior:

- **No network calls by default.** `aegis scan` runs fully local. Only `--ai` and AI-gated features reach out to providers — user-consented, opt-in.
- **No telemetry.** Zero analytics, error reporting, or usage data leaves the user's machine.
- **Type-aware sink resolution is `child_process`-only in v0.7.** Expansion to `fs` / `path` / `crypto` / network modules is planned for a future release. Bugs about missing detections in those modules are feature gaps, not security vulnerabilities.

Thanks for responsible disclosure — it keeps everyone who uses AEGIS safer.
