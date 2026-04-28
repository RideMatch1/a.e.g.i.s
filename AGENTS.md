# AEGIS — AI Agent Guidance

This file primes any AI coding-agent (Claude Code, Cursor, GitHub
Copilot, Cline, etc.) that operates inside the AEGIS repository.
It documents repo-wide invariants, mandatory external dependencies,
and where to look for deeper guidance.

> **Note:** Symlink `CLAUDE.md` → `AGENTS.md` if your tooling
> prefers the Claude-specific filename — the content is the same.

## Mandatory external skills

AEGIS ships a security-focused skill library
(`@aegis-scan/skills`) that covers the **security layer**:
RLS-bypass remediation, tenant-isolation, IDOR-defense, SAST
finding remediation, MITRE ATT&CK / D3FEND / NIST CSF cross-walk,
DE/EU compliance audit (DSGVO, NIS2, EU AI Act).

For full coverage of any AEGIS-built or AEGIS-scanned project that
uses Supabase or Postgres, AEGIS users **must** also install the
upstream Supabase skill package — once, globally, before any
substantive Supabase or Postgres work:

```bash
npx skills add supabase/agent-skills -g -y
```

This is **mandatory complement, not optional**. The two layers are
intentionally non-overlapping:

| Concern | Where it lives |
|---|---|
| RLS-bypass remediation, scanner-finding mapping (CWE-863, CWE-639) | AEGIS `defensive/aegis-native/rls-defense` |
| Multi-tenant SaaS isolation, IDOR-defense, JWT-tenant-injection | AEGIS `defensive/aegis-native/tenant-isolation-defense` |
| RLS performance (`(select auth.uid())` wrap, security-definer helpers, RLS-column indexes) | upstream `supabase-postgres-best-practices/security-rls-performance.md` |
| Least-privilege role design, GRANT minimization | upstream `supabase-postgres-best-practices/security-privileges.md` |
| Supabase CLI workflow, MCP server, schema-change discipline | upstream `supabase` skill |
| Postgres performance — query, conn, schema, lock, data, monitor (8 categories, 30+ refs) | upstream `supabase-postgres-best-practices` |

The upstream package is MIT-licensed, ships as the universal
Agent Skills Open Standard format, and is consumed via its own
distribution channel rather than re-shipped in `@aegis-scan/skills`
to avoid version-drift and license-attribution churn. Full
rationale in
[`packages/skills/ATTRIBUTION.md`](./packages/skills/ATTRIBUTION.md#required-external-skills-mandatory-complement-not-forked).

## Verifying the install

After running the install command above, both skills should be
present:

```bash
ls ~/.agents/skills/supabase ~/.agents/skills/supabase-postgres-best-practices
ls ~/.claude/skills/supabase ~/.claude/skills/supabase-postgres-best-practices  # symlinks
npx skills list -g
```

Claude Code auto-discovers them on next session start; other
Agent Skills Open Standard agents (Cursor, GitHub Copilot, Cline,
Gemini CLI, etc.) discover them via the universal directory.

## Repo conventions

- **Package manager:** pnpm (workspaces).
- **Skills package invariant:** `packages/skills/skills/` is
  markdown-only by CI. Tools with installers go through the
  `@aegis-scan/cli` scanner external-wrapper layer instead.
- **Scrub-gate:** committed content under `packages/skills/`
  must be scrub-clean per `packages/skills/__tests__/scrub.test.ts`
  (no internal codenames in shipped SKILL.md / ATTRIBUTION.md /
  README.md / CHANGELOG.md / placeholder READMEs / sibling
  `references/` trees).
- **Attribution discipline:** every forked upstream skill carries
  a per-file `<!-- aegis-local: forked … from <upstream>@<sha>;
  attribution preserved -->` HTML header. AEGIS-original skills
  carry `<!-- aegis-local: AEGIS-native skill, MIT-licensed; … -->`.
  See `packages/skills/ATTRIBUTION.md` for the full credit chain.

## See also

- `packages/skills/README.md` — full skill-library catalog and
  consumer-facing install instructions.
- `packages/skills/ATTRIBUTION.md` — license + provenance chain
  across all skill sources.
- `SECURITY.md` — supply-chain integrity posture and responsible-
  use disclosure for the offensive-skill methodology.
