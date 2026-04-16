import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockRun = vi.fn();
const mockRegister = vi.fn();
const mockLoadConfig = vi.fn();
const mockExec = vi.fn();

vi.mock('@aegis-scan/core', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  Orchestrator: vi.fn().mockImplementation(() => ({
    register: mockRegister,
    run: mockRun,
  })),
  exec: (...args: unknown[]) => mockExec(...args),
  readFileSafe: vi.fn().mockReturnValue(null),
  walkFiles: vi.fn().mockReturnValue([]),
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

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { runHistory } from '../src/commands/history.js';
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

function makeAuditResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    score: 850,
    grade: 'A',
    badge: 'HARDENED',
    blocked: false,
    breakdown: {} as AuditResult['breakdown'],
    findings: [],
    scanResults: [],
    stack: { framework: 'nextjs' } as AuditResult['stack'],
    duration: 100,
    timestamp: new Date().toISOString(),
    confidence: 'high',
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'F001',
    scanner: 'auth-enforcer',
    category: 'security',
    severity: 'high',
    title: 'Missing auth guard',
    description: 'No auth guard found',
    file: '/test/src/api/route.ts',
    line: 10,
    ...overrides,
  };
}

/** A valid git blame --porcelain block for line 10 */
function makeBlamePorcelain(hash = 'a'.repeat(40), author = 'Alice', timestamp = '1700000000') {
  return [
    `${hash} 10 10 1`,
    `author ${author}`,
    `author-mail <alice@example.com>`,
    `author-time ${timestamp}`,
    `author-tz +0000`,
    `committer Bob`,
    `committer-mail <bob@example.com>`,
    `committer-time ${timestamp}`,
    `committer-tz +0000`,
    `summary Initial commit`,
    `filename src/api/route.ts`,
    `\t// some code`,
  ].join('\n');
}

// Git exec response helpers
function gitSuccess(stdout: string) {
  return Promise.resolve({ stdout, stderr: '', exitCode: 0 });
}

function gitFailure(stderr = 'error') {
  return Promise.resolve({ stdout: '', stderr, exitCode: 1 });
}

// ---------------------------------------------------------------------------
// Tests — error validation
// ---------------------------------------------------------------------------

describe('runHistory — option validation', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns 1 when no mode flag is provided', async () => {
    const code = await runHistory('.', {});
    expect(code).toBe(1);
  });

  it('returns 1 when multiple mode flags are provided', async () => {
    const code = await runHistory('.', { commit: 'abc123', blame: true });
    expect(code).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — --commit mode
// ---------------------------------------------------------------------------

describe('runHistory --commit', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockLoadConfig.mockResolvedValue(makeConfig());
    mockRun.mockResolvedValue(makeAuditResult());
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockRegister.mockClear();
    mockRun.mockClear();
    mockExec.mockClear();
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('returns 0 on a clean scan for the specified commit', async () => {
    // symbolic-ref → branch name
    mockExec.mockResolvedValueOnce(gitSuccess('main'));
    // stash (nothing to stash)
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 });
    // checkout abc123
    mockExec.mockResolvedValueOnce(gitSuccess(''));
    // restore: checkout main
    mockExec.mockResolvedValueOnce(gitSuccess(''));

    const code = await runHistory('.', { commit: 'abc123' });
    expect(code).toBe(0);
  });

  it('performs stash pop if changes were stashed', async () => {
    mockExec.mockResolvedValueOnce(gitSuccess('main'));          // symbolic-ref
    mockExec.mockResolvedValueOnce(gitSuccess('Saved working directory')); // stash
    mockExec.mockResolvedValueOnce(gitSuccess(''));              // checkout target
    mockExec.mockResolvedValueOnce(gitSuccess(''));              // restore checkout
    mockExec.mockResolvedValueOnce(gitSuccess(''));              // stash pop

    await runHistory('.', { commit: 'abc123' });

    // Count git calls — stash pop should be among them
    const calls = mockExec.mock.calls as string[][];
    const popCall = calls.find((c) => c[0] === 'git' && (c[1] as unknown as string[]).includes('pop'));
    expect(popCall).toBeDefined();
  });

  it('restores original branch even when scan fails', async () => {
    mockExec.mockResolvedValueOnce(gitSuccess('main'));          // symbolic-ref
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 }); // stash
    mockExec.mockResolvedValueOnce(gitSuccess(''));              // checkout target
    mockRun.mockRejectedValueOnce(new Error('Scanner exploded')); // scan fails
    mockExec.mockResolvedValueOnce(gitSuccess(''));              // restore checkout

    const code = await runHistory('.', { commit: 'abc123' });

    expect(code).toBe(1);

    // Restore checkout should still happen
    const calls = mockExec.mock.calls as Array<[string, string[]]>;
    const checkouts = calls.filter(
      (c) => c[0] === 'git' && c[1][0] === 'checkout',
    );
    // First checkout to target, second to restore
    expect(checkouts.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 1 when git checkout fails', async () => {
    mockExec.mockResolvedValueOnce(gitSuccess('main'));          // symbolic-ref
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 }); // stash
    mockExec.mockResolvedValueOnce(gitFailure('fatal: not a valid ref')); // checkout fails
    mockExec.mockResolvedValueOnce(gitSuccess(''));              // restore checkout

    const code = await runHistory('.', { commit: 'badref' });
    expect(code).toBe(1);
  });

  it('uses commit hash as ref when in detached HEAD state', async () => {
    mockExec.mockResolvedValueOnce(gitFailure('HEAD is detached')); // symbolic-ref fails
    mockExec.mockResolvedValueOnce(gitSuccess('deadbeef1234'));     // rev-parse
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 }); // stash
    mockExec.mockResolvedValueOnce(gitSuccess(''));                 // checkout target
    mockExec.mockResolvedValueOnce(gitSuccess(''));                 // restore checkout

    const code = await runHistory('.', { commit: 'abc123' });
    expect(code).toBe(0);
  });

  it('returns 1 when blocked findings exist at commit', async () => {
    mockExec.mockResolvedValueOnce(gitSuccess('main'));
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 });
    mockExec.mockResolvedValueOnce(gitSuccess(''));
    mockRun.mockResolvedValueOnce(makeAuditResult({ blocked: true, score: 0 }));
    mockExec.mockResolvedValueOnce(gitSuccess(''));

    const code = await runHistory('.', { commit: 'abc123' });
    expect(code).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — --blame mode
