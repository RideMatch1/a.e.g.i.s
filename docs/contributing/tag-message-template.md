# AEGIS release-tag message template

Canonical structure for every `git tag -s` message in the AEGIS repo.
Prevents commit-count literal-mismatch at audit-time (v0.17.3 audit §4.2
observed: `git log wizard-v0.17.2..wizard-v0.17.3 --oneline | wc -l`
returned 13 but tag-message claimed "12 total atomic commits"; the +1
was a post-ship baseline-PR legitimately in the arc-range).

## Template

```
AEGIS <package-family> v<version> — <one-line-theme>

<brief-narrative-paragraph describing the arc's value prop>

Arc commits (git log <prev-tag>..<this-tag> --oneline = <N> total):
  - <sub-list-of-commits-or-sub-arcs>

<optional: Closes <audit-findings / planned-items>.>
```

## Discipline rules (MANDATORY)

### Rule 1 — Literal count match

Always compute `git log <prev-tag>..<this-tag> --oneline | wc -l` FIRST.
Use that literal count as the primary `N total` claim. Include EVERY
commit in the range (baseline-PRs, hotfixes, cross-namespace releases,
etc. — not just the primary arc).

### Rule 2 — Sub-count disclosure

When a commit-body or tag-message enumerates sub-counts within the arc
(e.g., "3 headings + 2 prose surfaces + 2 newly-fixed + 2 consciously-
literal"), the sub-counts MUST:

- Sum to the claimed total, OR
- The total MUST be explicitly labeled as a different count-dimension
  (e.g., "6 surface-classes" distinct from "9 sub-items within those
  classes").

Prevents narrative arithmetic-ambiguity — a class of imprecision that
an auditor could flag as a literal-count-mismatch under strict reading.
Introduced after WB-1 advisor R-audit §5.7 (v0.17.4) noted the class;
codified here as canonical rule.

### Rule 3 — Range-breakdown qualifier (for multi-namespace cycles)

When `<prev-tag>..<this-tag>` spans multiple release-namespaces (e.g.,
scanner-family `v0.16.4..v0.16.5` spans `wizard-v0.17.0..3` + `skills-
v0.1.0..1` cycles which shipped on their own namespaced tags), the
tag-message MUST:

1. State the literal `N total` count unchanged (no omission).
2. Break down as:
   - `Primary-arc this release (X commits): <list>`
   - `Published-elsewhere this range (Y commits): <list>`
   with `X + Y = N`.
3. Clarify that the `Y` commits are structurally in git-history but
   shipped on separate namespaced tags and don't change this release's
   package(s).

Precedent: `v0.16.5` tag-message (2026-04-25) used this breakdown for
`v0.16.4..v0.16.5 = 114 total` (2 scanner-family-primary + 112 wizard-
cli + skills + supply-chain-hardening shipped-elsewhere).

## Examples

### Wizard single-package release

```
AEGIS Wizard v0.17.4 — H3 final-closure + L2 template-adoption

Closes the 1 medium + 1 low finding from AUDIT-V0173 external audit.
H3 partial-regression (3rd cycle) closed in 1 shot via exhaustive-
grep discipline per amended advisor-memory.

Arc commits (git log wizard-v0.17.3..wizard-v0.17.4 --oneline = 3 total):
  - WB-1 H3 final-closure (exhaustive-grep discipline)
  - WB-2 L2 canonical tag-message template adoption
  - WB-3 version-bump + CHANGELOG

Companion release this cycle: @aegis-scan/*@0.16.5 shipped hours
earlier via v0.16.5 tag carrying SC-1 + L1(a) to scanner consumers.

Closes audit v0.17.3 §3.1 M + §4.2 L. §4.1 L1(a)+L1(b) closed by
v0.16.5 publish earlier this cycle. §4.3 L closed by inclusion.
```

### Scanner-family matrix release (multi-namespace range precedent)

```
AEGIS scan-family v0.16.5 — SC-1 publish + L1(a) gitleaks-wrapper scope-documentation

Ships v0.17.3 SC-1 walkFiles gitignore-awareness to scanner-consumers
(delayed 1 cycle because scanner-family did not republish in v0.17.3).
Closes L1(a) from v0.17.3 audit §4.1 via documented-scope + stability
tests for the gitleaks external-wrapper; code-fix deferred to v0.18
scan-root-composition arc per dispatch D4 empirical-off-ramp.

Arc commits (git log v0.16.4..v0.16.5 --oneline = 114 total):

  Scanner-family-primary this release (2 commits):
    - SCP-1  a54f4dc  test(scanners): codify gitleaks-wrapper scan-
                      scope stability (audit v0.17.3 §4.1 L1(a))
    - SCP-2  df19890  chore(release): 5-package lockstep version-bump
                      + CHANGELOG.md root [0.16.5] entry

  Published-elsewhere this range (112 commits):
    - wizard-v0.17.0..3 (4 wizard-cli releases on wizard-v* tags)
    - skills-v0.1.0..1 (2 skills releases on skills-v* tags)
    - supply-chain hardening cycles (Node-24 Sub-arc A + B, SLSA + SBOM
      + gitleaks-hotfix, manifest-confusion, cooldown-lint)

Closes audit v0.17.3 §4.1 L1(a) (documented-scope) + L1(b) (publish-
delivery).
```

## Application checklist

Before running `git tag -s <name> -m "..."`:

1. [ ] Literal count computed via `git log <prev>..<this> --oneline | wc -l`
2. [ ] Sub-count disclosure: enumerated items sum to total, OR total
       labeled as distinct count-dimension
3. [ ] Range-breakdown qualifier applied if range spans multiple
       release-namespaces
4. [ ] Commit-SHAs referenced short (7 chars) for brevity; full SHAs
       resolvable via `git rev-parse <short>`
5. [ ] Message scrub-clean (no blocked terms per `scripts/scrub-terms.*`)

---

*Introduced by v0.17.4 WB-2 (audit v0.17.3 §4.2 closure). First applied
to wizard-v0.17.4 + v0.16.5 tag-messages this cycle.*
