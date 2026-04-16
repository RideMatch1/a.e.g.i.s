import { describe, it, expect, vi } from 'vitest';
import { Orchestrator } from '../src/orchestrator.js';
import type { Scanner, AegisConfig, ScanResult, Finding } from '../src/types.js';

const baseConfig: AegisConfig = {
  projectPath: '/tmp/test-project',
  stack: {
    framework: 'nextjs',
    database: 'supabase',
    auth: 'supabase-auth',
    ai: 'none',
    payment: 'none',
    deploy: 'docker',
    language: 'typescript',
    hasI18n: false,
    hasTests: true,
  },
  mode: 'scan',
};

function makeScanner(
  name: string,
  available: boolean,
  findings: Finding[] = [],
  shouldThrow = false,
): Scanner {
  return {
    name,
    description: `Test scanner: ${name}`,
    category: 'security',
    isAvailable: vi.fn().mockResolvedValue(available),
    scan: vi.fn().mockImplementation(async () => {
      if (shouldThrow) throw new Error(`Scanner ${name} failed`);
      const result: ScanResult = {
        scanner: name,
        category: 'security',
        findings,
        duration: 10,
        available: true,
      };
      return result;
    }),
  };
}

describe('Orchestrator — basic operation', () => {
  it('runs registered scanners and returns AuditResult', async () => {
    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('scanner-a', true));

    const result = await orchestrator.run(baseConfig);

    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('badge');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('scanResults');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('stack');
    expect(result).toHaveProperty('duration');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('confidence');
  });

  it('returns valid ISO timestamp', async () => {
    const orchestrator = new Orchestrator();
    const result = await orchestrator.run(baseConfig);
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('includes positive duration', async () => {
    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('scanner-a', true));
    const result = await orchestrator.run(baseConfig);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe('Orchestrator — parallel execution', () => {
  it('runs multiple scanners in parallel', async () => {
    const orchestrator = new Orchestrator();
    const callOrder: string[] = [];

    const scannerA: Scanner = {
      name: 'scanner-a',
      description: 'Scanner A',
      category: 'security',
      isAvailable: vi.fn().mockResolvedValue(true),
      scan: vi.fn().mockImplementation(async () => {
        callOrder.push('a-start');
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push('a-end');
        return { scanner: 'scanner-a', category: 'security', findings: [], duration: 10, available: true } as ScanResult;
      }),
    };

    const scannerB: Scanner = {
      name: 'scanner-b',
      description: 'Scanner B',
      category: 'dependencies',
      isAvailable: vi.fn().mockResolvedValue(true),
      scan: vi.fn().mockImplementation(async () => {
        callOrder.push('b-start');
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push('b-end');
        return { scanner: 'scanner-b', category: 'dependencies', findings: [], duration: 10, available: true } as ScanResult;
      }),
    };

    orchestrator.register(scannerA);
    orchestrator.register(scannerB);

    await orchestrator.run(baseConfig);

    // Both start before either ends (parallel)
    const aStartIdx = callOrder.indexOf('a-start');
    const bStartIdx = callOrder.indexOf('b-start');
    const aEndIdx = callOrder.indexOf('a-end');
    const bEndIdx = callOrder.indexOf('b-end');

    expect(aStartIdx).toBeGreaterThanOrEqual(0);
    expect(bStartIdx).toBeGreaterThanOrEqual(0);
    // Both should have started before either of them ended (parallel execution)
    expect(Math.max(aStartIdx, bStartIdx)).toBeLessThan(Math.min(aEndIdx, bEndIdx));
  });

  it('returns scanResults for all registered scanners', async () => {
    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('scanner-a', true));
    orchestrator.register(makeScanner('scanner-b', true));
    orchestrator.register(makeScanner('scanner-c', true));

    const result = await orchestrator.run(baseConfig);
    expect(result.scanResults).toHaveLength(3);
  });
});

describe('Orchestrator — skips unavailable scanners', () => {
  it('skips scanner when isAvailable returns false', async () => {
    const orchestrator = new Orchestrator();
    const unavailableScanner = makeScanner('unavailable', false);
    orchestrator.register(unavailableScanner);

    const result = await orchestrator.run(baseConfig);

    expect(unavailableScanner.scan).not.toHaveBeenCalled();
    expect(result.scanResults[0].available).toBe(false);
    expect(result.scanResults[0].findings).toHaveLength(0);
  });

  it('still runs available scanners when another is unavailable', async () => {
    const orchestrator = new Orchestrator();
    const availableScanner = makeScanner('available', true);
    const unavailableScanner = makeScanner('unavailable', false);

    orchestrator.register(availableScanner);
    orchestrator.register(unavailableScanner);

    const result = await orchestrator.run(baseConfig);

    expect(availableScanner.scan).toHaveBeenCalledOnce();
    expect(unavailableScanner.scan).not.toHaveBeenCalled();
    expect(result.scanResults).toHaveLength(2);
  });
});

describe('Orchestrator — error handling', () => {
  it('does not crash when a scanner throws', async () => {
    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('failing-scanner', true, [], true));

    await expect(orchestrator.run(baseConfig)).resolves.toBeDefined();
  });

  it('captures error in scanResult when scanner throws', async () => {
    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('failing-scanner', true, [], true));

    const result = await orchestrator.run(baseConfig);
    const failedResult = result.scanResults.find((r) => r.scanner === 'failing-scanner');

    expect(failedResult).toBeDefined();
    expect(failedResult!.error).toContain('failing-scanner failed');
    expect(failedResult!.findings).toHaveLength(0);
  });

  it('still aggregates findings from successful scanners when one fails', async () => {
    const finding: Finding = {
      id: 'f-1',
      scanner: 'good-scanner',
      category: 'security',
      severity: 'high',
      title: 'Test Issue',
      description: 'A test issue',
    };

    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('good-scanner', true, [finding]));
    orchestrator.register(makeScanner('bad-scanner', true, [], true));

    const result = await orchestrator.run(baseConfig);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].id).toBe('f-1');
  });

  it('handles isAvailable throwing gracefully', async () => {
    const brokenScanner: Scanner = {
      name: 'broken-check',
      description: 'Broken availability check',
      category: 'security',
      isAvailable: vi.fn().mockRejectedValue(new Error('which failed')),
      scan: vi.fn(),
    };

    const orchestrator = new Orchestrator();
    orchestrator.register(brokenScanner);

    const result = await orchestrator.run(baseConfig);
    expect(brokenScanner.scan).not.toHaveBeenCalled();
    expect(result.scanResults[0].available).toBe(false);
  });
});

