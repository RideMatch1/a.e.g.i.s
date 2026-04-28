# AEGIS — Release Checklist

> **When to use this:** before tagging any package release (`skills-vX.Y.Z`, `cli-vX.Y.Z`, `wizard-vX.Y.Z`, etc.) or pushing to `main` with a `release(*):` commit.
> **Why:** prior critical bugs (CMD-injection, prompt-injection in `--ai`, GitHub-Actions injection) only surfaced post-launch. This checklist catches the common-pattern bugs before they ship.
> **Discipline:** every checkbox must be confirmed (not assumed). If any item is "not applicable" for this release, write the reason explicitly in the commit message — never silently skip.

---

## 1. Self-scan with AEGIS itself

The most important check: AEGIS scans its own source for the same patterns it detects in user code.

- [ ] `npx -y @aegis-scan/cli scan .` from a clean checkout of the release branch.
- [ ] Score ≥ 950 (FORTRESS) for the AEGIS repo itself.
- [ ] No CRITICAL or HIGH severity findings open.
- [ ] Any MEDIUM findings either fixed or explicitly suppressed in `docs/suppressions.md` with rationale.
- [ ] If new checkers were added in this release: re-scan to confirm they don't false-positive on AEGIS's own code.

## 2. Manual review of CLI argument handling (CMD-injection class)

CLI commands that pass user input to `child_process.exec` or `spawn` are the highest-risk surface.

- [ ] Every new CLI flag and subcommand reviewed for shell-metacharacter handling.
- [ ] No `exec()` / `execSync()` calls with user-controlled argument concatenation. Use `spawn()` with argv array; never compose with template literals containing user input.
- [ ] Every external-tool wrapper (`packages/scanners/src/{dast,sast,secrets,sbom}/*.ts`) checked: target-URLs, output-paths, project-paths must be passed as discrete argv elements.
- [ ] Path arguments validated against directory-traversal (`../../etc/passwd` etc.) before passing to any tool.

## 3. Manual review of `--ai` / LLM-prompt construction (prompt-injection class)

Where AEGIS feeds external content into an LLM prompt, prompt-injection is possible.

- [ ] No raw user-input or scanned-content concatenated directly into prompts. Use structured user/assistant message format with explicit content boundaries.
- [ ] System prompts immutable per request (no string-interpolation of user-controlled values into the system prompt).
- [ ] If new `--ai` features were added: review the prompt construction in `packages/cli/src/ai/` and `packages/skills/skills/.../aegis-skill-creator/` against the LLM-prompt-hygiene rules in `references/skillforge-methodology.md`.
- [ ] If a new skill ships: confirm its body content cannot be hijacked by malicious file content the skill might read (e.g., a malicious briefing.md should not be able to override the skill's HARD-CONSTRAINT block).

## 4. GitHub Actions / CI workflow review (GHA-injection class)

The `tj-actions` class of bug: workflow-level command-injection via uncontrolled environment variables.

- [ ] Every `.github/workflows/*.yml` reviewed for `${{ … }}` expressions interpolated into `run:` blocks.
- [ ] All third-party actions SHA-pinned (not `@v1` or `@main`); enforced by `scripts/check-gha-sha-pin.sh` at CI time.
- [ ] No use of `pull_request_target` with checkout of untrusted code without explicit guard.
- [ ] Secrets exposed only to jobs that strictly need them (no global `permissions: write-all`).
- [ ] If new workflows were added: explicit code-review by maintainer (no auto-merge of workflow PRs).

## 5. Skill content review (for skills package releases)

Released skills are loaded into Claude Code / Codex / etc. with full agent permissions. Malicious skill content is an attack vector.

- [ ] Every new or modified `SKILL.md` reviewed for prompt-injection patterns (instructions that override system prompt, urge to bypass safety checks, etc.).
- [ ] No skill body contains commands that exfiltrate data (write to remote URL, post to webhook) without the skill's documented purpose justifying it.
- [ ] Every multi-file skill's `references/*.md` reviewed for the same.
- [ ] Frontmatter `metadata.required_tools` honestly lists every tool-category the skill uses (no hidden capability requests).
- [ ] HARD-CONSTRAINT blocks are present and not contradicted by body content.

## 6. Test + benchmark gates green

- [ ] `pnpm test` exits 0 across the workspace.
- [ ] `pnpm benchmark` exits 0 (21 planted vulnerabilities + 9 clean-file FP checks).
- [ ] No new CI run on the release commit shows red status for: CI / CodeQL / OSSF Scorecard / Gitleaks.
- [ ] Coverage report (when available) shows no regression vs the prior release.

## 7. Scrub-clean check

- [ ] `bash scripts/check-dist-codename-leak.sh` passes (CI gate).
- [ ] `pnpm test --filter '@aegis-scan/skills'` includes the scrub-test suite at full pass count (currently 92).
- [ ] Commit message does NOT contain forbidden terms (`Claude` / `Anthropic` / `TODO` / `FIXME` / `XXX` / `HACK` per `scripts/scrub-terms.generic.txt`).
- [ ] Tarball contents do NOT contain forbidden internal codenames (per `packages/skills/__tests__/scrub.test.ts`).

## 8. Residue-check (Gate 10 from aegis-quality-gates skill)

- [ ] Run the residue-detection methodology from `packages/skills/skills/foundation/aegis-native/aegis-quality-gates/SKILL.md` against the release branch:
  - Stale commit-SHAs in handover docs
  - Broken markdown cross-links in shipped SKILL.md content
  - Orphan path references
  - Phantom `_INDEX.md` skill rows
  - Dead `<!-- aegis-local: -->` provenance refs
- [ ] Zero hits in any class. If any class non-zero: fix before tagging.

## 9. Provenance + signing

- [ ] Release commit is GPG- or SSH-signed (enforced by repo ruleset).
- [ ] Tag is annotated and signed (`git tag -a -s skills-vX.Y.Z`).
- [ ] After publish: `npm view @aegis-scan/<package>@X.Y.Z dist.attestations.provenance.predicateType` returns `https://slsa.dev/provenance/v1`.

## 10. Documentation + CHANGELOG

- [ ] CHANGELOG entry for the new version with Added / Updated / Fixed / Removed sections.
- [ ] If breaking change: explicit migration note in CHANGELOG plus a separate `MIGRATION-vX.Y.Z.md` if non-trivial.
- [ ] README updated if user-facing surface changed (new commands, removed commands, new env vars).
- [ ] ATTRIBUTION.md updated if new external sources adopted (any of the three patterns: fork-mode, mandate-without-fork, concept-only).

---

## When this checklist FAILS

- A failed check is **not** a "deploy and patch later" candidate — it is a **block on the release**.
- If a check fails because of a false-positive in the checklist itself: update this checklist with the rationale, do not silent-skip.
- If a check would block a critical security release: see `SECURITY-INCIDENT-RESPONSE.md` for the emergency-fix path. Even emergency fixes go through items #1, #2, #3 (the bug-class checks), just compressed.

## Continuous improvement

Add a new checkbox to this file every time a post-launch bug surfaces a class that should have been caught pre-launch. The bugs that motivated this checklist's creation:

- **CMD-injection** in CLI argument handling — added §2.
- **Prompt-injection in `--ai`** — added §3.
- **GitHub-Actions-injection** — added §4.

Future post-launch findings extend this list. The checklist is the institutional memory of "what we've been bitten by".

---

**Approvals:**
- Maintainer (RideMatch1): `_____________________` date `_____________`
