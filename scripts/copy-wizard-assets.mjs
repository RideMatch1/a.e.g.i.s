#!/usr/bin/env node
/**
 * Post-build asset-copy for @aegis-wizard/cli.
 *
 * Copies two asset-classes into dist/ alongside the tsc-emitted .js outputs:
 *   1. src/**\/*.json — i18n catalogs and any other static JSON assets
 *      loaded at runtime via readFileSync.
 *   2. docs/patterns/**\/*.md — knowledge-base pattern bodies. Without
 *      these in dist/, the published tarball lacks the patterns entirely
 *      and aegis-wizard new exits non-zero on fresh npm-install.
 *
 * Idempotent — safe to re-run. Skips the copy if source and destination
 * are byte-identical.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const pkgRoot = join(repoRoot, 'packages', 'wizard-cli');
const srcRoot = join(pkgRoot, 'src');
const distRoot = join(pkgRoot, 'dist');
const patternsSrc = join(repoRoot, 'docs', 'patterns');
const patternsDst = join(distRoot, 'docs', 'patterns');

if (!existsSync(distRoot)) {
  console.error(`[copy-wizard-assets] dist/ does not exist; run tsc first.`);
  process.exit(1);
}

function walk(dir, ext) {
  const entries = readdirSync(dir);
  const out = [];
  for (const e of entries) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      out.push(...walk(p, ext));
    } else if (st.isFile() && p.endsWith(ext)) {
      out.push(p);
    }
  }
  return out;
}

function copyTree(sources, srcBase, dstBase) {
  let copied = 0;
  for (const src of sources) {
    const rel = relative(srcBase, src);
    const dst = join(dstBase, rel);
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
  return copied;
}

const jsons = walk(srcRoot, '.json');
const jsonCopied = copyTree(jsons, srcRoot, distRoot);
console.log(`[copy-wizard-assets] ${jsonCopied} JSON asset(s) copied (${jsons.length} scanned).`);

if (!existsSync(patternsSrc)) {
  console.error(`[copy-wizard-assets] patterns source does not exist: ${patternsSrc}`);
  process.exit(1);
}
const mds = walk(patternsSrc, '.md');
const mdCopied = copyTree(mds, patternsSrc, patternsDst);
console.log(`[copy-wizard-assets] ${mdCopied} pattern .md file(s) copied (${mds.length} scanned).`);
