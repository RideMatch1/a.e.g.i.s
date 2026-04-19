#!/usr/bin/env node
/**
 * Pre-pack hook: copy repo-root `templates/` into `packages/cli/templates/`
 * so the pack includes scaffold templates as bundled assets.
 *
 * Background: @aegis-scan/cli needs the nextjs-supabase template available
 * inside its own package tree to serve `aegis new <name>` from a published
 * install. In the monorepo the source-of-truth lives at repo-root so every
 * package can reference a single copy; npm pack only bundles files under
 * the package directory, so we stage a copy here at pack time.
 *
 * The destination is gitignored; this script is idempotent and runs via
 * the package.json `prepack` script before every local/published pack.
 *
 * NOTE: `.cjs` extension is required because the cli package.json declares
 * `"type": "module"` — node would otherwise treat this file as ESM.
 */
const { cpSync, rmSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const src = resolve(__dirname, '../../../templates');
const dst = resolve(__dirname, '../templates');

if (!existsSync(src)) {
  console.error(`[copy-templates] Source not found: ${src}`);
  process.exit(1);
}

if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log(`[copy-templates] ${src} → ${dst}`);
