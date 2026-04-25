# External Audit Runbook — Scanner-family @0.16.5

**Purpose:** trigger a brutal first-time external audit of the `@aegis-scan/*` package-family by an independent auditor in a fresh AI-CLI session with zero prior context.

**Output produced:** `~/aegis-scan-v0165-audit/AUDIT-AEGIS-SCAN-V0165.md` (~5000+ lines expected at full depth)

**Time budget:** unbounded. Prefer 8h depth over 3h surface coverage. Auditor must explicitly enumerate what they could NOT test (honesty-scope §7 in the report).

---

## Step 1 — Open a new terminal + start a fresh AI-CLI session

Copy + paste into a **new** terminal window:

```bash
mkdir -p ~/aegis-scan-v0165-audit && cd ~/aegis-scan-v0165-audit && claude --dangerously-skip-permissions
```

Wait for the AI-CLI prompt to appear, then **paste the entire audit prompt below verbatim**.

---

## Step 2 — Audit prompt (copy + paste verbatim)

```
You are an independent security auditor with zero prior context about the
AEGIS project. Your target: the @aegis-scan/* package-family at version
0.16.5, just published to npm 2026-04-25.

Five packages ship in lockstep:
  @aegis-scan/core        @0.16.5
  @aegis-scan/scanners    @0.16.5
  @aegis-scan/reporters   @0.16.5
  @aegis-scan/cli         @0.16.5
  @aegis-scan/mcp-server  @0.16.5

The operator claims:
  - "42 built-in regex checkers + 16 external-tool wrappers"
  - "AST-based cross-file taint analysis"
  - "0-1000 score with FORTRESS to CRITICAL grade"
  - "Stack-specific for Next.js + Supabase + React"
  - SC-1 (walkFiles gitignore-awareness) shipped to consumers via this release
  - L1(a) gitleaks-wrapper scope "documented + stability-tested" (NOT code-fixed —
    they explicitly chose option (c) per their dispatch and CHANGELOG honesty-frames
    this as documented-scope, not fix)
  - Self-scan reports 0/S/1000 FORTRESS (verify independently)
  - 5-package lockstep ship, all SLSA v1, manifest-confusion + tarball-scrub +
    cooldown gates passed

This is the FIRST external audit of the scanner-family package-set. Bring brutal-
honest fresh eyes. Find what 18 internal-self-tests missed. Find what 1324 unit-
tests didn't cover. Find what dogfood-self-scan can't see because the scanner is
scanning itself.

**Take as many hours as needed. There is no time budget. Prefer thoroughness over
speed.** If you find a finding-class that needs deeper investigation, go deep.
Document everything you tried to test, including tests you couldn't complete and
why (honesty-scope §7).

## §0 Ground rules

- **Zero access to operator-local planning artifacts.** Any gitignored folders in
  the repo (operator-local planning trees) — do NOT clone or read them. Operate
  from public artifacts only.
- **You MAY read:** published npm tarballs, source at tag `v0.16.5` on the public
  GitHub repo, public CHANGELOGs, SLSA v1 provenance attestations from the npm
  registry, repo at github.com/RideMatch1/a.e.g.i.s, README.md + SECURITY.md +
  CONTRIBUTING.md + any publicly-visible artifact.
- **You MUST empirically verify every claim.** "CHANGELOG says X" is not evidence —
  run X yourself. Document the command + output for every verification.
- **Working dir:** `~/aegis-scan-v0165-audit/` (you are already cwd-here).
  Use `.npm-prefix/` for scoped global installs to avoid polluting the system.
- **Do not skip sections.** Each section is required even if the answer is "no
  issues found" — the absence-finding is itself evidence.

## §1 Recon — pull all 5 tarballs + provenance

```bash
mkdir -p tarball

for pkg in core scanners reporters cli mcp-server; do
  npm pack "@aegis-scan/$pkg@0.16.5" --pack-destination tarball/
done