describe('Orchestrator — finding aggregation', () => {
  it('aggregates findings from multiple scanners', async () => {
    const finding1: Finding = {
      id: 'f-1', scanner: 'scanner-a', category: 'security',
      severity: 'high', title: 'Issue A', description: 'Desc A',
    };
    const finding2: Finding = {
      id: 'f-2', scanner: 'scanner-b', category: 'dependencies',
      severity: 'medium', title: 'Issue B', description: 'Desc B',
    };

    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('scanner-a', true, [finding1]));
    orchestrator.register(makeScanner('scanner-b', true, [finding2]));

    const result = await orchestrator.run(baseConfig);
    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((f) => f.id)).toContain('f-1');
    expect(result.findings.map((f) => f.id)).toContain('f-2');
  });

  it('passes findings to calculateScore and reflects in result', async () => {
    const finding: Finding = {
      id: 'blocker-1', scanner: 'scanner-a', category: 'security',
      severity: 'blocker', title: 'Critical Vuln', description: 'Very bad',
    };

    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('scanner-a', true, [finding]));

    const result = await orchestrator.run(baseConfig);
    expect(result.blocked).toBe(true);
    expect(result.score).toBe(0);
  });
});

describe('Orchestrator — empty orchestrator', () => {
  it('handles no registered scanners gracefully', async () => {
    const orchestrator = new Orchestrator();
    const result = await orchestrator.run(baseConfig);

    expect(result.scanResults).toHaveLength(0);
    expect(result.findings).toHaveLength(0);
    expect(result.score).toBe(1000);
    // With 0 security scanners, confidence is low — S capped to A
    expect(result.grade).toBe('A');
    expect(result.confidence).toBe('low');
  });
});

