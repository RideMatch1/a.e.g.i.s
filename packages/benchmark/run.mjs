#!/usr/bin/env node
/**
 * AEGIS Benchmark Runner
 *
 * Part 1: Scans vulnerable fixtures — each MUST be detected by its expected scanner.
 * Part 2: Scans clean fixtures — each MUST NOT be flagged by its expected scanner.
 * Exit 0 = all pass. Exit 1 = any failure.
 *
 * Usage: node packages/benchmark/run.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadConfig, Orchestrator } = require('../core/dist/index.js');
const { getAllScanners } = require('../scanners/dist/index.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPath = join(__dirname, 'vulnerable-app');
const spec = JSON.parse(readFileSync(join(__dirname, 'expected.json'), 'utf-8'));

console.log('AEGIS Benchmark — Vulnerable Fixture App\n');

const config = await loadConfig(appPath, 'scan');
const orchestrator = new Orchestrator();
for (const scanner of getAllScanners()) {
  orchestrator.register(scanner);
}
const result = await orchestrator.run(config);

console.log(`Score: ${result.score}/1000 — ${result.grade} (${result.badge})`);
console.log(`Total findings: ${result.findings.length}\n`);

let failures = 0;

// --- Part 1: True Positives (must be found) ---
console.log(`True Positives (${Object.keys(spec.vulnerabilities).length} expected):\n`);

for (const [id, vuln] of Object.entries(spec.vulnerabilities)) {
  const match = result.findings.filter((f) =>
    (f.file?.includes(vuln.file) ?? false) && f.scanner === vuln.scanner
  );
  if (match.length > 0) {
    console.log(`  PASS  ${id}: ${vuln.description} [${vuln.scanner}]`);
  } else {
    failures++;
    console.log(`  FAIL  ${id}: ${vuln.description} [expected: ${vuln.scanner}]`);
  }
}

// --- Part 2: False Positives (must NOT be found) ---
console.log(`\nFalse Positive Checks (${Object.keys(spec.false_positives).length} clean files):\n`);

for (const [id, clean] of Object.entries(spec.false_positives)) {
  const falseHits = result.findings.filter((f) =>
    (f.file?.includes(clean.file) ?? false) && f.scanner === clean.scanner
  );
  if (falseHits.length === 0) {
    console.log(`  PASS  ${id}: ${clean.description} [no ${clean.scanner} findings]`);
  } else {
    failures++;
    console.log(`  FAIL  ${id}: ${clean.description} [${falseHits.length} false positive(s) from ${clean.scanner}]`);
  }
}

// --- Summary ---
const totalChecks = Object.keys(spec.vulnerabilities).length + Object.keys(spec.false_positives).length;
const passed = totalChecks - failures;

console.log(`\n${passed}/${totalChecks} checks passed`);

if (failures > 0) {
  console.log(`${failures} FAILED — benchmark FAILED`);
  process.exit(1);
} else {
  console.log('All checks passed — benchmark PASSED');
  process.exit(0);
}