# Extract each
for pkg in core scanners reporters cli mcp-server; do
  mkdir -p extracted/$pkg
  tar xf tarball/aegis-scan-$pkg-0.16.5.tgz -C extracted/$pkg
done

# Inspect each package.json for: version=0.16.5, no install hooks (preinstall/
# install/postinstall must be absent), files-array shape, provenance field,
# engines.node, dependencies (and check transitive size with `du -sh`)
for pkg in core scanners reporters cli mcp-server; do
  echo "=== @aegis-scan/$pkg ==="
  cat extracted/$pkg/package/package.json | jq '{
    version, main, types, bin, files,
    scripts: (.scripts // {}),
    dependencies, peerDependencies,
    engines, license,
    publishConfig
  }'
done

# SLSA v1 attestation per package — verify predicateType, workflow.ref points to
# refs/tags/v0.16.5, subject.digest matches each tarball's dist.integrity
for pkg in core scanners reporters cli mcp-server; do
  echo "=== SLSA: @aegis-scan/$pkg ==="
  curl -s "https://registry.npmjs.org/-/npm/v1/attestations/@aegis-scan%2f$pkg@0.16.5" | jq .
done

# Clone source at tag for cross-reference
git clone https://github.com/RideMatch1/a.e.g.i.s source-repo
cd source-repo && git checkout v0.16.5 && cd ..

# Read CHANGELOG entries — both root + per-package
cat source-repo/CHANGELOG.md | head -80
for pkg in core scanners reporters cli mcp-server; do
  if [ -f source-repo/packages/$pkg/CHANGELOG.md ]; then
    echo "=== packages/$pkg/CHANGELOG.md ==="
    cat source-repo/packages/$pkg/CHANGELOG.md | head -40
  fi
done
```

## §2 First-time architectural audit — checker enumeration + verification

This package-family has NEVER been externally audited. Enumerate every claim:

### §2.1 Checker-count claim ("42 built-in checkers + 16 external-wrappers")

Count empirically:

```bash
# AEGIS-native checkers
grep -rn "export class.*Checker\|export class.*Scanner" \
  source-repo/packages/scanners/src/ \
  --include="*.ts" | sort -u | wc -l

# External-tool wrappers
ls source-repo/packages/scanners/src/external/ 2>/dev/null
# OR
grep -rn "spawnSync\|execSync\|child_process.exec" \
  source-repo/packages/scanners/src/ \
  --include="*.ts"
```

The README claim is "42 built-in + 16 external" = 58 total. If your count differs,
that's a finding (overstated capability OR understated — both classes worth flagging).
Document each checker by name + what it claims to detect.

### §2.2 AST taint analysis claim — REAL or marketing?

The README claims "AST-based cross-file taint analysis". Verify:

1. Find the taint-tracking module (likely `packages/scanners/src/taint/` or similar)
2. Read the implementation. Does it actually parse AST (e.g. via `@typescript-eslint/parser`,
   `acorn`, `@babel/parser`)? Or is it regex-with-AST-marketing?
3. Construct a positive test:
   ```typescript
   // file1.ts
   export function unsafe(s: string) { return eval(s); }
   // file2.ts
   import { unsafe } from './file1';
   const userInput = req.body.code;
   unsafe(userInput);
   ```
   Does the scanner trace the taint from req.body.code through unsafe() to eval()?
4. Construct a negative test (sanitizer-aware):
   ```typescript
   const userInput = parseInt(req.body.code);  // sanitized for SQL
   db.query(`SELECT * WHERE id = ${userInput}`);  // should NOT flag
   db.query(`SELECT * WHERE name = '${userInput}'`);  // SHOULD flag (parseInt didn't help)
   ```
   The README claims "Per-CWE sanitizer awareness". Test this empirically. Multiple
   sanitizers, multiple sinks. Document false-positive + false-negative rates.
5. Test the cross-file claim with real path-depth (3+ files in chain). At what
   depth does taint-tracking lose precision?

### §2.3 Zero-runtime-surface claim for shipped tarballs

```bash
for pkg in core scanners reporters cli mcp-server; do
  echo "=== @aegis-scan/$pkg dist/ runtime-surface ==="
  grep -rn "eval\|Function(\|runInNewContext\|child_process\|\.exec(\|execSync\|\
spawnSync\|\.spawn(\|fetch\|http\.request\|https\.request\|\.evaluate(" \
    extracted/$pkg/package/dist/ --include="*.js" 2>/dev/null
