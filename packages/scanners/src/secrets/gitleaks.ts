import { existsSync } from 'fs';
import { join } from 'path';
import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { isSecretsNoisePath } from './path-allowlist.js';

interface GitleaksResult {
  Description: string;
  StartLine: number;
  EndLine: number;
  Match: string;
  File: string;
  RuleID: string;
  Commit?: string;
  Entropy?: number;
  Secret?: string;
}

export const gitleaksScanner: Scanner = {
  name: 'gitleaks',
  description: 'Secret detection via Gitleaks — scans for hardcoded credentials and API keys',
  category: 'security',
  isExternal: true,

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('gitleaks');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    // If the project has a .git directory, scan git history (the whole point).
    // Otherwise fall back to --no-git for non-git directories (file scan only).
    const hasGit = existsSync(join(projectPath, '.git'));

    const args = [
      'detect',
      '--source', projectPath,
      ...(hasGit ? [] : ['--no-git']),
      '--report-format', 'json',
      '--report-path', '-',
    ];

    const result = await exec('gitleaks', args);

    // gitleaks exits with code 1 when leaks are found — that's expected
    const rawOutput = result.stdout || result.stderr;

    let parsed: GitleaksResult[];
    try {
      parsed = JSON.parse(rawOutput) as GitleaksResult[];
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      // No leaks found or empty output
      parsed = [];
    }

    // v0.17.5 F5.1 — filter out noise paths (docs, lockfiles, tests,
    // OpenAPI examples, .env.example) to cut the ~95% corpus-FP rate.
    const filtered = parsed.filter((r) => !isSecretsNoisePath(r.File));

    const findings: Finding[] = filtered.map((r, idx) => ({
      id: `GITLEAKS-${String(idx + 1).padStart(3, '0')}`,
      scanner: 'gitleaks',
      severity: 'blocker' as const,
      title: `Secret detected: ${r.RuleID}`,
      description: `${r.Description} in ${r.File}:${r.StartLine}. Remove this secret and rotate the credential immediately.`,
      file: r.File,
      line: r.StartLine,
      category: 'security' as const,
    }));

    return {
      scanner: 'gitleaks',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
