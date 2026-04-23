#!/usr/bin/env node
/**
 * AEGIS supply-chain hardening — manifest-confusion gate.
 *
 * Closes the threat-class disclosed by Darcy Clarke (June 2024): a malicious
 * package can ship a tarball whose `package.json` declares different deps,
 * scripts, or bin entries than what the npm registry's manifest API exposes.
 * Consumers running `npm install` resolve via the registry-API but the
 * actual bits they execute come from the tarball — divergence = stealthy
 * supply-chain payload.
 *
 * This gate runs pre-publish: pack the package, extract package/package.json
 * from the tarball, and assert it matches the source package.json on the
 * security-critical fields. Any mismatch fails the build.
 *
 * Usage:
 *   node scripts/check-manifest-confusion.mjs <package-dir> <tarball-path>
 *
 * Example (publish-wizard.yml):
 *   pnpm -F @aegis-wizard/cli pack --pack-destination /tmp/tar
 *   node scripts/check-manifest-confusion.mjs packages/wizard-cli /tmp/tar/aegis-wizard-cli-0.17.1.tgz
 *
 * Exit codes:
 *   0 = manifest matches across all security-critical fields
 *   1 = mismatch on one or more fields (security finding)
 *   2 = config / IO error
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , packageDirArg, tarballArg] = process.argv;

if (!packageDirArg || !tarballArg) {
  console.error('Usage: node scripts/check-manifest-confusion.mjs <package-dir> <tarball-path>');
  process.exit(2);
}

const sourcePkgPath = join(packageDirArg, 'package.json');
let sourcePkg;
try {
  sourcePkg = JSON.parse(readFileSync(sourcePkgPath, 'utf-8'));
} catch (e) {
  console.error(`::error::Failed to read source package.json at ${sourcePkgPath}: ${e.message}`);
  process.exit(2);
}

// Extract just package.json from the tarball (do not extract the full tree).
let tarballPkg;
try {
  const scratch = mkdtempSync(join(tmpdir(), 'manifest-confusion-'));
  execSync(`tar -xzf "${tarballArg}" -C "${scratch}" package/package.json`, { stdio: 'pipe' });
  tarballPkg = JSON.parse(readFileSync(join(scratch, 'package', 'package.json'), 'utf-8'));
} catch (e) {
  console.error(`::error::Failed to extract package/package.json from tarball ${tarballArg}: ${e.message}`);
  process.exit(2);
}

// Security-critical fields that MUST match exactly.
// Deps + scripts + bin are the highest-impact divergence vectors.
const CRITICAL_FIELDS = [
  'name',
  'version',
  'main',
  'module',
  'type',
  'bin',
  'scripts',
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'engines',
  'publishConfig',
];

const findings = [];

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === undefined || b === undefined) return a === b;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
    if (!deepEqual(a[ka[i]], b[kb[i]])) return false;
  }
  return true;
}

/**
 * Compare a deps-block (dependencies / peerDependencies / optionalDependencies)
 * with awareness of the workspace:* transformation pnpm performs at pack-time.
 *
 * pnpm-pack rewrites a source spec like `"@aegis-scan/core": "workspace:*"`
 * into the actually-resolved-version `"@aegis-scan/core": "0.16.4"` so the
 * published tarball is consumable outside the workspace context. This is a
 * LEGITIMATE transformation, not a manifest-confusion attack.
 *
 * We allow that specific class of substitution: if the source value starts
 * with `workspace:`, the tarball value must be a valid semver-ish string
 * (any non-empty value that does not itself start with `workspace:`).
 *
 * For all other deps, the spec must match exactly between source and tarball.
 */
function depsEqualAllowingWorkspaceSubstitution(srcDeps, tarDeps) {
  if (srcDeps === undefined && tarDeps === undefined) return { equal: true, diffs: [] };
  if (srcDeps === undefined || tarDeps === undefined) {
    return { equal: false, diffs: [`one side is undefined: src=${JSON.stringify(srcDeps)} tar=${JSON.stringify(tarDeps)}`] };
  }
  const srcKeys = Object.keys(srcDeps).sort();
  const tarKeys = Object.keys(tarDeps).sort();
  const diffs = [];
  // Symmetric-difference on key-sets
  for (const k of srcKeys) {
    if (!(k in tarDeps)) diffs.push(`tarball missing dep: ${k}`);
  }
  for (const k of tarKeys) {
    if (!(k in srcDeps)) diffs.push(`tarball has extra dep not in source: ${k}`);
  }
  for (const k of srcKeys) {
    if (!(k in tarDeps)) continue;
    const srcSpec = srcDeps[k];
    const tarSpec = tarDeps[k];
    if (typeof srcSpec === 'string' && srcSpec.startsWith('workspace:')) {
      // pnpm-pack substitution path. tarball spec must be a non-workspace string.
      if (typeof tarSpec !== 'string' || tarSpec.length === 0 || tarSpec.startsWith('workspace:')) {
        diffs.push(`workspace-substitution failed for ${k}: src="${srcSpec}" tar="${tarSpec}"`);
      }
      continue;
    }
    if (srcSpec !== tarSpec) {
      diffs.push(`spec drift on ${k}: src="${srcSpec}" tar="${tarSpec}"`);
    }
  }
  return { equal: diffs.length === 0, diffs };
}

