/**
 * Shared template-path + self-version helpers.
 *
 * Extracted from `commands/new.ts` so `commands/init.ts` can reuse the same
 * template-root resolver and self-version reader without duplicating logic.
 * Both commands need:
 *   - a way to find the on-disk root of a named template (dev monorepo vs
 *     published-tarball layouts both supported via a candidate-chain),
 *   - a way to read the CLI's own `package.json` version for the
 *     `{{AEGIS_VERSION}}` placeholder.
 *
 * All functions are pure except `readSelfVersion`, which reads a file.
 */
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Template-root resolver

/**
 * Resolve a template root by name against a list of candidate base directories.
 * Returns the first candidate that contains a readable `template.json`.
 */
export function resolveTemplateRoot(
  templateName: string,
  candidates: readonly string[],
): { ok: true; root: string } | { ok: false; tried: string[] } {
  const tried: string[] = [];
  for (const base of candidates) {
    const root = join(base, templateName);
    tried.push(root);
    try {
      const manifest = join(root, 'template.json');
      if (existsSync(manifest) && statSync(manifest).isFile()) {
        return { ok: true, root };
      }
    } catch {
      // keep trying
    }
  }
  return { ok: false, tried };
}

/**
 * Default candidate-chain for template roots. Order:
 *   1. Published-package: `<cli-root>/templates/`
 *      (published tarball will need `templates/` in `files` — v0.13 packaging task)
 *   2. Dev-monorepo: `<repo-root>/templates/` — up 4 levels from
 *      `dist/commands/` (or `src/commands/` when running via tsx).
 */
export function defaultTemplateSearchPaths(commandDir: string): string[] {
  // `commandDir` is the directory of the compiled `new.js` (dist/commands/)
  // or `new.ts` under ts-node / vitest (src/commands/).
  const cliRoot = resolve(commandDir, '..', '..'); // dist/ or src/ -> cli package root
  const repoRoot = resolve(commandDir, '..', '..', '..', '..'); // up to repo root
  return [
    join(cliRoot, 'templates'),
    join(repoRoot, 'templates'),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-version read (for AEGIS_VERSION placeholder)

/**
 * Read the CLI's own package.json version. Used to substitute
 * `{{AEGIS_VERSION}}` in template-derived files so the scaffolded project
 * pins the CI action / tooling to the exact AEGIS release that scaffolded it.
 */
export function readSelfVersion(commandDir: string): string {
  // commandDir is dist/commands/ or src/commands/, pkg.json is 2 levels up.
  const pkgPath = resolve(commandDir, '..', '..', 'package.json');
  try {
    const raw = readFileSync(pkgPath, 'utf-8');
    const parsed = JSON.parse(raw) as { version?: string };
    if (typeof parsed.version !== 'string') {
      throw new Error('package.json missing version');
    }
    return parsed.version;
  } catch (err) {
    throw new Error(`Could not read AEGIS CLI version from ${pkgPath}: ${(err as Error).message}`);
  }
}
