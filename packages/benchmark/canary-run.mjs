#!/usr/bin/env node
/**
 * AEGIS Canary Runner — v0.10 Recall-Honesty Phase 1 harness validation.
 *
 * Iterates canary-fixtures/phaseN/*\/ directories. Each fixture:
 *   - is its own Next.js-shaped project root (so scanner path-filters hit)
 *   - contains one intentional vuln pattern
 *   - declares its expected {scanner, cwe} in expected.json
 *
 * The runner asserts at least one finding matches each expected pair.
 * Additional findings (e.g. taint-tracker overlap) are tolerated.
 *
 * Exit 0 = all canaries emit as expected (TP caught). Exit 1 = any FN.
 *
 * Usage:   node packages/benchmark/canary-run.mjs [phase]
 *          node packages/benchmark/canary-run.mjs phase1-harness   (default)
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadConfig, Orchestrator } = require('../core/dist/index.js');
const { getAllScanners } = require('../scanners/dist/index.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const phase = process.argv[2] ?? 'phase1-harness';
const phaseDir = join(__dirname, 'canary-fixtures', phase);

console.log(`AEGIS Canary Runner — ${phase}\n`);

let fixtures;
try {
  fixtures = readdirSync(phaseDir)
    .filter((name) => {
      const full = join(phaseDir, name);
      return statSync(full).isDirectory();
    })
    .sort();
} catch (err) {
  console.error(`ERROR: cannot read ${phaseDir}:`, err.message);
  process.exit(2);
}

if (fixtures.length === 0) {
  console.error(`ERROR: no fixtures found under ${phaseDir}`);
  process.exit(2);
}

const results = [];

for (const name of fixtures) {
  const fixtureDir = join(phaseDir, name);
  const expectedPath = join(fixtureDir, 'expected.json');

  let expected;
  try {
    expected = JSON.parse(readFileSync(expectedPath, 'utf-8'));
  } catch (err) {
    console.log(`  SKIP  ${name}: no expected.json (${err.message})`);
    results.push({ name, status: 'SKIP', reason: 'missing expected.json' });
    continue;
  }

  const config = await loadConfig(fixtureDir, 'scan');
  const orchestrator = new Orchestrator();
  for (const scanner of getAllScanners()) {
    orchestrator.register(scanner);
  }
  const result = await orchestrator.run(config);

  const misses = [];
  const hits = [];
  for (const pair of expected.expected) {
    const acceptedScanners = Array.isArray(pair.scanner)
      ? pair.scanner
      : [pair.scanner];
    const match = result.findings.find(
      (f) => acceptedScanners.includes(f.scanner) && f.cwe === pair.cwe,
    );
    if (match) {
      hits.push({ ...pair, matchedScanner: match.scanner });
    } else {
      misses.push(pair);
    }
  }

  if (expected.type === 'TP') {
    if (misses.length === 0) {
      console.log(
        `  PASS  ${expected.id} ${name}: ${hits
          .map((h) => `${h.matchedScanner}/CWE-${h.cwe}`)
          .join(', ')} (+${result.findings.length - hits.length} extra)`,
      );
      results.push({ name, status: 'PASS', hits, misses });
    } else {
      console.log(
        `  FAIL  ${expected.id} ${name}: missed ${misses
          .map(
            (m) =>
              `${Array.isArray(m.scanner) ? m.scanner.join('|') : m.scanner}/CWE-${m.cwe}`,
          )
          .join(', ')}`,
      );
      console.log(
        `        findings-seen: ${
          result.findings.length === 0
            ? '(none)'
            : result.findings
                .map((f) => `${f.scanner}/CWE-${f.cwe ?? '?'}`)
                .slice(0, 8)
                .join(', ')
        }`,
      );
      results.push({
        name,
        status: 'FAIL',
        hits,
        misses,
        allFindings: result.findings,
      });
    }
  } else if (expected.type === 'FP') {
    // FP canaries assert the scanner does NOT fire (used for suppression proofs).
    // Only findings matching the declared expected.scanner+cwe count as FPs —
    // collateral findings from other scanners are healthy noise and ignored.
    const unwanted = result.findings.filter((f) =>
      expected.expected.some((p) => {
        const acceptedScanners = Array.isArray(p.scanner)
          ? p.scanner
          : [p.scanner];
        return acceptedScanners.includes(f.scanner) && f.cwe === p.cwe;
      }),
    );
    if (unwanted.length === 0) {
      console.log(`  PASS  ${expected.id} ${name}: no unwanted findings`);
      results.push({ name, status: 'PASS' });
    } else {
      console.log(
        `  FAIL  ${expected.id} ${name}: ${unwanted.length} unwanted finding(s)`,
      );
      results.push({ name, status: 'FAIL', unwanted });
    }
  }
}

const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
const skipped = results.filter((r) => r.status === 'SKIP').length;

console.log(
  `\n${passed}/${results.length} passed · ${failed} failed · ${skipped} skipped`,
);

if (failed > 0) {
  console.log('CANARY RUN FAILED');
  process.exit(1);
}
console.log('All canaries passed');
process.exit(0);
