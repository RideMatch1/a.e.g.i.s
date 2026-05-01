# CREDITS & Attribution

AEGIS integrates with, wraps, or draws inspiration from the following open-source projects.
We are deeply grateful to their maintainers and communities.

## Integrated Tools (Scanner Wrappers)

These tools are invoked as external CLI processes by AEGIS scanners.

| Tool | GitHub | License | Used For | AEGIS Scanner |
|------|--------|---------|----------|---------------|
| Semgrep | [semgrep/semgrep](https://github.com/semgrep/semgrep) | LGPL-2.1 | Static analysis (SAST) across 20+ languages using 600+ community security rules | `sast/semgrep` |
| Gitleaks | [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) | MIT | Detecting hardcoded secrets, API keys, and tokens in source code and git history | `secrets/gitleaks` |
| OSV-Scanner | [google/osv-scanner](https://github.com/google/osv-scanner) | Apache-2.0 | Scanning dependencies against the Open Source Vulnerabilities (osv.dev) database | `dependencies/osv-scanner` |
| npm audit | [npm/cli](https://docs.npmjs.com/cli/commands/npm-audit) | Artistic-2.0 | Scanning npm dependency trees against the npm advisory database | `dependencies/npm-audit` |
| Nuclei | [projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei) | MIT | Dynamic application security testing (DAST) using 9,000+ community templates | `dast/nuclei` |
| Trivy | [aquasecurity/trivy](https://github.com/aquasecurity/trivy) | Apache-2.0 | Container image CVE scanning and Dockerfile misconfiguration detection | `infrastructure/trivy` |
| Hadolint | [hadolint/hadolint](https://github.com/hadolint/hadolint) | GPL-3.0 | Dockerfile linting — best practices, shell injection in RUN, unnecessary privileges | `infrastructure/hadolint` |
| testssl.sh | [drwetter/testssl.sh](https://github.com/drwetter/testssl.sh) | GPL-2.0 | TLS/SSL auditing — certificate chains, cipher suites, protocol downgrades, BEAST/POODLE/ROBOT | `tls/testssl` |
| react-doctor | [aidenybai/million](https://github.com/aidenybai/million) | MIT | Detecting React anti-patterns, performance issues, and hook violations | `react/react-doctor` |
| license-checker | [davglass/license-checker](https://github.com/davglass/license-checker) | BSD-3-Clause | Detecting copyleft or restricted licenses in the dependency tree | `dependencies/license-checker` |
| OWASP ZAP | [zaproxy/zaproxy](https://github.com/zaproxy/zaproxy) | Apache-2.0 | Full DAST spider, active scan, and passive scan against live targets (requires Docker) | `dast/zap` |
| TruffleHog | [trufflesecurity/trufflehog](https://github.com/trufflesecurity/trufflehog) | AGPL-3.0 | Deep git history scanning for secrets with entropy analysis and credential verification | `secrets/trufflehog` |
| Bearer | [Bearer/bearer](https://github.com/Bearer/bearer) | LGPL-3.0 | Privacy-focused SAST — PII data flow tracking, third-party tracker detection | `compliance/bearer` |
| Checkov | [bridgecrewio/checkov](https://github.com/bridgecrewio/checkov) | Apache-2.0 | Infrastructure-as-Code scanning — Terraform, CloudFormation, Kubernetes misconfigurations | `infrastructure/checkov` |
| axe/Lighthouse | [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | MPL-2.0 | Automated accessibility auditing against WCAG 2.2 AA standards | `accessibility/axe-lighthouse` |
| Lighthouse Performance | [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) | Apache-2.0 | Performance auditing, Core Web Vitals scoring, and best practices checks | `performance/lighthouse` |

## Planned Integrations (Milestone 2-3)

These tools will be integrated as scanner wrappers in future releases.

### Milestone 2

| Tool | GitHub | License | Planned For | Category |
|------|--------|---------|-------------|----------|
| Squawk | [sbdchd/squawk](https://github.com/sbdchd/squawk) | MIT | PostgreSQL migration linting — unsafe migrations, missing transactions, destructive changes | compliance |
| Grype | [anchore/grype](https://github.com/anchore/grype) | Apache-2.0 | Container image and filesystem vulnerability scanning against multiple CVE databases | dependencies |
| Schemathesis | [schemathesis/schemathesis](https://github.com/schemathesis/schemathesis) | MIT | Property-based API testing — auto-generates requests from OpenAPI/GraphQL schemas | dast |
| Syft / cdxgen | [anchore/syft](https://github.com/anchore/syft) / [CycloneDX/cdxgen](https://github.com/CycloneDX/cdxgen) | Apache-2.0 | SBOM generation — CycloneDX and SPDX software bill of materials | dependencies |
| ggshield | [GitGuardian/ggshield](https://github.com/GitGuardian/ggshield) | MIT | GitGuardian secret detection with 350+ detectors and policy-as-code | secrets |
| Scorecard | [ossf/scorecard](https://github.com/ossf/scorecard) | Apache-2.0 | OpenSSF Scorecard — supply chain security posture checks for open-source projects | dependencies |
| ship-safe | [nicepkg/ship-safe](https://github.com/nicepkg/ship-safe) | MIT | 22 AI security scanning agents for comprehensive pre-deployment checks | security |

### Milestone 3

| Tool | GitHub | License | Planned For | Category |
|------|--------|---------|-------------|----------|
| DeepTeam | [confident-ai/deepteam](https://github.com/confident-ai/deepteam) | Apache-2.0 | LLM red teaming — prompt injection, jailbreak, and adversarial input detection | ai-llm |
| Garak | [NVIDIA/garak](https://github.com/NVIDIA/garak) | Apache-2.0 | Automated LLM vulnerability fuzzing across hallucination, toxicity, and injection | ai-llm |
| KICS | [Checkmarx/kics](https://github.com/Checkmarx/kics) | Apache-2.0 | Infrastructure-as-Code security scanner (Terraform, Docker, Kubernetes, Ansible) | infrastructure |
| Prowler | [prowler-cloud/prowler](https://github.com/prowler-cloud/prowler) | Apache-2.0 | AWS/Azure/GCP cloud security posture management and CIS benchmarks | infrastructure |
| kube-bench | [aquasecurity/kube-bench](https://github.com/aquasecurity/kube-bench) | Apache-2.0 | CIS Kubernetes Benchmark compliance checks for cluster configurations | infrastructure |
| kubeaudit | [Shopify/kubeaudit](https://github.com/Shopify/kubeaudit) | MIT | Kubernetes manifest auditing — privilege escalation, capabilities, network policies | infrastructure |
| kube-hunter | [aquasecurity/kube-hunter](https://github.com/aquasecurity/kube-hunter) | Apache-2.0 | Kubernetes penetration testing — API server exposure, RBAC, secrets in etcd | infrastructure |
| Dockle | [goodwithtech/dockle](https://github.com/goodwithtech/dockle) | Apache-2.0 | Container image linting — CIS Docker Benchmark, best practices, sensitive files | infrastructure |
| SSLyze | [nabla-c0d3/sslyze](https://github.com/nabla-c0d3/sslyze) | AGPL-3.0 | Advanced TLS/SSL scanning — certificate transparency, OCSP stapling, cipher analysis | security |
| DefectDojo | [DefectDojo/django-DefectDojo](https://github.com/DefectDojo/django-DefectDojo) | BSD-3-Clause | Aggregating, deduplicating, and tracking findings across multiple scan runs | compliance |
| SQLMap | [sqlmapproject/sqlmap](https://github.com/sqlmapproject/sqlmap) | GPL-2.0 | Automated SQL injection detection and exploitation testing | dast |
| RESTler | [microsoft/restler-fuzzer](https://github.com/microsoft/restler-fuzzer) | MIT | Stateful REST API fuzzing — auto-generates sequences from OpenAPI specs | dast |
| Nikto | [sullo/nikto](https://github.com/sullo/nikto) | GPL-2.0 | Web server scanner — 7,000+ dangerous files/programs, outdated server versions | dast |
| Nmap | [nmap/nmap](https://github.com/nmap/nmap) | GPL-2.0 | Network discovery and security auditing — port scanning, service detection, OS fingerprinting | security |
| Subfinder | [projectdiscovery/subfinder](https://github.com/projectdiscovery/subfinder) | MIT | Subdomain discovery using passive sources for attack surface enumeration | security |
| Amass | [owasp-amass/amass](https://github.com/owasp-amass/amass) | Apache-2.0 | Attack surface management — DNS enumeration, network mapping, asset discovery | security |
| MobSF | [MobSF/Mobile-Security-Framework-MobSF](https://github.com/MobSF/Mobile-Security-Framework-MobSF) | GPL-3.0 | Mobile app security analysis — static and dynamic analysis for Android/iOS | security |
| Falco | [falcosecurity/falco](https://github.com/falcosecurity/falco) | Apache-2.0 | Runtime security monitoring — kernel-level syscall analysis, container threat detection | runtime |
| Lynis | [CISOfy/lynis](https://github.com/CISOfy/lynis) | GPL-3.0 | System hardening auditing — OS configuration, authentication, file permissions | infrastructure |
| ScoutSuite | [nccgroup/ScoutSuite](https://github.com/nccgroup/ScoutSuite) | GPL-2.0 | Multi-cloud security auditing (AWS/Azure/GCP) — referenced only due to GPL | infrastructure |

## Forked Skill Content (v0.18.0+, per-source attribution)

These upstream projects ship content that AEGIS forks selectively under permissive licenses. Each forked file carries a per-file `<!-- aegis-local: forked … -->` HTML attribution header pinning fork-date + upstream + 40-hex SHA. Per-source AEGIS-side modifications are documented in [`packages/skills/ATTRIBUTION.md`](packages/skills/ATTRIBUTION.md).

| Source | License | Fork-SHA | Used For |
|--------|---------|----------|----------|
| [SnailSploit/Claude-Red](https://github.com/SnailSploit/Claude-Red) | MIT | `c74d53e2…` (2026-04-23) | 37 offensive skills under `packages/skills/skills/offensive/snailsploit-fork/` (vuln-class checklists for SSRF, SQLi, XSS, RCE, etc.) |
| [elementalsouls upstream OSINT pack](https://github.com/elementalsouls/Claude-OSINT) | MIT | `ea42241d…` (2026-05-01) | NEW `osint/` skill category — `offensive-osint` (4168 lines: AI-key regex catalog, dorks, vendor fingerprints, identity-fabric, validators) + `osint-methodology` (1693 lines: 5-stage recon, asset-graph, breach correlation, email-security audit) under `packages/skills/skills/osint/elementalsouls-fork/` |
| [matty69v/Bug-Bounty-Agents](https://github.com/matty69v/Bug-Bounty-Agents) | MIT | `5f8b8301…` (2026-05-01) | 5 selective skills under `packages/skills/skills/offensive/matty-fork/` (cicd-redteam / cloud-security / container-escape / mobile-pentester / subdomain-takeover — gap-fillers for CI-CD / CSPM / k8s-breakout / Mobile / DNS-takeover) |
| [XSSNow upstream payload database](https://github.com/dr34mhacks/XSSNow) | MIT | `ce1d4ba6…` (2026-05-01) | 1017-payload XSS regression corpus at `packages/scanners/__tests__/fixtures/xss-payloads.yaml` (19 categories: WAF-bypass, polyglots, browser-quirks, csp-bypass) |

### Cite-only OSINT references (v0.18.0)

These curated awesome-lists were evaluated as augmentation candidates and surface tools / techniques operators may want beyond AEGIS' direct scanner coverage. Listed for cross-referencing; no code or content is forked.

| Source | License | Note |
|--------|---------|------|
| [jivoi/awesome-osint](https://github.com/jivoi/awesome-osint) | CC BY-SA 4.0 | ~1469-entry curated tool/resource directory — broader than AEGIS' web-app scanner scope (people / geospatial / maritime / threat-intel feeds). ShareAlike clause precludes fork into AEGIS' MIT codebase; cite-only. |
| [rawfilejson/awesome-osint-arsenal](https://github.com/rawfilejson/awesome-osint-arsenal) | MIT | ~1100-tool curated catalog. Niche augmentations (camera-dork queries / Telegram OSINT bot directory / Russian person-lookup catalog) plausible follow-ups. The repo's `install_osint_arsenal.sh` is NOT forked — risky `curl \| sudo bash` patterns + unsigned-binary downloads + offensive RAT/phishing-kit clones. |

### Rejected candidates (license-incompatible or absent)

| Source | License | Reason |
|--------|---------|--------|
| frangelbarrera/OSINT-BIBLE | GPL-3.0 | Copyleft incompatible with AEGIS MIT; pulling content would force AEGIS-wide relicense. SKIPPED. |
| AKCodez/hackingtool-plugin | MIT-by-README-only (no `LICENSE` file) | License asserted in README but no standalone `LICENSE` file at fork-SHA — too thin for direct code extraction. The preflight verdict-shape pattern (`ready` / `partial` / `blocked` + priority-ranked recommendations) was studied for inspiration of the planned F-DOCTOR-1 / F-PREFLIGHT-PATTERN-1 work but no code copied. Study-pattern only. |

## Referenced & Inspiration

These projects inspired AEGIS patterns, methodologies, or rule designs. No code was copied.

| Project | GitHub | License | What Inspired |
|---------|--------|---------|---------------|
| ship-safe | [nicepkg/ship-safe](https://github.com/nicepkg/ship-safe) | MIT | 22 AI scanning agent architecture, ConfigAuditor and AuthBypassAgent patterns for Docker, Next.js, Firebase, JWT, cookie security |
| VibeSafe | [voideditor/vibesafe](https://github.com/voideditor/vibesafe) | MIT | Entropy-based secret detection, AI-code quality patterns, vibe-check scanning philosophy |
| Trail of Bits Skills | [trailofbits/skills](https://github.com/trailofbits/skills) | CC-BY-SA-4.0 | Security audit methodology, formal verification patterns, smart contract review disciplines |
| claude-agents | [obelisk-complex/claude-agents](https://github.com/obelisk-complex/claude-agents) | GPL-3.0 | Multi-agent orchestration patterns, parallel scanner execution, agent skill composition |
| Penetration-Testing-Tools | [mgeeky/Penetration-Testing-Tools](https://github.com/mgeeky/Penetration-Testing-Tools) | MIT | Red team tooling patterns, payload generation approaches, evasion technique detection |
| ScoutSuite | [nccgroup/ScoutSuite](https://github.com/nccgroup/ScoutSuite) | GPL-2.0 | Multi-cloud security auditing methodology, rule organization patterns |
| GuardianAudits | [GuardianAudits/Audits](https://github.com/GuardianAudits/Audits) | MIT | Security audit report structure, finding severity classification, remediation patterns |
| DSGVO IT-Recht Skill | [patrickstigler/claude-skill-it-recht-dsgvo](https://github.com/patrickstigler/claude-skill-it-recht-dsgvo) | MIT | German IT-law compliance patterns — LG Muenchen I Google Fonts ruling (Az. 3 O 17493/20), TTDSG S25 cookie consent, TMG S5 / DDG Impressum |
| DSGVO Checklist | [philippkrabatsch-prog/claude-code-dsgvo-checklist](https://github.com/philippkrabatsch-prog/claude-code-dsgvo-checklist) | MIT | DSGVO compliance checklist structure, data processing inventory patterns, consent flow requirements |
| project-codeguard | [cosai-oasis/project-codeguard](https://github.com/cosai-oasis/project-codeguard) | Apache-2.0 | AI-generated code security benchmarking, LLM code review patterns, automated security scoring |
| Internal Security Suite | Private | Proprietary | Battle-tested patterns from 7 Red Team attack waves on production multi-tenant SaaS — 34 regression guards covering OWASP A01-A10, multi-tenant isolation, PII safety, encryption patterns |
| 0xSteph upstream pentest-ai-agents | [0xSteph/pentest-ai-agents](https://github.com/0xSteph/pentest-ai-agents) | MIT | DISCLAIMER.md three-block structure (authorization-forms / refusal-list / LLM data-flow advisory) — adapted into `packages/cli/src/active-mode-disclaimer.ts` under F-DISCLAIMER-2. No code copied; wording is AEGIS-original. |
| YogSec/Hacking-Tools | [yogsec/Hacking-Tools](https://github.com/yogsec/Hacking-Tools) | MIT | Pure curated awesome-list (~270 tools across 13 categories) — surfaced 16+ wrapper-candidate tools (WPScan / XSStrike / Bandit / Grype / ScoutSuite / Nikto / httpx) tracked under v0.18.x Tier-B F-targets. No code or content forked. |

## Custom AEGIS Scanners

Built from scratch by the AEGIS team, MIT licensed.

| Scanner | Category | Checks |
|---------|----------|--------|
| `auth-enforcer` | security | API routes missing authentication guards (secureApiRouteWithTenant, getServerSession, requireRole) |
| `crypto-auditor` | security | Weak cryptography (MD5/SHA-1), hardcoded secrets, eval() injection, JWT algorithm confusion, cookie flags, session secrets |
| `config-auditor` | security | Docker (unpinned images, ENV secrets, privileged), Next.js (wildcard domains, X-Powered-By), Firebase rules, .env exposure |
| `console-checker` | quality | Debug artifacts: console.log/debug, debugger statements, sensitive data in console.error, TODO/FIXME/HACK/XXX comments |
| `header-checker` | security | HTTP security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| `zod-enforcer` | security | Zod schemas missing .strict() on API input validation to reject unexpected fields |
| `rate-limit-checker` | security | Missing rate-limiting on authentication and sensitive API endpoints |
| `i18n-quality` | quality | i18n completeness: missing translations, hardcoded strings, locale file consistency |
| `gdpr-engine` | compliance | GDPR/DSGVO: privacy page, imprint, cookie consent, data export/deletion, PII safety, encryption, audit trail, consent table, Google Fonts CDN, external CDN IP transfer, YouTube embeds, newsletter double-opt-in, Impressum completeness |
| `entropy-scanner` | security | High-entropy string detection for leaked secrets using Shannon entropy analysis (VibeSafe-inspired) |
| `supply-chain` | dependencies | Dependency confusion attacks, typosquatting detection, malicious package patterns, missing lockfile integrity checks |

## Custom Semgrep Rules

| Rule File | Rules | Detects |
|-----------|-------|---------|
| `nextjs-auth.yml` | `aegis.nextjs-auth.missing-auth-guard` | Next.js API route handlers missing authentication guards |
| `supabase-rls.yml` | `aegis.supabase-rls.missing-tenant-filter`, `aegis.supabase-rls.service-role-in-client`, `aegis.supabase-rls.wildcard-select-sensitive-table` | Multi-tenant isolation: missing tenant_id filters, service_role in client code, wildcard SELECT on sensitive tables |
| `react-xss.yml` | `aegis.react-xss.dangerous-html-without-sanitize`, `aegis.react-xss.href-user-input-no-protocol-check`, `aegis.react-xss.document-write`, `aegis.react-xss.inner-html-assignment` | React XSS: unsanitized dangerouslySetInnerHTML, dynamic href without protocol validation, document.write, innerHTML |
| `zod-strict.yml` | `aegis.zod-strict.object-without-strict`, `aegis.zod-strict.record-unknown-or-any` | Zod strictness: missing .strict() on z.object, z.record with z.unknown/z.any |
| `weak-crypto.yml` | `aegis.weak-crypto.math-random-in-security-context`, `aegis.weak-crypto.weak-hash-algorithm`, `aegis.weak-crypto.sha256-for-token-generation`, `aegis.weak-crypto.hardcoded-api-key` | Weak cryptography: Math.random() in security context, MD5/SHA-1, plain SHA-256 without HMAC, hardcoded API keys |

## Runtime Dependencies

| Package | License | Used For |
|---------|---------|----------|
| Commander.js | MIT | CLI framework |
| chalk | MIT | Terminal colors |
| ora | MIT | Terminal spinners |
| Vitest | MIT | Testing |
| Turborepo | MIT | Monorepo build |
| pnpm | MIT | Package manager |
| TypeScript | Apache-2.0 | Language |

## License Compliance Note

- AGPL-licensed tools (TruffleHog [integrated], SSLyze [planned]) are invoked as external CLI processes, not linked as libraries
- GPL-licensed tools (Hadolint, testssl.sh, Nmap, Lynis, Nikto, SQLMap, MobSF) are invoked as external CLI processes
- CC-BY-SA-4.0 content (Trail of Bits Skills) inspired patterns only — no content copied
- GPL-3.0 agent definitions (claude-agents) inspired methodologies only — original implementations written
