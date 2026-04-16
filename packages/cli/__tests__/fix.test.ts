import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE any imports that trigger them
// ---------------------------------------------------------------------------

const mockRun = vi.fn();
const mockRegister = vi.fn();
const mockLoadConfig = vi.fn();
const mockReadFileSafe = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock('@aegis-scan/core', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  Orchestrator: vi.fn().mockImplementation(() => ({
    register: mockRegister,
    run: mockRun,
  })),
  readFileSafe: (...args: unknown[]) => mockReadFileSafe(...args),
  walkFiles: vi.fn().mockReturnValue([]),
  exec: vi.fn(),
  detectStack: vi.fn(),
}));

vi.mock('@aegis-scan/scanners', () => ({
  getAllScanners: vi.fn(() => [
    { name: 'mock-scanner', category: 'security', isAvailable: vi.fn(), scan: vi.fn() },
  ]),
}));

vi.mock('@aegis-scan/reporters', () => ({
  terminalReporter: { name: 'terminal', format: vi.fn(() => 'mock terminal output') },
  jsonReporter: { name: 'json', format: vi.fn(() => '{}') },
  sarifReporter: { name: 'sarif', format: vi.fn(() => '{}') },
  htmlReporter: { name: 'html', format: vi.fn(() => '<html></html>') },
}));

vi.mock('ora', () => {
  const createOra = () => {
    const instance: Record<string, unknown> = {
      text: '',
      start: vi.fn(),
      stop: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
    };
    (instance.start as ReturnType<typeof vi.fn>).mockReturnValue(instance);
    (instance.stop as ReturnType<typeof vi.fn>).mockReturnValue(instance);
    (instance.fail as ReturnType<typeof vi.fn>).mockReturnValue(instance);
    (instance.warn as ReturnType<typeof vi.fn>).mockReturnValue(instance);
    return instance;
  };
  return { default: vi.fn(createOra) };
});