describe('Orchestrator — diff mode filtering', () => {
  it('filters findings to only changed files when diffFiles is set', async () => {
    const finding1: Finding = {
      id: 'f-1', scanner: 'scanner-a', category: 'security',
      severity: 'high', title: 'Issue in changed file', description: 'Desc',
      file: '/tmp/project/changed.ts',
    };
    const finding2: Finding = {
      id: 'f-2', scanner: 'scanner-a', category: 'security',
      severity: 'high', title: 'Issue in unchanged file', description: 'Desc',
      file: '/tmp/project/unchanged.ts',
    };

    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('scanner-a', true, [finding1, finding2]));

    const configWithDiff = {
      ...baseConfig,
      diffFiles: ['/tmp/project/changed.ts'],
    };

    const result = await orchestrator.run(configWithDiff);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].file).toBe('/tmp/project/changed.ts');
  });

  it('excludes findings without file in diff mode', async () => {
    const finding: Finding = {
      id: 'f-1', scanner: 'scanner-a', category: 'security',
      severity: 'high', title: 'Project-level issue', description: 'Desc',
    };

    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('scanner-a', true, [finding]));

    const configWithDiff = {
      ...baseConfig,
      diffFiles: ['/tmp/project/changed.ts'],
    };

    const result = await orchestrator.run(configWithDiff);
    expect(result.findings).toHaveLength(0);
  });

  it('returns all findings when diffFiles is not set', async () => {
    const finding1: Finding = {
      id: 'f-1', scanner: 'scanner-a', category: 'security',
      severity: 'high', title: 'Issue A', description: 'Desc',
      file: '/tmp/project/file-a.ts',
    };
    const finding2: Finding = {
      id: 'f-2', scanner: 'scanner-a', category: 'security',
      severity: 'medium', title: 'Issue B', description: 'Desc',
      file: '/tmp/project/file-b.ts',
    };

    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('scanner-a', true, [finding1, finding2]));

    const result = await orchestrator.run(baseConfig);
    expect(result.findings).toHaveLength(2);
  });

  it('returns all findings when diffFiles is empty array', async () => {
    const finding: Finding = {
      id: 'f-1', scanner: 'scanner-a', category: 'security',
      severity: 'high', title: 'Issue', description: 'Desc',
      file: '/tmp/project/file.ts',
    };

    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('scanner-a', true, [finding]));

    const configWithEmptyDiff = {
      ...baseConfig,
      diffFiles: [],
    };

    const result = await orchestrator.run(configWithEmptyDiff);
    expect(result.findings).toHaveLength(1);
  });
});

describe('Orchestrator — confidence calculation', () => {
  // Confidence is now based on EXTERNAL security scanners only.
  // Custom in-process scanners (auth-enforcer, crypto-auditor, etc.) are excluded.
  // Generic test scanner names (sec-1, sec-2) count as external.

  it('returns low confidence when 0 external security scanners ran', async () => {
    const orchestrator = new Orchestrator();
    // Register only custom scanners — they are excluded from confidence calculation
    orchestrator.register(makeScanner('auth-enforcer', true));
    orchestrator.register(makeScanner('crypto-auditor', true));

    const result = await orchestrator.run(baseConfig);
    expect(result.confidence).toBe('low');
  });

  it('returns medium confidence when 1 security-external scanner ran', async () => {
    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('semgrep', true));

    const result = await orchestrator.run(baseConfig);
    expect(result.confidence).toBe('medium');
  });

  it('returns high confidence when >= 2 security-external scanners ran', async () => {
    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('semgrep', true));
    orchestrator.register(makeScanner('gitleaks', true));

    const result = await orchestrator.run(baseConfig);
    expect(result.confidence).toBe('high');
  });

  it('does not count unavailable external scanners toward confidence', async () => {
    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('semgrep', true));
    orchestrator.register(makeScanner('gitleaks', false)); // unavailable
    orchestrator.register(makeScanner('nuclei', false)); // unavailable

    const result = await orchestrator.run(baseConfig);
    // Only 1 available external scanner, so medium
    expect(result.confidence).toBe('medium');
  });

  it('does not count custom scanners toward confidence', async () => {
    const orchestrator = new Orchestrator();
    orchestrator.register(makeScanner('auth-enforcer', true));
    orchestrator.register(makeScanner('crypto-auditor', true));
    orchestrator.register(makeScanner('config-auditor', true));
    orchestrator.register(makeScanner('header-checker', true));
    orchestrator.register(makeScanner('zod-enforcer', true));
    orchestrator.register(makeScanner('rate-limit-checker', true));
    orchestrator.register(makeScanner('entropy-scanner', true));

    const result = await orchestrator.run(baseConfig);
    // All are custom — no external scanners counted
    expect(result.confidence).toBe('low');
  });
});