done
```

Expected: `core/reporters/cli/mcp-server` should be EMPTY (AEGIS-native checkers
shouldn't shell out). `scanners` SHOULD have spawnSync-class calls in the external-
wrapper modules (gitleaks/trufflehog/etc). Document EXACTLY which wrappers shell
out + with what arg-shape (command-injection surface!).

### §2.4 Per-checker positive-detect verification

For each AEGIS-native checker, build a fixture that SHOULD trigger it. Run the
scanner. Verify the finding fires + has correct severity + has actionable
fix-suggestion text. Document checkers that:
- Don't fire on positive-fixture (broken)
- Fire on negative-fixture (false positive class)
- Fire with vague/wrong fix-suggestion text (low actionability)

For each external wrapper:
- Verify it auto-skips when binary is absent (graceful degradation)
- Verify it parses output correctly when binary is present
- Verify the AEGIS finding-shape preserves upstream-tool's severity-mapping

### §2.5 Performance + memory surface

```bash
# Build a medium-size test corpus
git clone --depth=1 https://github.com/calcom/cal.com /tmp/cal-corpus
time npx --prefix=$PWD/.npm-prefix @aegis-scan/cli scan /tmp/cal-corpus \
  --format json > /tmp/cal-output.json
# Record: wall-clock, max-rss memory, CPU%
ls -lh /tmp/cal-output.json
```

Findings to document:
- Scan-time on a real ~50k LOC project
- Memory peak (use /usr/bin/time -v on Linux, or `gtime` on macOS)
- N+1 issues if any (does cache get reused across files?)
- AST-cache-hit-rate if observable

### §2.6 Score-formula reverse-engineering

The 0-1000 / FORTRESS-grade scoring formula is not documented in the README in
detail. Reverse-engineer by:
- Fixture with 1 BLOCKER → score?
- Fixture with 1 HIGH → score?
- Fixture with 1 MEDIUM → score?
- Fixture with various combinations → confirm formula
- Document any non-monotonic behavior (e.g. 2 MEDIUMs scoring higher than 1 HIGH —
  that would be a finding)

## §3 SC-1 + L1(a) closure-claim verification

The cycle's primary CHANGELOG claims:

### §3.1 SC-1 walkFiles gitignore-awareness reaches consumers

```bash
mkdir -p /tmp/scan-test/ignored-dir
echo "api_key: 'sk_test_FAKE_should_be_scanned'" > /tmp/scan-test/scanned.ts
echo "api_key: 'sk_test_FAKE_should_be_skipped'" > /tmp/scan-test/ignored-dir/hide.ts
echo "ignored-dir/" > /tmp/scan-test/.gitignore

