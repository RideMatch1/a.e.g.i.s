/**
 * Runtime self-version reader for the `@aegis-wizard/cli` package.
 *
 * Both `commands/new.ts` (for the --version flag + install-banner) and
 * `brief/generator.ts` (for the provenance header override that closes
 * audit M3 + L8) need to know the version the running CLI was built
 * from. This shared helper guarantees they read the same value from
 * the same source — the package.json adjacent to dist/.
 *
 * Path navigation: the transpiled output of this file lives at
 * `dist/brief/self-version.js`, so from that file's directory two
 * `..` steps reach the package root where package.json lives.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function readSelfVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
  return pkg.version;
}