function diffSummary(label, sourceVal, tarballVal) {
  const s = JSON.stringify(sourceVal);
  const t = JSON.stringify(tarballVal);
  return `  ${label}\n    source:  ${s}\n    tarball: ${t}`;
}

const DEP_FIELDS = new Set(['dependencies', 'peerDependencies', 'optionalDependencies']);

/**
 * pnpm-pack and npm-pack strip development-time lifecycle scripts from the
 * published tarball — these only make sense in the source-checkout context
 * (running tsc, copying assets, etc.) and have no consumer-side meaning.
 *
 * Stripped lifecycle hooks (per npm docs §scripts/life-cycle-scripts):
 *   - prepack       runs BEFORE pack
 *   - postpack      runs AFTER pack
 *   - prepublish    DEPRECATED but still stripped
 *   - prepublishOnly runs BEFORE publish
 *   - prepare       runs BEFORE pack/publish (and on git-install consumer-side,
 *                   but pnpm-pack still strips it from the published tarball)
 *
 * The consumer-side install hooks (preinstall / install / postinstall /
 * preuninstall / postuninstall) are NOT in this list — we want any source-
 * declaration of those to surface in the tarball comparison so a malicious
 * postinstall added in source but stripped in tarball would fail this gate.
 * Conversely, the publish-yml has a separate gate that blocks ANY of those
 * five from being declared in source for our packages.
 */
const DEV_ONLY_LIFECYCLE_SCRIPTS = new Set([
  'prepack',
  'postpack',
  'prepublish',
  'prepublishOnly',
  'prepare',
]);

function compareScriptsAllowingDevOnlyStripping(srcScripts, tarScripts) {
  if (srcScripts === undefined && tarScripts === undefined) return { equal: true, diffs: [] };
  const src = { ...(srcScripts || {}) };
  const tar = { ...(tarScripts || {}) };
  for (const k of DEV_ONLY_LIFECYCLE_SCRIPTS) {
    delete src[k];
    delete tar[k];
  }
  if (deepEqual(src, tar)) return { equal: true, diffs: [] };
  const diffs = [];
  const allKeys = new Set([...Object.keys(src), ...Object.keys(tar)]);
  for (const k of allKeys) {
    if (src[k] !== tar[k]) {
      diffs.push(`script "${k}": src=${JSON.stringify(src[k])} tar=${JSON.stringify(tar[k])}`);
    }
  }
  return { equal: false, diffs };
}

for (const field of CRITICAL_FIELDS) {
  const a = sourcePkg[field];
  const b = tarballPkg[field];
  if (DEP_FIELDS.has(field)) {
    const r = depsEqualAllowingWorkspaceSubstitution(a, b);
    if (!r.equal) {
      findings.push(`  ${field}\n    diffs:\n      - ${r.diffs.join('\n      - ')}\n    source:  ${JSON.stringify(a)}\n    tarball: ${JSON.stringify(b)}`);
    }
  } else if (field === 'scripts') {
    const r = compareScriptsAllowingDevOnlyStripping(a, b);
    if (!r.equal) {
      findings.push(`  ${field}\n    diffs:\n      - ${r.diffs.join('\n      - ')}\n    source:  ${JSON.stringify(a)}\n    tarball: ${JSON.stringify(b)}`);
    }
  } else if (!deepEqual(a, b)) {
    findings.push(diffSummary(field, a, b));
  }
}

console.log(`Manifest-confusion gate`);
console.log(`  source:  ${sourcePkgPath}`);
console.log(`  tarball: ${tarballArg}`);
console.log(`  fields checked: ${CRITICAL_FIELDS.join(', ')}`);
console.log('');

if (findings.length > 0) {
  console.error('::error::Manifest-confusion detected — tarball package.json diverges from source on security-critical fields:');
  console.error('');
  for (const f of findings) console.error(f);
  console.error('');
  console.error('Why this matters: npm install resolves deps via the registry-API which');
  console.error('reads from the tarball metadata at publish-time, but the actual bits');
  console.error('that consumers execute come from the tarball file itself. Divergence');
  console.error('between the two creates a stealth-channel for supply-chain payloads.');
  console.error('Reference: Darcy Clarke "manifest confusion" disclosure, June 2024.');
  console.error('');
  console.error('Fix: investigate why the tarball-build is mutating the manifest.');
  console.error('Likely culprits: prepack script, npm-pack rewriting deps, an over-');
  console.error('eager files-array trimming a needed declaration. Compare the source');
  console.error('package.json to the extracted tarball package.json and reconcile.');
  process.exit(1);
}

console.log(`  result: MATCH — tarball manifest matches source on all ${CRITICAL_FIELDS.length} critical fields.`);
process.exit(0);