vi.mock('chalk', () => {
  const fn = (s: string) => s;
  const red = Object.assign(fn, { bold: fn });
  const chainable = Object.assign(fn, {
    bold: fn, dim: fn, cyan: fn, green: fn, yellow: fn, red, level: 3,
  });
  return { default: chainable };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { runFix } from '../src/commands/fix.js';
import type { Finding, AuditResult } from '@aegis-scan/core';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeConfig() {
  return {
    projectPath: '/test',
    stack: { framework: 'nextjs', database: 'supabase' },
    mode: 'scan',
    ignore: [],
  };
}

function makeAuditResult(findings: Finding[] = []): AuditResult {
  return {
    score: 800,
    grade: 'A',
    badge: 'HARDENED',
    blocked: false,
    breakdown: {} as AuditResult['breakdown'],
    findings,
    scanResults: [],
    stack: { framework: 'nextjs' } as AuditResult['stack'],
    duration: 100,
    timestamp: new Date().toISOString(),
    confidence: 'high',
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'F001',
    scanner: 'auth-enforcer',
    category: 'security',
    severity: 'high',
    title: 'Missing auth guard',
    description: 'No secureApiRouteWithTenant call found',
    file: '/test/src/api/route.ts',
    line: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runFix', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockLoadConfig.mockResolvedValue(makeConfig());
    mockRun.mockResolvedValue(makeAuditResult());
    mockReadFileSafe.mockReturnValue(null);
    mockWriteFileSync.mockClear();
    mockWriteFileSync.mockImplementation(() => undefined);
    mockRegister.mockClear();
    mockRun.mockClear();
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // ----- No findings -----

  it('returns 0 when there are no fixable findings', async () => {
    mockRun.mockResolvedValueOnce(makeAuditResult([]));
    const code = await runFix('.', {});
    expect(code).toBe(0);
  });

  // ----- --finding flag -----

  it('returns 1 when --finding id is not found', async () => {
    mockRun.mockResolvedValueOnce(makeAuditResult([makeFinding()]));
    const code = await runFix('.', { finding: 'NONEXISTENT' });
    expect(code).toBe(1);
  });

  it('applies fix for a specific --finding id', async () => {
    const finding = makeFinding({ file: '/test/route.ts' });
    // First scan (to find findings), second scan (re-scan after fix)
    mockRun.mockResolvedValueOnce(makeAuditResult([finding]));
    mockRun.mockResolvedValueOnce(makeAuditResult([]));
    mockReadFileSafe.mockReturnValue('export default function handler() {}');

    const code = await runFix('.', { finding: 'F001' });

    // 2 writes per fix: backup (.aegis.bak) + actual fix
    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
    const [writePath, content] = mockWriteFileSync.mock.calls[1] as [string, string];
    expect(writePath).toBe('/test/route.ts');
    expect(content).toContain("import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';");
    expect(code).toBe(0);
  });

  // ----- --severity flag -----

  it('returns 0 when --severity finds no matching findings', async () => {
    mockRun.mockResolvedValueOnce(makeAuditResult([makeFinding({ severity: 'low' })]));
    const code = await runFix('.', { severity: 'critical' });
    expect(code).toBe(0);
  });

  it('fixes all findings matching --severity', async () => {
    const f1 = makeFinding({ id: 'F001', file: '/test/route1.ts', severity: 'high' });
    const f2 = makeFinding({ id: 'F002', file: '/test/route2.ts', severity: 'high' });
    const f3 = makeFinding({ id: 'F003', file: '/test/route3.ts', severity: 'low' });

    mockRun.mockResolvedValueOnce(makeAuditResult([f1, f2, f3]));
    mockRun.mockResolvedValueOnce(makeAuditResult([]));
    mockReadFileSafe.mockReturnValue('export default function handler() {}');

    const code = await runFix('.', { severity: 'high' });

    // Only f1 and f2 are high — each fix = 2 writes (backup + actual)
    expect(mockWriteFileSync).toHaveBeenCalledTimes(4);
    expect(code).toBe(0);
  });

  // ----- --dry-run -----

  it('does not write files in --dry-run mode', async () => {
    const finding = makeFinding({ file: '/test/route.ts' });
    mockRun.mockResolvedValueOnce(makeAuditResult([finding]));
    mockReadFileSafe.mockReturnValue('export default function handler() {}');

    const code = await runFix('.', { finding: 'F001', dryRun: true });

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });

  it('shows diff in --dry-run mode', async () => {
    const finding = makeFinding({ file: '/test/route.ts' });
    mockRun.mockResolvedValueOnce(makeAuditResult([finding]));
    mockReadFileSafe.mockReturnValue('export default function handler() {}');

    await runFix('.', { finding: 'F001', dryRun: true });

    const allLogs = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(allLogs).toContain('[DRY RUN]');
  });

  // ----- fix templates -----

  it('auth-enforcer: skips file that already has secureApiRouteWithTenant', async () => {
    const finding = makeFinding({ file: '/test/route.ts' });
    mockRun.mockResolvedValueOnce(makeAuditResult([finding]));
    mockReadFileSafe.mockReturnValue(
      "import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';\nexport default function handler() {}",
    );

    await runFix('.', { finding: 'F001' });

    // Nothing to write — already fixed
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('crypto-auditor: replaces Math.random() with crypto.randomUUID()', async () => {
    const finding = makeFinding({
      scanner: 'crypto-auditor',
      title: 'Math.random() used for ID generation',
      file: '/test/utils.ts',
      line: 1,
    });
    mockRun.mockResolvedValueOnce(makeAuditResult([finding]));
    mockRun.mockResolvedValueOnce(makeAuditResult([]));
    mockReadFileSafe.mockReturnValue('const id = Math.random().toString();');

    await runFix('.', { finding: 'F001' });

    expect(mockWriteFileSync).toHaveBeenCalledTimes(2); // backup + fix
    const content = (mockWriteFileSync.mock.calls[1] as [string, string, string])[1];
    expect(content).toContain('crypto.getRandomValues');
    expect(content).not.toContain('Math.random()');
  });

  it('zod-enforcer: adds Zod import skeleton when missing', async () => {
    const finding = makeFinding({
      scanner: 'zod-enforcer',
      title: 'No Zod schema found',
      file: '/test/api/route.ts',
    });
    mockRun.mockResolvedValueOnce(makeAuditResult([finding]));
    mockRun.mockResolvedValueOnce(makeAuditResult([]));
    mockReadFileSafe.mockReturnValue('export async function GET() {}');

    await runFix('.', { finding: 'F001' });

    expect(mockWriteFileSync).toHaveBeenCalledTimes(2); // backup + fix
    const content = (mockWriteFileSync.mock.calls[1] as [string, string, string])[1];
    expect(content).toContain("import { z } from 'zod'");
  });

  it('header-checker: surfaces suggestion text, does not write file', async () => {
    const finding = makeFinding({
      scanner: 'header-checker',
      title: 'Missing security headers',
      file: '/test/next.config.ts',
      fix: 'Add headers() to next.config.ts',
    });
    mockRun.mockResolvedValueOnce(makeAuditResult([finding]));
    mockReadFileSafe.mockReturnValue('const config = {};\nexport default config;');

    await runFix('.', { finding: 'F001' });

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    const logs = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(logs).toContain('header-checker');
  });

  // ----- findings without file location -----

  it('skips findings with no file property', async () => {
    const finding = makeFinding({ file: undefined });
    mockRun.mockResolvedValueOnce(makeAuditResult([finding]));

    const code = await runFix('.', { finding: 'F001' });

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(code).toBe(0);
  });

  // ----- scan failure -----

  it('returns 1 when scan fails', async () => {
    mockRun.mockRejectedValueOnce(new Error('Scanner crashed'));

    const code = await runFix('.', {});
    expect(code).toBe(1);
  });

  // ----- re-scan after fix -----

  it('runs re-scan after fixing files', async () => {
    const finding = makeFinding({ file: '/test/route.ts' });
    mockRun.mockResolvedValueOnce(makeAuditResult([finding]));
    mockRun.mockResolvedValueOnce(makeAuditResult([]));
    mockReadFileSafe.mockReturnValue('export default function handler() {}');

    await runFix('.', { finding: 'F001' });

    // First scan + re-scan = 2 calls
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it('shows score improvement message after re-scan', async () => {
    const finding = makeFinding({ file: '/test/route.ts' });

    const initialResult = makeAuditResult([finding]);
    initialResult.score = 750;

    const rescanResult = makeAuditResult([]);
    rescanResult.score = 900;

    mockRun.mockResolvedValueOnce(initialResult);
    mockRun.mockResolvedValueOnce(rescanResult);
    mockReadFileSafe.mockReturnValue('export default function handler() {}');

    await runFix('.', { finding: 'F001' });

    const logs = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(logs).toContain('750');
    expect(logs).toContain('900');
  });
});