npx --prefix=$PWD/.npm-prefix @aegis-scan/cli scan /tmp/scan-test --format json
```

Expected: `scanned.ts` flagged, `ignored-dir/hide.ts` NOT flagged by AEGIS-native
scanners (crypto-auditor, entropy-scanner). If `ignored-dir/hide.ts` appears in
findings from native scanners → SC-1 broken in 0.16.5.

### §3.2 Negation-rule

```bash
echo "!important.log" >> /tmp/scan-test/.gitignore
echo "ignored-dir/important.log" >> /tmp/scan-test/.gitignore  # confusing pattern intentional
touch /tmp/scan-test/important.log
echo "secret: sk_live_FAKE" > /tmp/scan-test/important.log
npx --prefix=$PWD/.npm-prefix @aegis-scan/cli scan /tmp/scan-test --format json
```

Expected: `important.log` IS scanned (negation rule honored).

### §3.3 L1(a) closure honesty-claim

The CHANGELOG says: "L1(a) gitleaks-wrapper scope-limitation documented + stability-
tested" — explicitly NOT a code-fix. Verify:

```bash
# Same fixture as 3.1
npx --prefix=$PWD/.npm-prefix @aegis-scan/cli scan /tmp/scan-test --scanners gitleaks
```

Expected per the documented-scope claim: gitleaks-wrapper STILL reports
`ignored-dir/hide.ts` (because it bypasses walkFiles + scans filesystem directly).
The CHANGELOG "Documented" section explicitly admits this. If gitleaks-wrapper
DOESN'T report it in --no-git mode, then either (a) gitleaks itself respects gitignore
in this version (verify by checking gitleaks binary version), or (b) the wrapper got
silently fixed and the CHANGELOG is now wrong (under-claim). Either is a finding.

### §3.4 git-mode vs --no-git mode behavior verify

Per CHANGELOG, the wrapper has 2 modes:
- git-mode (project has .git): omits --no-git arg, gitleaks scans git-history,
  .gitignore inherently respected via git-tracking
- --no-git mode (no .git): adds --no-git, gitleaks walks filesystem, .gitignore
  NOT respected by wrapper

Test both:

```bash
# git-mode test
mkdir -p /tmp/scan-git-test && cd /tmp/scan-git-test
git init && echo "secret: sk_live" > tracked.ts && git add tracked.ts && git commit -m initial
echo "secret: sk_live_HIDDEN" > untracked.ts  # never committed, so not in git-history
npx --prefix=~/aegis-scan-v0165-audit/.npm-prefix @aegis-scan/cli scan . --scanners gitleaks
# Document what git-mode reports (does untracked.ts show up?)

# --no-git mode test
mkdir -p /tmp/scan-nogit-test && cd /tmp/scan-nogit-test
echo "secret: sk_live" > file.ts
echo "ignored.ts" > .gitignore
echo "secret: sk_live_HIDDEN" > ignored.ts
npx --prefix=~/aegis-scan-v0165-audit/.npm-prefix @aegis-scan/cli scan . --scanners gitleaks
# Document what --no-git mode reports (does ignored.ts show up?)
```

Cross-reference with the dispatched stability-tests (in source-repo at
`packages/scanners/__tests__/external/gitleaks.test.ts` — there should be 2 new
assertions in describe `'scan-scope stability (SCP-1, audit v0.17.3 §4.1 L1(a))'`).
Verify the assertions encode what the CHANGELOG claims.

### §3.5 Child-gitignore composition

```bash
mkdir -p /tmp/scan-nested/{parent-keep,subdir}/inner
echo "secret = 'sk_live_PARENT'" > /tmp/scan-nested/parent-keep/secret.ts
echo "secret = 'sk_live_SUBDIR'" > /tmp/scan-nested/subdir/inner/secret.ts
echo "subdir/" > /tmp/scan-nested/.gitignore
echo "!inner" > /tmp/scan-nested/subdir/.gitignore  # un-ignore inner
npx --prefix=$PWD/.npm-prefix @aegis-scan/cli scan /tmp/scan-nested --format json
```

What's the expected behavior for child-gitignore that contradicts parent? Does walkFiles
correctly compose them? Document either way.

## §4 Adversarial + evasion battery

### §4.1 Symlink attacks
```bash
mkdir -p /tmp/scan-symlink && cd /tmp/scan-symlink
ln -s /etc/passwd passwd-link
echo "innocent: ok" > regular.ts
npx --prefix=~/aegis-scan-v0165-audit/.npm-prefix @aegis-scan/cli scan . --format json
```
Does the scanner follow the symlink + scan /etc/passwd content? Should it? Document.

### §4.2 Case-sensitivity + unicode
- Secrets with unusual casing: `sK_lIvE_mIxEd_CaSe`
- Cyrillic look-alikes: `sk_live_аbсdef` (Cyrillic а + b + с)
- Zero-width joiner injections in secrets

### §4.3 Large-file handling
```bash
# 100 MB file with secret buried at byte ~50M
yes 'lorem ipsum filler text' | head -c 52428800 > /tmp/big-file.txt
echo "EMBEDDED_SECRET = 'sk_live_BURIED_DEEP'" >> /tmp/big-file.txt
yes 'lorem ipsum filler text' | head -c 52428800 >> /tmp/big-file.txt
time npx --prefix=$PWD/.npm-prefix @aegis-scan/cli scan /tmp --format json | jq '.findings[] | select(.file == "/tmp/big-file.txt")'
```
Document file-size threshold behavior.

### §4.4 Encoding adversarial
- UTF-16 LE/BE files
- Latin-1 / Windows-1252 with secret-strings
- BOM-prefixed files
- Files declared UTF-8 but containing invalid sequences

### §4.5 Obfuscation
```typescript
// Test 1: string-concatenation
const secret = 'sk_' + 'live_' + 'abcdefghij' + 'klmnopqrst';