describe('Orchestrator — suppression pipeline sanity (E2E)', () => {
  // Validator #4: Guard against future regressions where a scanner emits
  // findings without file/line or the pipeline silently becomes a no-op.
  // Uses real file I/O (tmpdir) so the inline-suppression read path runs.
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');

  function makeProject(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'aegis-e2e-'));
    for (const [rel, content] of Object.entries(files)) {
      const parts = rel.split('/');
      const sub = parts.slice(0, -1).join('/');
      if (sub) mkdirSync(join(dir, sub), { recursive: true });
      writeFileSync(join(dir, rel), content);
    }
    return dir;
  }

  it('inline // aegis-ignore suppresses a non-taint scanner finding', async () => {
    const projectPath = makeProject({
      'src/route.ts': [
        '// aegis-ignore — this public endpoint is by design',
        'export async function GET() { return new Response(); }',
      ].join('\n'),
    });
    try {
      const orchestrator = new Orchestrator();
      orchestrator.register(
        makeScanner('auth-enforcer', true, [
          {
            id: 'A-1', scanner: 'auth-enforcer', category: 'security',
            severity: 'high', title: 'missing auth',
            description: 'route has no auth guard',
            file: join(projectPath, 'src/route.ts'), line: 2, cwe: 522,
          },
        ]),
      );
      const result = await orchestrator.run({ ...baseConfig, projectPath });
      expect(result.findings).toHaveLength(0);
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it('config-level suppression filters findings across multiple scanners', async () => {
    const projectPath = makeProject({
      'src/legacy/old.ts': 'export function x() {}',
      'src/new/fresh.ts': 'export function y() {}',
    });
    try {
      const orchestrator = new Orchestrator();
      orchestrator.register(
        makeScanner('auth-enforcer', true, [{
          id: 'A-1', scanner: 'auth-enforcer', category: 'security',
          severity: 'high', title: 'no auth', description: 'x',
          file: join(projectPath, 'src/legacy/old.ts'), line: 1, cwe: 522,
        }]),
      );
      orchestrator.register(
        makeScanner('csrf-checker', true, [
          {
            id: 'C-1', scanner: 'csrf-checker', category: 'security',
            severity: 'high', title: 'csrf', description: 'x',
            file: join(projectPath, 'src/legacy/old.ts'), line: 1, cwe: 352,
          },
          {
            id: 'C-2', scanner: 'csrf-checker', category: 'security',
            severity: 'high', title: 'csrf', description: 'x',
            file: join(projectPath, 'src/new/fresh.ts'), line: 1, cwe: 352,
          },
        ]),
      );
      const result = await orchestrator.run({
        ...baseConfig,
        projectPath,
        suppressions: [{
          file: 'src/legacy/**',
          reason: 'legacy endpoints scheduled for removal next quarter',
        }],
      });
      // Only the fresh.ts csrf finding survives
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].file).toContain('fresh.ts');
    } finally {
      rmSync(projectPath, { recursive: true, force: true });
    }
  });
});