// ---------------------------------------------------------------------------

describe('runHistory --blame', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockLoadConfig.mockResolvedValue(makeConfig());
    mockRun.mockResolvedValue(makeAuditResult());
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockRegister.mockClear();
    mockRun.mockClear();
    mockExec.mockClear();
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('returns 0 when there are no file+line findings', async () => {
    mockRun.mockResolvedValueOnce(makeAuditResult({
      findings: [makeFinding({ file: undefined, line: undefined })],
    }));

    const code = await runHistory('.', { blame: true });
    expect(code).toBe(0);
  });

  it('enriches findings with blame metadata', async () => {
    const finding = makeFinding();
    mockRun.mockResolvedValueOnce(makeAuditResult({ findings: [finding] }));
    mockExec.mockResolvedValueOnce({
      stdout: makeBlamePorcelain('a'.repeat(40), 'Alice', '1700000000'),
      stderr: '',
      exitCode: 0,
    });

    const code = await runHistory('.', { blame: true });
    expect(code).toBe(0);

    const logs = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(logs).toContain('Alice');
  });

  it('still outputs finding when blame fails', async () => {
    const finding = makeFinding();
    mockRun.mockResolvedValueOnce(makeAuditResult({ findings: [finding] }));
    mockExec.mockResolvedValueOnce(gitFailure('not a git repo'));

    const code = await runHistory('.', { blame: true });
    expect(code).toBe(0);
  });

  it('outputs JSON for --format json', async () => {
    const finding = makeFinding();
    mockRun.mockResolvedValueOnce(makeAuditResult({ findings: [finding] }));
    mockExec.mockResolvedValueOnce({
      stdout: makeBlamePorcelain(),
      stderr: '',
      exitCode: 0,
    });

    await runHistory('.', { blame: true, format: 'json' });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('sorts findings oldest-introduced first', async () => {
    const oldFinding = makeFinding({ id: 'OLD', line: 10 });
    const newFinding = makeFinding({ id: 'NEW', line: 20, file: '/test/new.ts' });

    mockRun.mockResolvedValueOnce(makeAuditResult({ findings: [newFinding, oldFinding] }));

    // NEW finding was introduced 2024-01-01, OLD finding was introduced 2020-01-01
    mockExec.mockResolvedValueOnce({
      stdout: makeBlamePorcelain('b'.repeat(40), 'Bob', '1704067200'), // 2024-01-01
      stderr: '',
      exitCode: 0,
    });
    mockExec.mockResolvedValueOnce({
      stdout: makeBlamePorcelain('a'.repeat(40), 'Alice', '1577836800'), // 2020-01-01
      stderr: '',
      exitCode: 0,
    });

    await runHistory('.', { blame: true, format: 'json' });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
    const parsed = JSON.parse(output) as Array<{ id: string }>;
    // OLD (2020) should come before NEW (2024)
    expect(parsed[0].id).toBe('OLD');
    expect(parsed[1].id).toBe('NEW');
  });

  it('returns 1 when scan fails', async () => {
    mockRun.mockRejectedValueOnce(new Error('Scan error'));
    const code = await runHistory('.', { blame: true });
    expect(code).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — --range mode
// ---------------------------------------------------------------------------

describe('runHistory --range', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockLoadConfig.mockResolvedValue(makeConfig());
    mockExec.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
    mockRegister.mockClear();
    mockRun.mockClear();
    mockExec.mockClear();
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('returns 1 when git log fails', async () => {
    mockExec.mockResolvedValueOnce(gitFailure('unknown revision'));

    const code = await runHistory('.', { range: 'bad..range' });
    expect(code).toBe(1);
  });

  it('returns 1 when git log returns no commits', async () => {
    mockExec.mockResolvedValueOnce(gitSuccess(''));

    const code = await runHistory('.', { range: 'main~0..HEAD' });
    expect(code).toBe(1);
  });

  it('scans each commit in the range and returns 0', async () => {
    // git log
    mockExec.mockResolvedValueOnce(gitSuccess('abc1234 First commit\ndef5678 Second commit'));
    // get original ref
    mockExec.mockResolvedValueOnce(gitSuccess('main'));
    // stash
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 });
    // checkout commit 1 (abc1234 - oldest first after reverse)
    mockExec.mockResolvedValueOnce(gitSuccess(''));
    // checkout commit 2 (def5678)
    mockExec.mockResolvedValueOnce(gitSuccess(''));
    // restore
    mockExec.mockResolvedValueOnce(gitSuccess(''));

    mockRun.mockResolvedValue(makeAuditResult({ score: 850 }));

    const code = await runHistory('.', { range: 'HEAD~2..HEAD' });
    expect(code).toBe(0);
    // Should scan twice (one per commit)
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it('shows score trend summary', async () => {
    mockExec.mockResolvedValueOnce(gitSuccess('abc1234 Commit A\ndef5678 Commit B'));
    mockExec.mockResolvedValueOnce(gitSuccess('main'));
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 });
    mockExec.mockResolvedValueOnce(gitSuccess('')); // checkout 1
    mockExec.mockResolvedValueOnce(gitSuccess('')); // checkout 2
    mockExec.mockResolvedValueOnce(gitSuccess('')); // restore

    // oldest first → 700, then 900
    mockRun.mockResolvedValueOnce(makeAuditResult({ score: 700 }));
    mockRun.mockResolvedValueOnce(makeAuditResult({ score: 900 }));

    await runHistory('.', { range: 'HEAD~2..HEAD' });

    const logs = consoleLogSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(logs).toContain('700');
    expect(logs).toContain('900');
  });

  it('outputs JSON for --format json', async () => {
    mockExec.mockResolvedValueOnce(gitSuccess('abc1234 Only commit'));
    mockExec.mockResolvedValueOnce(gitSuccess('main'));
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 });
    mockExec.mockResolvedValueOnce(gitSuccess('')); // checkout
    mockExec.mockResolvedValueOnce(gitSuccess('')); // restore

    mockRun.mockResolvedValueOnce(makeAuditResult({ score: 850 }));

    await runHistory('.', { range: 'HEAD~1..HEAD', format: 'json' });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output) as Array<{ commit: string; score: number }>;
    expect(parsed[0].score).toBe(850);
  });

  it('marks commit score as -1 when individual scan fails', async () => {
    mockExec.mockResolvedValueOnce(gitSuccess('abc1234 Commit A\ndef5678 Commit B'));
    mockExec.mockResolvedValueOnce(gitSuccess('main'));
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 });
    mockExec.mockResolvedValueOnce(gitSuccess('')); // checkout 1
    mockExec.mockResolvedValueOnce(gitSuccess('')); // checkout 2
    mockExec.mockResolvedValueOnce(gitSuccess('')); // restore

    mockRun.mockRejectedValueOnce(new Error('scan failed for commit A'));
    mockRun.mockResolvedValueOnce(makeAuditResult({ score: 900 }));

    await runHistory('.', { range: 'HEAD~2..HEAD', format: 'json' });

    const output = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('');
    const parsed = JSON.parse(output) as Array<{ score: number }>;
    expect(parsed[0].score).toBe(-1);
    expect(parsed[1].score).toBe(900);
  });

  it('restores original branch even when all scans fail', async () => {
    mockExec.mockResolvedValueOnce(gitSuccess('abc1234 Only commit'));
    mockExec.mockResolvedValueOnce(gitSuccess('main'));
    mockExec.mockResolvedValueOnce({ stdout: 'No local changes to save', stderr: '', exitCode: 0 });
    mockExec.mockResolvedValueOnce(gitSuccess('')); // checkout
    mockExec.mockResolvedValueOnce(gitSuccess('')); // restore

    mockRun.mockRejectedValueOnce(new Error('all scans failed'));

    await runHistory('.', { range: 'HEAD~1..HEAD' });

    const calls = mockExec.mock.calls as Array<[string, string[]]>;
    const restoreCheckout = calls.filter(
      (c) => c[0] === 'git' && c[1][0] === 'checkout' && c[1][1] === 'main',
    );
    expect(restoreCheckout.length).toBeGreaterThanOrEqual(1);
  });
});
