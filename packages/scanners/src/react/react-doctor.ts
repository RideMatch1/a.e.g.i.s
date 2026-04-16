import { exec, commandExists, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { join } from 'path';

async function hasReactDependency(projectPath: string): Promise<boolean> {
  const pkgJsonPath = join(projectPath, 'package.json');
  const content = readFileSafe(pkgJsonPath);
  if (content === null) return false;
  try {
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return 'react' in (pkg.dependencies ?? {}) || 'react' in (pkg.devDependencies ?? {});
  } catch {
    return false;
  }
}

function extractScore(stdout: string): number | null {
  // react-doctor outputs something like "Score: 96/100" or "96/100"
  const patterns = [
    /score[:\s]+(\d+)\s*\/\s*100/i,
    /(\d+)\s*\/\s*100/,
    /react.doctor.*?(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = stdout.match(pattern);
    if (match) {
      const score = parseInt(match[1], 10);
      if (!isNaN(score) && score >= 0 && score <= 100) return score;
    }
  }
  return null;
}

export const reactDoctorScanner: Scanner = {
  name: 'react-doctor',
  description: 'React code quality check via react-doctor (score threshold: 93)',
  category: 'quality',

  async isAvailable(_projectPath: string): Promise<boolean> {
    // Only check if npx is available — React dependency is checked in scan() with projectPath
    return commandExists('npx');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const hasReact = await hasReactDependency(projectPath);
    if (!hasReact) {
      return { scanner: 'react-doctor', category: 'quality', findings: [], duration: Date.now() - start, available: true };
    }

    const result = await exec('npx', ['-y', 'react-doctor@latest', projectPath]);
    const output = result.stdout + result.stderr;
    const score = extractScore(output);

    const findings: Finding[] = [];

    if (score === null) {
      findings.push({
        id: 'REACT-001',
        scanner: 'react-doctor',
        severity: 'info',
        title: 'React Doctor: could not parse score',
        description: `react-doctor ran but the score could not be extracted from its output. Raw output: ${output.slice(0, 300)}`,
        category: 'quality',
      });
    } else if (score < 80) {
      findings.push({
        id: 'REACT-001',
        scanner: 'react-doctor',
        severity: 'critical',
        title: `React Doctor score critically low: ${score}/100`,
        description: `react-doctor score is ${score}/100 — below the critical threshold of 80. This indicates serious React anti-patterns (missing keys, conditional hooks, non-memoised expensive renders, etc.). The quality gate requires ≥93.`,
        category: 'quality',
      });
    } else if (score < 93) {
      findings.push({
        id: 'REACT-001',
        scanner: 'react-doctor',
        severity: 'high',
        title: `React Doctor score below threshold: ${score}/100`,
        description: `react-doctor score is ${score}/100 — below the required threshold of 93. Review the react-doctor output to identify and fix React anti-patterns.`,
        category: 'quality',
      });
    }

    return {
      scanner: 'react-doctor',
      category: 'quality',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
