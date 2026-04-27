# Multi-Project Dogfood Corpus

AEGIS's precision is measured against a corpus of real Next.js projects so
single-project bias doesn't warp the numbers. Three open-source projects
are cloned by default; you can optionally add your own project as a fourth
corpus member via the `AEGIS_USER_PROJECT` env var.

## Corpus Members (default)

| Project | Stack | Why this project |
|---------|-------|------------------|
| **Cal.com** (OSS) | Next.js 14 App Router + Prisma + tRPC | 2000+ files = performance stress; non-Supabase DB stresses Supabase-only assumptions in scanners |
| **Dub** (OSS) | Next.js 14 + Prisma + Redis | Edge-runtime patterns |
| **OpenStatus** (OSS) | Next.js App Router + Drizzle + Multi-Tenant | Production-quality multi-tenant SaaS — catches false-positives where Supabase-specific scanners fire on non-Supabase code |

`Supabase-Examples` was deliberately NOT chosen — tutorial-grade code,
demo-biased. Optimizing AEGIS against demo-code makes it worse on
production-code.

## Setup

```bash
# 1. Clone the corpus (~5 minutes, first time)
bash scripts/dogfood-corpus.sh

# 2. Scan all corpora (each scan: 5-30s depending on project size)
bash scripts/dogfood-scan.sh

# 3. Generate annotation templates from the scans
bash scripts/dogfood-annotate.sh

# 4. Edit <corpus-precision-cache>/<corpus>.json — for each finding:
#    - "TP" if the scanner correctly identified a real issue
#    - "FP" if the finding is a false positive
#    - "skip" (default) to exclude from the precision metric

# 5. Compute precision — applies tier-aware gates
node packages/cli/dist/index.js precision report
```

To include your own project as a fourth corpus member:

```bash
AEGIS_USER_PROJECT=~/code/my-app bash scripts/dogfood-scan.sh
```

## Pinning Commits (for reproducibility)

By default the corpus tracks `main` of each project. For reproducible
precision-numbers across measurement runs, pin to specific commits:

```bash
AEGIS_CORPUS_PIN_CALCOM=v3.7.2 \
AEGIS_CORPUS_PIN_DUB=v0.36.1 \
AEGIS_CORPUS_PIN_OPENSTATUS=v0.5.0 \
  bash scripts/dogfood-corpus.sh
```

When pins change, re-run the full pipeline. Existing TP/FP verdicts
survive code drift via source-context fingerprint (see
`packages/cli/src/commands/precision.ts`'s `findingFingerprint`).

## Annotation File Format

```json
{
  "corpus": "cal-com",
  "scanRunAt": "2026-04-16T12:30:00Z",
  "aegisVersion": "0.7.0",
  "annotations": [
    {
      "id": "TAINT-001",
      "scanner": "taint-analyzer",
      "file": "/.../app/api/users/route.ts",
      "line": 42,
      "title": "Command Injection — req.body.cmd flows to exec()",
      "verdict": "TP",
      "fingerprint": "taint-analyzer|.../route.ts|abc123|Command Injection — ..."
    }
  ]
}
```

The `fingerprint` field is the stable identity used to preserve verdicts
across re-init. Computed from a 3-line window around the finding's reported
line, normalized + hashed. **Stable** across:
- Inserting/deleting unrelated lines above the finding (line-number drift)
- Refactor-renames that don't touch the finding's immediate context
- Finding-id renumbering across scans

**Not stable** across:
- Edits to the line itself (intentional — different code, fresh review needed)
- File rename / move (file is part of identity)
- Significant changes to the surrounding 3 lines

## Why per-project annotation files?

Each corpus has different code patterns and different "what is real"
judgments. A "missing tenant_id filter" finding in a non-multi-tenant
project is automatically a false positive; in a multi-tenant project it's
a real issue. Per-corpus files keep these judgments separate.

## Maintenance

- **Quarterly:** re-clone with latest commits, re-scan, expect drift in finding-counts
- **Per-Sprint:** when adding new scanners, expect new findings in all corpora — annotate them, update `<corpus-precision-cache>/*.json`
- **Pin updates:** when projects ship breaking changes (Next.js 15 → 16 etc.), bump pins, re-run full pipeline, expect FP-rate spike requiring fresh annotation

## Storage

`<corpus-precision-cache>/<corpus>.json` is git-ignored in this repo because the
dogfood annotations there are specific to the maintainer's local corpus
clones and contain absolute filesystem paths. Downstream consumers who
want versioned precision tracking can commit these files in their own
repos.
