#!/usr/bin/env node
// Phase 10b: Triage vibecoded scan output
//
// Filters out known FP classes (template-sql tRPC over-match, doc/lockfile noise)
// and surfaces high-confidence finding classes.

import fs from 'node:fs';
import path from 'node:path';

const SCANS_DIR = process.argv[2] || `${process.env.HOME}/findings/vibecoded-fresh-20260429/scans`;

// Known FP-prone scanners on this corpus class — DON'T trust without manual review
const LOW_CONFIDENCE_SCANNERS = new Set([
  'template-sql-checker',  // tRPC procedure-builder + ORM-safe FP-storm in v0.17.0
  'sql-concat-checker',    // overlaps with template-sql, similar issues
  'console-checker',       // dev-only, not security
  'logging-checker',       // not exploitable
  'header-checker',        // CSP/HSTS — defensive hardening, not bountable per most policies
  'i18n-quality',          // localization, not security
  'pagination-checker',    // perf, not security
  'react-doctor',          // quality, not security
]);

// File-path patterns that indicate test/example/doc context (skip findings here)
const NOISE_PATH = /(^|\/)(\.next|node_modules|dist|build|coverage|out|\.git|\.turbo)\//
                || /\/(test|tests|__tests__|spec|fixtures?|playwright|cypress|e2e)\//i
                || /\.test\.|\.spec\./i
                || /\/(docs?|examples?|samples?|references?)\//i
                || /(README|CHANGELOG|LICENSE|CONTRIBUTING|SECURITY)\.md$/
                || /\.(md|mdx)$/i
                || /(yarn|package|pnpm-)?lock\.(json|ya?ml)$/i
                || /\.(env\.example|env\.sample|env\.local\.example|env\.template)$/i
                || /(i18n|locales?|translations?)\.(json|lock|yaml|yml)$/i
                || /\.(yaml|yml)$/i;  // config file noise — many trufflehog FPs in YAML

function looksLikeNoisePath(file) {
  if (!file) return true;
  return /(^|\/)(\.next|node_modules|dist|build|coverage|out|\.git|\.turbo)\//.test(file)
      || /\/(test|tests|__tests__|spec|fixtures?|playwright|cypress|e2e)\//i.test(file)
      || /\.test\.|\.spec\./i.test(file)
      || /\/(docs?|examples?|samples?|references?)\//i.test(file)
      || /(README|CHANGELOG|LICENSE|CONTRIBUTING|SECURITY)\.md$/i.test(file)
      || /\.(md|mdx)$/i.test(file)
      || /(yarn|pnpm-)?lock\.(json|ya?ml)$/i.test(file)
      || /package-lock\.json$/i.test(file)
      || /\.(env\.example|env\.sample|env\.local\.example|env\.template)$/i.test(file)
      || /(i18n|locales?|translations?)\.(json|lock|yaml|yml)$/i.test(file);
}

const files = fs.readdirSync(SCANS_DIR).filter(f => f.endsWith('.json'));
console.log(`# AEGIS Vibecoded Triage — ${files.length} scans\n`);

const ranked = [];

for (const f of files) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(SCANS_DIR, f), 'utf8'));
  } catch (e) {
    console.log(`SKIP ${f}: parse error`);
    continue;
  }
  const repo = f.replace('.json', '').replace('_', '/');

  // High-confidence findings filter:
  // - severity = critical OR high
  // - scanner NOT in LOW_CONFIDENCE
  // - file NOT in noise paths
  const findings = (data.findings || [])
    .filter(x => x.severity === 'critical' || x.severity === 'high' || x.severity === 'blocker')
    .filter(x => !LOW_CONFIDENCE_SCANNERS.has(x.scanner))
    .filter(x => !looksLikeNoisePath(x.file));

  // Extra: gitleaks/trufflehog secret findings — only keep if file is in source path (src/, app/, lib/, api/)
  const secretFindings = findings.filter(x => x.scanner === 'gitleaks' || x.scanner === 'trufflehog');
  const sourceSecretFindings = secretFindings.filter(x => /\/(src|app|lib|api|server|backend|pages|components)\//i.test(x.file || ''));

  const aegisCoreFindings = findings.filter(x =>
    ['supabase-migration-checker', 'tenant-isolation-checker', 'rls-bypass-checker',
     'auth-enforcer', 'middleware-auth-checker', 'mass-assignment-checker',
     'next-public-leak', 'env-validation-checker', 'csrf-checker', 'cors-checker',
     'cookie-checker', 'open-redirect-checker', 'path-traversal-checker',
     'ssrf-checker', 'jwt-checker', 'crypto-auditor', 'xss-checker',
     'rsc-data-checker', 'prompt-injection-checker'].includes(x.scanner)
  );

  const score = data.score || 0;
  const grade = data.grade || '?';
  ranked.push({
    repo,
    score,
    grade,
    findings_total: data.findings?.length || 0,
    findings_high_conf: findings.length,
    aegis_core: aegisCoreFindings.length,
    secrets_in_source: sourceSecretFindings.length,
    sample_aegis_core: aegisCoreFindings.slice(0, 3),
    sample_secrets: sourceSecretFindings.slice(0, 3),
  });
}

// Sort by aegis_core count desc, then secrets desc
ranked.sort((a, b) => (b.aegis_core - a.aegis_core) || (b.secrets_in_source - a.secrets_in_source));

console.log('## Ranked Targets (high-confidence findings)\n');
console.log('| Repo | Score | Grade | Total | High-Conf | AEGIS-Core | Src-Secrets |');
console.log('|---|---|---|---|---|---|---|');
for (const r of ranked) {
  console.log(`| ${r.repo} | ${r.score} | ${r.grade} | ${r.findings_total} | ${r.findings_high_conf} | ${r.aegis_core} | ${r.secrets_in_source} |`);
}

console.log('\n---\n## Top-5 Targets — Sample Findings\n');
for (const r of ranked.slice(0, 5)) {
  if (r.aegis_core === 0 && r.secrets_in_source === 0) continue;
  console.log(`### ${r.repo} (score ${r.score} / ${r.grade})`);
  if (r.aegis_core) {
    console.log(`\n**AEGIS-core findings (${r.aegis_core}):**`);
    for (const f of r.sample_aegis_core) {
      const file = (f.file || '').replace(/^.*\/clones\//, '').replace(/^[^/]+\//, '');
      console.log(`- [${f.scanner}] ${f.severity} — ${(f.title || '').slice(0,90)}`);
      console.log(`  → \`${file}:${f.line}\` (CWE-${f.cwe || '?'})`);
    }
  }
  if (r.secrets_in_source) {
    console.log(`\n**Secret findings in source paths (${r.secrets_in_source}):**`);
    for (const f of r.sample_secrets) {
      const file = (f.file || '').replace(/^.*\/clones\//, '').replace(/^[^/]+\//, '');
      console.log(`- [${f.scanner}] ${(f.title || '').slice(0,90)}`);
      console.log(`  → \`${file}:${f.line}\``);
    }
  }
  console.log('');
}