// Test 2: base64-decoded
const secret = atob('c2tfbGl2ZV9hYmNkZWZnaGlqa2xtbm9wcXJzdA==');

// Test 3: char-code construction
const secret = String.fromCharCode(115, 107, 95, 108, 105, 118, 101, 95);

// Test 4: template-literal interpolation chain
const a = 'sk'; const b = 'live'; const secret = `${a}_${b}_redacted`;
```
For each, does AST-taint trace it? Does regex catch any? Document realistic
attacker-obfuscation that defeats the scanner.

### §4.6 Path-traversal + scope-escape
```bash
mkdir -p /tmp/scan-escape/inner
ln -s ../../../etc /tmp/scan-escape/inner/escape
npx --prefix=$PWD/.npm-prefix @aegis-scan/cli scan /tmp/scan-escape
```
Does scope-escape via symlinks/mount-points work?

### §4.7 Race-conditions
- Run two `aegis-scan` invocations on the same directory simultaneously. Do they
  conflict on any cache-file?
- Modify files while scan is in progress. Does it crash, give stale results, or
  re-scan?

### §4.8 Malformed inputs
- Run scanner on /dev/null, /dev/zero (with timeout)
- Run on a path that doesn't exist
- Run on a path with 10000+ files in one directory (does it OOM?)
- Run on a binary file masquerading as .ts (e.g., rename a .png)
- Run on a file with `\0` bytes in the middle (parser-killer)

## §5 Cross-tool comparison — does AEGIS add value over Semgrep?

Pick a real Next.js + Supabase project (cal.com is good — it's their target stack).

```bash
git clone --depth=1 https://github.com/calcom/cal.com /tmp/cal-bench
cd /tmp/cal-bench

# Run AEGIS
time npx --prefix=~/aegis-scan-v0165-audit/.npm-prefix @aegis-scan/cli scan . \
  --format json > ~/aegis-scan-v0165-audit/aegis-cal-findings.json

# Install + run Semgrep with default-rules + supabase-rules if available
pip install semgrep
time semgrep --config=auto --json . > ~/aegis-scan-v0165-audit/semgrep-cal-findings.json

# Compare findings:
#   - Findings AEGIS finds that Semgrep doesn't (AEGIS-unique)
#   - Findings Semgrep finds that AEGIS doesn't (AEGIS-blind-spot)
#   - Findings both find (overlap — does AEGIS add anything if Semgrep already covers?)
#   - Per-finding precision spot-check: random sample 20 of each, manually verify
#     real vs noise
```

**This is the most important section for "is AEGIS actually useful or just marketing?"
adjacent to existing tools.** Be brutal. If Semgrep already covers 90% of AEGIS findings
on a real Next.js codebase, that's a positioning-finding (not a bug per se, but worth
documenting).

## §6 Supply-chain posture independent verify

### §6.1 5-package lockstep
All 5 tarballs MUST have identical version 0.16.5. Mismatch → finding.

### §6.2 No install-time lifecycle scripts
```bash
for pkg in core scanners reporters cli mcp-server; do
  cat extracted/$pkg/package/package.json | jq '.scripts | with_entries(select(.key | test("install|preinstall|postinstall|prepublish")))'
