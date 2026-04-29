import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAllScanners, getAttackScanners } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_SRC = readFileSync(join(__dirname, '..', 'src', 'index.ts'), 'utf-8');

interface ScannerImport {
  identifier: string;
  path: string;
}

function parseScannerImports(src: string): ScannerImport[] {
  const re = /^import\s*\{\s*([a-zA-Z_$][\w$]*Scanner)\s*\}\s*from\s*['"]\.\/([^'"]+)['"]/gm;
  const imports: ScannerImport[] = [];
  for (const m of src.matchAll(re)) {
    imports.push({ identifier: m[1], path: m[2] });
  }
  return imports;
}

describe('scanner registry parity (DEFAULT=MAX guard)', () => {
  const allImports = parseScannerImports(INDEX_SRC);
  const attackImports = allImports.filter((i) => i.path.startsWith('attacks/'));
  const staticImports = allImports.filter((i) => !i.path.startsWith('attacks/'));

  it('parses at least one scanner import from src/index.ts (sanity)', () => {
    expect(allImports.length).toBeGreaterThan(20);
  });

  it('every static (non-attacks/) scanner import is returned by getAllScanners()', () => {
    expect(getAllScanners().length).toBe(staticImports.length);
  });

  it('every attacks/ scanner import is returned by getAttackScanners()', () => {
    expect(getAttackScanners().length).toBe(attackImports.length);
  });

  it('getAllScanners() and getAttackScanners() are disjoint (no active probe leaks into default scan)', () => {
    const staticNames = new Set(getAllScanners().map((s) => s.name));
    const attackNames = new Set(getAttackScanners().map((s) => s.name));
    for (const name of attackNames) {
      expect(staticNames.has(name)).toBe(false);
    }
  });

  it('getAllScanners() returns scanner objects with required fields', () => {
    for (const scanner of getAllScanners()) {
      expect(typeof scanner.name).toBe('string');
      expect(scanner.name.length).toBeGreaterThan(0);
      expect(typeof scanner.scan).toBe('function');
      expect(typeof scanner.isAvailable).toBe('function');
    }
  });

  it('every scanner name is unique across getAllScanners()', () => {
    const names = getAllScanners().map((s) => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('every attacks/ import has path under attacks/ subdir (organization invariant)', () => {
    for (const imp of attackImports) {
      expect(imp.path).toMatch(/^attacks\//);
    }
  });

  it('payment-flow-checker is registered in default scanner set (v0.17.7 F-PRICE-TAMPER-1)', () => {
    const names = new Set(getAllScanners().map((s) => s.name));
    expect(names.has('payment-flow-checker')).toBe(true);
  });

  it('edge-function-auth-checker is registered in default scanner set (v0.17.7 F-EDGE-FUNCTION-AUTH-1)', () => {
    const names = new Set(getAllScanners().map((s) => s.name));
    expect(names.has('edge-function-auth-checker')).toBe(true);
  });

  it('attack scanners include all five active-probe modules (siege/pentest legal-scope set)', () => {
    const names = new Set(getAttackScanners().map((s) => s.name));
    for (const expected of [
      'auth-probe',
      'header-probe',
      'rate-limit-probe',
      'privesc-probe',
      'race-probe',
    ]) {
      expect(names.has(expected)).toBe(true);
    }
  });

  // v0.17.8 MED-002 — identity-checked parity, not just count parity.
  // Pre-v0.17.8 a refactor that renamed an imported identifier and
  // forgot to update getAllScanners() would still pass as long as the
  // total count was preserved (e.g. accidental swap-one-for-another).
  //
  // The check below derives two expected slugs from each imported
  // identifier — with and without the trailing "Scanner" suffix — to
  // accommodate the project's two co-existing naming conventions:
  //   - paymentFlowCheckerScanner -> "payment-flow-checker"      (suffix dropped)
  //   - entropyScanner            -> "entropy-scanner"           (suffix retained)
  //   - pentestSwarmScanner       -> "pentestswarm"              (single token)
  // The dashes-stripped lowercase form of the registered scanner.name
  // must match one of those two slugs.
  it('every imported scanner identifier maps to a scanner.name in its respective registry (identity check)', () => {
    const normalizeName = (name: string) => name.replace(/-/g, '').toLowerCase();
    const expectedSlugs = (id: string) => {
      const stripped = id.replace(/Scanner$/, '').toLowerCase();
      const full = id.toLowerCase();
      return new Set([stripped, full]);
    };

    const staticNormalized = new Set(getAllScanners().map((s) => normalizeName(s.name)));
    for (const imp of staticImports) {
      const slugs = expectedSlugs(imp.identifier);
      const matched = [...slugs].some((slug) => staticNormalized.has(slug));
      if (!matched) {
        throw new Error(
          `static scanner import "${imp.identifier}" has no matching getAllScanners() entry ` +
            `(expected one of [${[...slugs].join(', ')}], registry has [${[...staticNormalized].join(', ')}])`,
        );
      }
      expect(matched).toBe(true);
    }

    const attackNormalized = new Set(getAttackScanners().map((s) => normalizeName(s.name)));
    for (const imp of attackImports) {
      const slugs = expectedSlugs(imp.identifier);
      const matched = [...slugs].some((slug) => attackNormalized.has(slug));
      expect(matched).toBe(true);
    }
  });
});
