#!/usr/bin/env node
/**
 * Post-build asset-copy for @aegis-wizard/cli.
 *
 * Copies src/**\/*.json files into dist/ alongside the tsc-emitted .js
 * outputs. This covers the i18n catalogs (src/brief/i18n/{en,de}.json)
 * plus any future static JSON assets that need to be loaded at runtime
 * via readFileSync.
 *
 * Idempotent — safe to re-run. Skips the copy if source and destination
 * are byte-identical.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..', 'packages', 'wizard-cli');
const srcRoot = join(pkgRoot, 'src');
const distRoot = join(pkgRoot, 'dist');

if (!existsSync(distRoot)) {
  console.error(`[copy-wizard-assets] dist/ does not exist; run tsc first.`);
  process.exit(1);
}

function walk(dir) {
  const entries = readdirSync(dir);
  const out = [];
  for (const e of entries) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      out.push(...walk(p));
    } else if (st.isFile() && p.endsWith('.json')) {
      out.push(p);
    }
  }
  return out;
}

const jsons = walk(srcRoot);
let copied = 0;
for (const src of jsons) {
  const rel = relative(srcRoot, src);
  const dst = join(distRoot, rel);
  mkdirSync(dirname(dst), { recursive: true });
  try {
    const srcBuf = readFileSync(src);
    const dstBuf = existsSync(dst) ? readFileSync(dst) : null;
    if (dstBuf && srcBuf.equals(dstBuf)) continue;
  } catch {
    // fall through to copy
  }
  cpSync(src, dst);
  copied++;
}
console.log(`[copy-wizard-assets] ${copied} JSON asset(s) copied (${jsons.length} scanned).`);