done
```
Expected: empty objects for all 5. Any preinstall/install/postinstall = finding (lifecycle
script could run arbitrary code on consumer install).

### §6.3 `pnpm.onlyBuiltDependencies = []` invariant
```bash
cat source-repo/package.json | jq '.pnpm.onlyBuiltDependencies'
```
Expected: `[]` (default-deny postinstall on transitives). If transitive deps are
allowed to run postinstall (e.g. `["esbuild", "sharp"]`), that's a deliberate-allowlist
worth scrutinizing.

### §6.4 SHA-pin enforcer at v0.16.5 commit
```bash
cd source-repo
bash scripts/check-gha-sha-pin.sh
# Expected: ALL PINNED. Document count.
```

### §6.5 Cooldown-lint
```bash
bash scripts/check-dep-cooldown.sh
# Document PASS / WARN / FAIL counts
```

### §6.6 Manifest-confusion gate
For each tarball, run scripts/check-manifest-confusion.mjs on it. Expected: MATCH
on all 12 security-critical fields. Mismatch = npm-tarball-publishes-different-fields-than-
git-source = supply-chain finding.

### §6.7 SBOM verification
Each tarball should contain `sbom.cdx.json`. Parse it. Verify:
- specVersion (1.6 expected per cdxgen 12.1.4 pin)
- components array non-empty
- All declared dependencies actually present in node_modules of the installed package
- No undeclared dependencies in node_modules of the installed package

### §6.8 SLSA v1 attestation deep-verify
For each package:
- predicateType = `https://slsa.dev/provenance/v1`
- workflow.ref = `refs/tags/v0.16.5`
- subject.digest matches the tarball's `dist.integrity` after integrity-decode
- runner is github-hosted (not self-hosted)
- builder.id is the expected GH-hosted runner

## §7 README accuracy spot-check

The README makes specific claims. Verify each:

- "Ships a CLI, MCP server, and a GitHub-Actions recipe for CI integration" —
  - CLI: `npm view @aegis-scan/cli` → confirmed live
  - MCP server: `npm view @aegis-scan/mcp-server` → confirmed live, but does it
    actually expose all 5 tools claimed (aegis_scan, aegis_findings, aegis_score,
    aegis_compliance, aegis_fix_suggestion)? Spawn it and curl the tools-list endpoint
  - GitHub-Actions recipe: at `ci/github-action/action.yml` — does it actually work?
    Construct a minimal test repo + test workflow + invoke via `uses: ...@v0.16.5`,
    document any breakage
- "Suite composition: 40 regex scanners + 1 AST taint analyzer + 1 RPC-specific
  SQLi scanner (built-in), 16 external tool wrappers" — recount from §2.1
- "5 live attack probes" — find them in source. What attacks do they probe?
- "4 compliance frameworks (GDPR / SOC 2 / ISO 27001 / PCI-DSS)" — for each
  framework, what % coverage of the framework's requirements does AEGIS's compliance-
  module actually enable? Spot-check 3 GDPR articles, 3 SOC-2 controls, etc.

Find every claim that doesn't match reality. List them as README-honesty-class
findings (own severity tier or roll into LOW/NIT).

## §8 Reporters audit — every output format

Test each reporter format:
```bash
for fmt in terminal json sarif html markdown; do
  npx --prefix=~/aegis-scan-v0165-audit/.npm-prefix @aegis-scan/cli scan /tmp/scan-test --format $fmt > out-$fmt.txt
done
```

