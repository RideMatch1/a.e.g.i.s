import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { existsSync } from 'fs';
import { join } from 'path';

interface HadolintResult {
  line: number;
  code: string;
  message: string;
  column: number;
  file: string;
  level: string;
}

function mapSeverity(level: string): Finding['severity'] {
  switch (level.toLowerCase()) {
    case 'error':
      return 'high';
    case 'warning':
      return 'medium';
    case 'info':
    case 'style':
      return 'low';
    default:
      return 'info';
  }
}

export const hadolintScanner: Scanner = {
  name: 'hadolint',
  description: 'Dockerfile best-practice linting via Hadolint',
  category: 'infrastructure',
  isExternal: true,

  async isAvailable(_projectPath: string): Promise<boolean> {
    // Only check if hadolint is installed — Dockerfile existence is checked in scan()
    return commandExists('hadolint');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const dockerfilePath = existsSync(join(projectPath, 'Dockerfile'))
      ? join(projectPath, 'Dockerfile')
      : join(projectPath, 'dockerfile');

    if (!existsSync(dockerfilePath)) {
      return {
        scanner: 'hadolint',
        category: 'infrastructure',
        findings: [],
        duration: Date.now() - start,
        available: false,
        error: 'No Dockerfile found in project path',
      };
    }

    const result = await exec('hadolint', ['--format', 'json', dockerfilePath]);

    let parsed: HadolintResult[];
    try {
      parsed = JSON.parse(result.stdout || result.stderr) as HadolintResult[];
      if (!Array.isArray(parsed)) parsed = [];
    } catch {
      parsed = [];
    }

    const findings: Finding[] = parsed.map((r, idx) => ({
      id: `HADOLINT-${String(idx + 1).padStart(3, '0')}`,
      scanner: 'hadolint',
      severity: mapSeverity(r.level),
      title: `Dockerfile issue: ${r.code}`,
      description: r.message,
      file: r.file,
      line: r.line,
      category: 'infrastructure' as const,
    }));

    return {
      scanner: 'hadolint',
      category: 'infrastructure',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
