# Release Process

## Pre-publish Installability Gate (MANDATORY)

Before any `pnpm -r publish`, run:

```bash
pnpm release:smoke
```

This gate catches bug-classes that dry-runs miss:

- `workspace:*` protocol leaks into published deps (caused v0.12.0 break)
- Missing files in tarball (caused v0.12.1 break — `templates/` not bundled)
- Prepack script crashes (caused v0.12.2 near-break, caught pre-publish)
- Unsubstituted `{{placeholders}}` in scaffold output
- `.tpl` suffixes not stripped
- `.gitignore` stripped by npm convention (v0.13 source-rename bypass)

Exit 0 = safe to publish. Exit ≥1 = fix before publishing.

What the gate does:

1. Packs all 5 packages into a scratch dir via `pnpm pack`
2. Verifies the cli tarball contains `templates/nextjs-supabase/template.json`
3. Extracts the cli tarball and greps for `"workspace:` in its `package.json` — zero hits required
4. Installs the 4 published packages (`core`, `scanners`, `reporters`, `cli`) from tarballs into a scratch `node_modules`
5. Runs the primary user-facing command `aegis new smoke-test --skip-install --skip-scan`
6. Verifies the scaffold dir exists, contains a real `.gitignore`, has zero unsubstituted `{{PLACEHOLDER}}` strings, and zero `.tpl` files left behind

## Full Release Sequence

1. All code merged, `CHANGELOG.md` finalized with release-date
2. Bump versions: `packages/{core,scanners,reporters,cli,mcp-server}/package.json`
3. `pnpm install` (regenerates lockfile with new workspace versions)
4. `pnpm build` (all packages — catches compile errors pre-publish)
5. `pnpm test` (baseline unchanged — reference the current test-count in the handover)
6. **`pnpm release:smoke`** ← THIS GATE (mandatory, non-negotiable)
7. Commit version-bumps + CHANGELOG date as `chore(release): vX.Y.Z`
8. `git tag vX.Y.Z`
9. Dry-run review (no hidden changes in tarball vs source)
10. `git push origin main && git push origin vX.Y.Z`
11. `pnpm -r publish --access public`
12. Verify `npm view @aegis-scan/{core,scanners,reporters,cli,mcp-server} dist-tags.latest` → X.Y.Z × 5
13. Advance `latest` dist-tag manually if the registry didn't auto-advance (`npm dist-tag add @aegis-scan/<pkg>@X.Y.Z latest`)
14. Create GH release with CHANGELOG notes (triggers the `.vsix` asset-attachment workflow — see `.github/workflows/release.yml`)

## Why this discipline exists

v0.12 took three publish attempts before stabilising:

- v0.12.0: `workspace:*` protocol literals leaked into published deps → `EUNSUPPORTEDPROTOCOL` on every `npm install`
- v0.12.1: `packages/cli/package.json.files` field didn't list `templates/` → `aegis new` failed at runtime
- v0.12.2: prepack script used ESM `require` in a `"type": "module"` package → ReferenceError

All three would have been caught by this gate in a single run. Code review and CI-time tests did not catch them because the bugs lived in the pack → install → run path, not in the compile or unit-test paths. The gate exercises that full path against a packed tarball, not the local dev layout.