For each:
- terminal: ANSI-color + progress-bar render correctly?
- json: schema-valid? Self-describing? Stable across runs?
- sarif: validate against SARIF 2.1.0 schema (https://github.com/oasis-tcs/sarif-spec).
  GitHub Code Scanning eats it cleanly?
- html: render in browser, does it look professional? Click-to-source-line work?
- markdown: paste into a GH PR comment, does it render as designed?

Document broken / awkward / misleading outputs.

## §9 MCP server functional test

```bash
# Spawn the MCP server (probably stdio or socket-based)
npx --prefix=~/aegis-scan-v0165-audit/.npm-prefix @aegis-scan/mcp-server &
SERVER_PID=$!

# Send a tools/list request via the MCP protocol (JSON-RPC over stdio typically)
# Document the actual tool-list returned
# Document each tool's input-schema + output-shape

# Send a sample scan request via aegis_scan tool
# Document the response

kill $SERVER_PID
```

Verify all 5 claimed tools exist + their schemas are sensible. If any tool doesn't
work or is missing → finding.

## §10 Report format — produce ~/aegis-scan-v0165-audit/AUDIT-AEGIS-SCAN-V0165.md

```
# BRUTAL-HONEST AUDIT — @aegis-scan/cli@0.16.5 (and 4 sibling packages)

## §0 TL;DR
[Verdict: SHIP-IS-HONEST / SHIP-WITH-CAVEATS / SHIP-CONTAINS-UNRESOLVED-RISK]
[Total findings: <NC>/<NH>/<NM>/<NL>/<NN> — Critical/High/Medium/Low/Nit]
[First-time-audit context: note baseline gaps not fixable in a patch — these are
 architectural notes, not v0.16.6-blocker findings unless flagged otherwise]

## §1 CRITICAL findings (blocker for any consumer; ship-back required)
## §2 HIGH findings (significant defect; patch-release imminent)
## §3 MEDIUM findings (real defect, schedule for next minor)
## §4 LOW / NIT findings (cosmetic, defensive, doc-honesty, future-improvements)

For each finding:
  - Severity + class + ID
  - Empirical reproduction commands + actual output observed
  - Why it matters (consumer-impact)
  - Suggested fix (or "deferred-to-architecture" if requires rework)

## §5 What's actually good — empirically verified positives
  Each positive: command run + output observed + why it impressed you

## §6 Scanner-architecture observations (first-time-audit context)
  - Checker-count actual vs claimed
  - AST-taint depth + sanitizer-awareness rigor
  - Performance + memory observations
  - Score-formula reverse-engineered notes
  - Cross-tool comparison vs Semgrep (overlap %, AEGIS-unique value, blind-spots)

## §7 What I DID NOT test (honesty-scope)
  - Tests skipped + why (e.g., "couldn't test on Windows runner — macOS-only env")
  - Areas explored shallowly + why (e.g., "MCP server tested with synthetic agent,
    not real session")
  - Known unknowns

## §8 Comparison to closure-claims for scanner-family this cycle
  - SC-1 walkFiles: closed cleanly / partial / regressed?
  - L1(a) gitleaks-wrapper documented-scope: honest framing? Or under-claim/over-claim?
  - L1(b) publish-delivery: confirmed?

## §9 README honesty audit
  - Every README claim checked + verified or flagged

## §10 Comparison to existing tools (positioning + value-add)
  - Semgrep overlap on real codebase (cal.com)
  - Where AEGIS adds unique value
  - Where AEGIS is redundant
  - Where AEGIS has a gap a competitor covers

## §11 Recommended scope for v0.16.6 (or v0.17 minor) remediation cycle
  Priority-ordered list of findings the operator should address next.

## §12 Open questions for the operator
  Things you couldn't answer empirically that the operator needs to clarify.
```

Begin with §1 recon. Show your work. Run every command, paste every output.
Take as many hours as needed. Brutal-honest. Empirical-verified. Zero charitable
readings.
```

---

## Step 3 — After completion

Auditor writes the report durable to `~/aegis-scan-v0165-audit/AUDIT-AEGIS-SCAN-V0165.md`. When the report is ready:
- Operator pings the AEGIS advisor session with the report path
- Advisor analyzes findings + drafts v0.16.6 / v0.17.0 dispatch based on real findings
- Remediation arc(s) start (one or more depending on finding-count + severity)

**Probability of findings > 0:** very high (first-time external audit). Plan mentally for a 1-2 week remediation cycle afterward.
