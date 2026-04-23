# Security Incident Response Runbook

This runbook guides coordinated response to a suspected or confirmed
compromise of the AEGIS supply chain. It is designed for the current
maintainer bus-factor (single-maintainer project) and favors
conservative containment over aggressive remediation.

Companion documents:
- [`SECURITY.md`](SECURITY.md) — disclosure policy and supply-chain
  integrity invariants
- [GitHub Security Advisory draft flow](https://github.com/RideMatch1/a.e.g.i.s/security/advisories/new)

---

## 1. Detection triggers

Any one of the following should initiate this runbook:

- User report of unexpected install-time behavior from any
  `@aegis-scan/*` or `@aegis-wizard/*` package
- Unexpected version of a shipped package appears on the npm registry
  (caught by the npm version-watch cron or by manual `npm view`)
- GitHub Dependabot alert flagging an AEGIS package itself
- Automated alert from secret-scanning (GitHub native, or gitleaks)
  showing a credential leak in the repo
- Third-party public disclosure naming AEGIS in a compromise report
- Maintainer notices workflow runs outside normal hours or with
  unexpected actors in the GitHub audit log
- Any indication that `NPM_TOKEN`, `NPM_TOKEN_WIZARD`, or a signing
  key has been exposed outside its intended environment

**If in doubt, trigger this runbook.** A false alarm costs an hour;
a missed compromise costs users.

## 2. Containment — within 1 hour of detection

Priority: stop further damage. Correctness comes later.

### 2.1 Rotate all credentials immediately

On the npm dashboard at `https://www.npmjs.com/settings/<account>/tokens`:

1. Generate new granular access tokens — one per scope
   (`@aegis-scan`, `@aegis-wizard`), 30-day expiry, scope-only
   permissions
2. Update GitHub Actions secrets via `gh secret set NPM_TOKEN` and
   `gh secret set NPM_TOKEN_WIZARD` — pipe the new token via stdin
3. Delete the old tokens from the npm dashboard so a stolen copy
   becomes useless

If a GitHub Personal Access Token is suspected:

1. Revoke all PATs under the affected account at
   `https://github.com/settings/tokens`
2. Re-enroll 2FA with a fresh hardware key if the compromise may
   have included the 2FA factor
3. Rotate SSH keys under `https://github.com/settings/keys` and
   invalidate known_hosts entries on untrusted machines

### 2.2 Deprecate the compromised version on npm

For each suspected-compromised package version:

```
npm deprecate '<pkg>@<version>' \
  'SECURITY: version has been deprecated pending investigation. \
   Do not install. See GH-ADVISORY-<id> for details.'
```

**Do not `npm unpublish`.** Unpublish removes the audit trail and is
only permitted within 72 hours of publish. Deprecation is reversible,
preserves the version in the dependency graph, and signals the
security status to downstream tooling.

### 2.3 Pause further publishes

Temporarily disable the publish workflows to prevent accidental
re-publish during investigation:

1. Rename `.github/workflows/publish.yml` and
   `.github/workflows/publish-wizard.yml` to `.disabled` suffixes
2. Commit with message noting the pause
3. Revert after remediation completes and GO-to-ship is re-approved

### 2.4 Draft a private GitHub Security Advisory

At `https://github.com/RideMatch1/a.e.g.i.s/security/advisories/new`:

- Title: `<pkg>@<versions> — <one-line compromise description>`
- Severity: start at Critical, downgrade after investigation if warranted
- Ecosystem: npm
- Affected versions: the specific range under suspicion
- Status: Draft (not public yet)

Publishing happens in step 4 coordinated with the fix.

## 3. Investigation — within 24 hours of detection

Priority: establish scope. What was compromised, when, how, and how many
users are affected.

### 3.1 Verify attestation on all live versions

```
for pkg in core scanners reporters cli mcp-server; do
  npm view "@aegis-scan/$pkg" versions --json | \
    jq -r '.[]' | \
    while read v; do
      attest=$(npm view "@aegis-scan/$pkg@$v" dist.attestations.provenance.predicateType 2>/dev/null)
      if [ "$attest" != "https://slsa.dev/provenance/v1" ]; then
        echo "MISSING OR WRONG ATTESTATION: @aegis-scan/$pkg@$v ($attest)"
      fi
    done
done
```

Any version lacking the expected SLSA v1 attestation is suspect.

### 3.2 Diff known-good tarball hashes

For each version since the last known-clean baseline, compute the
tarball shasum and compare against:

- The hash recorded at publish time (in the GHA workflow run logs)
- The hash recorded in the GitHub release (if any)
- The current hash visible via `npm view <pkg>@<version> dist.shasum`

A mismatch between the publish-time hash and the currently-served
hash indicates registry-level tamper.

### 3.3 Review git history for injected commits

```
git log --all --since="<last-known-clean-date>" --pretty=format:'%h %G? %an %s'
```

For each commit:

- `%G?` = `G` means GPG-signed and verified, `N` means unsigned
- Verify the committer identity matches an expected maintainer
- Diff the commit to confirm it's the expected change

Unsigned or unexpected-author commits since the baseline date are suspect.

### 3.4 Review the GitHub Actions audit log

At `https://github.com/RideMatch1/a.e.g.i.s/settings/actions/runners`
and the repo Actions tab:

- Any workflow runs outside the maintainer's typical activity hours
- Any runs triggered by actors other than the maintainer
- Any runs that modified secrets or workflow files

### 3.5 Document findings

In the draft Security Advisory:

- Affected package + exact versions
- Compromise mechanism (if identified)
- Detection timeline
- User impact assessment (what was exfiltrated, what was injected)
- Remediation plan

## 4. Remediation — within 72 hours of detection

Priority: ship a clean replacement and publicly disclose.

### 4.1 Publish a patched version

1. On a fresh clean branch from the last known-good commit
2. Apply the minimum necessary fix to close the compromise vector
3. Bump the patch version (e.g., 0.17.0 → 0.17.1)
4. Review the diff one final time
5. Merge via PR (require signed commit, require CI green)
6. Tag and publish through the standard release flow

### 4.2 Advance dist-tag latest to the patched version

```
npm dist-tag add <pkg>@<patched-version> latest
```

Do not simply move `latest` away from the compromised version without
a patched replacement — users pinning to `latest` need a safe target.

### 4.3 Publish the Security Advisory publicly

From the draft in step 2.4:

1. Finalize severity and CVSS score
2. Fill the affected-versions range
3. Document the mitigation (upgrade to patched version)
4. Include the CVE identifier if one has been assigned
5. Publish

GitHub automatically notifies Dependabot users on affected versions.

### 4.4 Notify known direct consumers if identifiable

If the compromise affects private/commercial consumers (tracked via
support emails or known integrations), notify them directly with:

- Affected version range
- Exploitation indicators they can check locally
- Upgrade instructions
- Offer of direct support during mitigation

## 5. Post-mortem — within 7 days of detection

Priority: learn, improve, and be transparent.

### 5.1 Write a public incident report

Location: `SECURITY-INCIDENTS/<YYYY-MM-DD>-<short-name>.md` in the repo.

Required sections:

- Timeline (detection, triage, containment, remediation, disclosure)
- Root cause analysis
- User impact (confirmed vs. hypothetical)
- What went right
- What went wrong
- Changes made to prevent recurrence

### 5.2 Update this runbook

Any gap discovered during the incident becomes a new step here.

### 5.3 Update the fortress plan

In `aegis-precision/v017-supply-chain-fortress-plan.md`, add any new
defense layer identified. Schedule the v0.17.x or v0.18 work that
implements it.

### 5.4 Re-verify supply-chain posture end-to-end

Run the full post-ship verification from the v0.17.0 ship run:

- SLSA attestations on all live versions
- `npm audit` zero CVEs
- `npm audit signatures` all packages verified
- No install-time lifecycle scripts on any published version
- Fresh-install smoke from the patched version
- Full monorepo test suite passes
- Self-scan reports 1000/A/0

Only after this end-to-end is clean is the project considered
recovered.

---

## Contact channels

- Private disclosure: the GitHub Security Advisory flow at
  `https://github.com/RideMatch1/a.e.g.i.s/security/advisories/new`
- Direct contact: the maintainer email listed in `SECURITY.md`

## Roles

Solo-maintainer project: the maintainer runs every step of this
runbook. When the team grows beyond one, update this section with
role assignments.
