import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SemgrepResult {
  path: string;
  check_id: string;
  extra: {
    message: string;
    severity: string;
    lines?: string;
  };
  start: { line: number; col: number };
  end: { line: number; col: number };
}

interface SemgrepOutput {
  results: SemgrepResult[];
  errors?: unknown[];
}

/** Rule ID patterns that indicate dangerous vulnerabilities warranting blocker severity */
const BLOCKER_RULE_PATTERNS = [
  'sql-injection',
  'command-injection',
  'code-injection',
  'rce',
  'deserialization',
];

function mapSeverity(raw: string): Finding['severity'] {
  switch (raw.toUpperCase()) {
    case 'CRITICAL':
    case 'ERROR':
      return 'critical';
    case 'HIGH':
    case 'WARNING':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'info';
  }
}

function isBlockerRule(checkId: string): boolean {
  const lower = checkId.toLowerCase();
  return BLOCKER_RULE_PATTERNS.some((p) => lower.includes(p));
}

export const semgrepScanner: Scanner = {
  name: 'semgrep',
  description: 'Static analysis security testing via Semgrep with auto-config rule set',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('semgrep');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    // After tsc, __dirname = packages/scanners/dist/sast/
    // Rules are at packages/rules/semgrep/ (sibling package)
    // So we go up 4 levels: dist/sast/ -> dist/ -> scanners/ -> packages/ -> then into rules/semgrep/
    const customRulesDir = path.resolve(__dirname, '../../../../rules/semgrep');
    const args = ['--json'];
    if (existsSync(customRulesDir)) {
      args.push('--config', customRulesDir);
    }
    args.push('--config', 'auto', '--quiet', '--timeout', '30', projectPath);

    const result = await exec('semgrep', args);

    let parsed: SemgrepOutput;
    try {
      parsed = JSON.parse(result.stdout) as SemgrepOutput;
    } catch {
      return {
        scanner: 'semgrep',
        category: 'security',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `Failed to parse semgrep JSON output: ${result.stdout.slice(0, 200)}`,
      };
    }

    const findings: Finding[] = (parsed.results ?? []).map((r, idx) => {
      let severity = mapSeverity(r.extra.severity);
      // Upgrade ERROR-level findings to blocker when the rule matches dangerous patterns
      if (severity === 'critical' && isBlockerRule(r.check_id)) {
        severity = 'blocker';
      }
      return {
        id: `SEMGREP-${String(idx + 1).padStart(3, '0')}`,
        scanner: 'semgrep',
        severity,
        title: r.check_id,
        description: r.extra.message,
        file: r.path,
        line: r.start.line,
        category: 'security' as const,
      };
    });

    return {
      scanner: 'semgrep',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
