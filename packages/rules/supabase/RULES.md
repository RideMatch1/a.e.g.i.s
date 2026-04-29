# Supabase Splinter ↔ AEGIS Rule Map

This file is the canonical reference between **Supabase's upstream
linter** ([supabase/splinter](https://github.com/supabase/splinter), the
SQL-rule engine that powers the Dashboard's "Advisors" tab) and **AEGIS's
remediation surface** (skills + scanners + wizard scaffolds).

The vendored Splinter rules under `splinter/` are **read-only mirrors**
pinned to the SHA in `SPLINTER_SHA.lock`. To refresh, run
`scripts/refresh-splinter.sh` — it diffs against `main`, warns on new
rules (so AEGIS catches a "0 → N WARN" surprise *before* a project
upgrades).

## Why this exists

Hundementor 2026-04-29 — a Supabase project went from 0 → 1 ERROR + 207
WARN advisor findings overnight. No code changed; Splinter shipped two
new rules (0028, 0029) that retroactively flagged a longstanding
SECURITY DEFINER + `p_user_id` IDOR pattern. AEGIS's TypeScript-oriented
scanners hadn't audited the SQL layer where the vulns lived. Vendoring
Splinter + adding a static SQL scanner closes that gap and tells you
*before* the surprise lands.

## Rule map

| Splinter | Title | AEGIS coverage |
|---|---|---|
| 0001 | unindexed_foreign_keys | quality (perf hint) — uncovered, low priority |
| 0002 | auth_users_exposed | **`tenant-isolation-checker` (CWE-639)** — partial coverage when an auth.users-derived view leaks via API |
| 0003 | auth_rls_initplan | perf-hint — uncovered |
| 0004 | no_primary_key | quality — uncovered |
| 0005 | unused_index | perf-hint — uncovered |
| 0006 | multiple_permissive_policies | **`rls-defense` skill** advises consolidating; uncovered by scanner |
| 0007 | policy_exists_rls_disabled | **`rls-defense` skill — core invariant** |
| 0008 | rls_enabled_no_policy | **`rls-defense` skill — core invariant** |
| 0009 | duplicate_index | perf-hint — uncovered |
| 0010 | security_definer_view | **`rls-defense` skill** + `supabase-migration-checker` (planned SBM-006) |
| 0011 | function_search_path_mutable | **`supabase-migration-checker` SBM-003** ✅ |
| 0013 | rls_disabled_in_public | **`rls-defense` skill — core invariant**; `supabase-migration-checker` (planned SBM-007) |
| 0014 | extension_in_public | `rls-defense` skill — extension hygiene |
| 0015 | rls_references_user_metadata | **`rls-defense` skill** — anti-pattern documented; `auth-enforcer` partial |
| 0016 | materialized_view_in_api | **`rls-defense` skill** — wrapper-fn pattern; `supabase-migration-checker` (planned SBM-008) |
| 0017 | foreign_table_in_api | uncovered — niche |
| 0018 | unsupported_reg_types | uncovered — niche |
| 0019 | insecure_queue_exposed_in_api | uncovered — Supabase-Queue-specific |
| 0020 | table_bloat | perf-hint — uncovered |
| 0021 | fkey_to_auth_unique | quality — uncovered |
| 0022 | extension_versions_outdated | overlap with `npm-audit` / supply-chain |
| 0023 | sensitive_columns_exposed | overlap with `next-public-leak` for `process.env.SUPABASE_*` |
| 0024 | rls_policy_always_true | **`supabase-migration-checker` SBM-005** ✅ |
| 0025 | public_bucket_allows_listing | `auth-enforcer` partial — storage policies uncovered |
| 0026 | pg_graphql_anon_table_exposed | uncovered — pg_graphql niche |
| 0027 | pg_graphql_authenticated_table_exposed | uncovered — pg_graphql niche |
| 0028 | anon_security_definer_function_executable | **`supabase-migration-checker` SBM-001 + SBM-002** ✅ + `rls-defense` skill Section 4a |
| 0029 | authenticated_security_definer_function_executable | **`supabase-migration-checker` SBM-001 + SBM-002** ✅ + `rls-defense` skill Section 4a |

## AEGIS-only rules (no Splinter equivalent)

| AEGIS | Title | Why Splinter doesn't catch |
|---|---|---|
| `supabase-migration-checker` SBM-004 | SECURITY DEFINER + dynamic SQL with parameter interpolation | Splinter is privilege-graph-aware but argument-blind. The Hundementor `restore_deleted(p_table_name text, p_id uuid)` would NOT trigger any Splinter rule because the privileges are correctly granted; the vulnerability is in the function body. AEGIS catches this statically at the migration-PR level. |

## Maintenance protocol

1. **Refresh cadence:** monthly, plus on demand when a new finding shape
   appears in the wild.
2. **Refresh procedure:** run `scripts/refresh-splinter.sh`. It
   - fetches `main` of supabase/splinter
   - diffs against the vendored copy at `SPLINTER_SHA.lock`'s SHA
   - lists new/changed/removed `.sql` files
   - opens a PR with the updates **and** flags any new rule that lacks
     an AEGIS coverage entry in this file
3. **New-rule playbook:** when Splinter adds a rule, decide:
   - **Static-detectable in migration SQL** → extend
     `supabase-migration-checker` (preferred path)
   - **Live-DB-only (privilege graph, runtime state)** → document in
     `rls-defense` skill as a remediation pattern; consider a future
     live-advisor wrapper (out of scope for v1)
   - **Performance-hint** → reference the upstream
     `supabase-postgres-best-practices` skill rather than adding to
     AEGIS scanner load

## See also

- AEGIS scanner: `packages/scanners/src/quality/supabase-migration-checker.ts`
- AEGIS skill: `packages/skills/skills/defensive/aegis-native/rls-defense/SKILL.md` (Section 4a)
- Splinter source: https://github.com/supabase/splinter (pinned at `SPLINTER_SHA.lock`)
- Supabase advisor docs: https://supabase.com/docs/guides/database/database-linter
