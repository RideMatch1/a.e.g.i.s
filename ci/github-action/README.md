# AEGIS Security Audit — GitHub Action

Run AEGIS security audits in your GitHub workflows. Posts a summary comment on PRs with score, grade, and top findings.

## Quick Start

```yaml
# .github/workflows/security.yml
name: Security Audit
on: [push, pull_request]

jobs:
  aegis:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write      # Required for PR comments
    steps:
      - uses: actions/checkout@v4
      - uses: RideMatch1/a.e.g.i.s/ci/github-action@main
```

This runs a quick scan on every push/PR and posts a comment like:

> ## 🛡️ AEGIS Security Audit — Score: 923/1000 (A/HARDENED)
>
> | Severity | Count |
> |---|---|
> | 🟠 HIGH | 12 |
> | 🟡 MEDIUM | 8 |
> | 🔵 LOW | 3 |
> | **Total** | **23** |

## Full Audit + SARIF Upload

```yaml
name: Security Audit (Full)
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 3 * * 1'  # Weekly Monday 03:00 UTC

jobs:
  aegis:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      security-events: write   # Required for SARIF upload
    steps:
      - uses: actions/checkout@v4
      - uses: RideMatch1/a.e.g.i.s/ci/github-action@main
        id: aegis
        with:
          mode: audit
          upload-sarif: true
          fail-below: 700       # Block merges below grade B
      - run: echo "Score is ${{ steps.aegis.outputs.score }}"
```

Findings appear in the **Security** tab under **Code scanning alerts**.

## Inputs

| Input | Description | Default |
|---|---|---|
| `mode` | `scan` (quick) or `audit` (full) | `scan` |
| `path` | Project path to scan | `.` |
| `fail-on-blocker` | Fail if a blocker finding exists | `true` |
| `fail-below` | Fail if score is below threshold (0-1000) | `0` |
| `upload-sarif` | Upload SARIF to GitHub Code Scanning | `false` |
| `comment-on-pr` | Post summary comment on PR | `true` |
| `aegis-version` | AEGIS version/ref to use | `main` |

## Outputs

| Output | Description | Example |
|---|---|---|
| `score` | Security score (0-1000) | `923` |
| `grade` | Grade (S/A/B/C/D/F) | `A` |
| `badge` | Badge name | `HARDENED` |
| `findings` | Total finding count | `42` |
| `blocked` | Blocker detected | `false` |

Use in subsequent steps: `${{ steps.aegis.outputs.score }}`

## Modes

- **`scan`** — Quick scan (~5s). Security, dependencies, quality, compliance, i18n. Good for every push.
- **`audit`** — Full audit (~15s). All 59 scanners including DAST, infrastructure, TLS. Good for weekly/pre-release.
