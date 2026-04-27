import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('ora', () => {
  const createOra = () => {
    const instance: Record<string, any> = {
      text: '',
      start: vi.fn(),
      stop: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
    };
    instance.start.mockReturnValue(instance);
    instance.stop.mockReturnValue(instance);
    instance.fail.mockReturnValue(instance);
    instance.warn.mockReturnValue(instance);
    return instance;
  };
  return { default: vi.fn(createOra) };
});

vi.mock('chalk', () => {
  const fn = (s: string) => s;
  const chainable = Object.assign(fn, { bold: fn, dim: fn, cyan: fn, green: fn, red: Object.assign(fn, { bold: fn }), yellow: fn, level: 3 });
  return { default: chainable };
});

const mockRun = vi.fn();
const mockRegister = vi.fn();

vi.mock('@aegis-scan/core', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    projectPath: '/test',
    stack: { framework: 'nextjs', database: 'supabase' },
    mode: 'siege',
    ignore: [],
  }),
  Orchestrator: vi.fn().mockImplementation(() => ({
    register: mockRegister,
    run: mockRun,
  })),
  calculateScore: vi.fn().mockReturnValue({
    score: 850,
    grade: 'A',
    badge: 'HARDENED',
    blocked: false,
    breakdown: {},
    confidence: 'high',
  }),
  walkFiles: vi.fn().mockReturnValue([]),
  readFileSafe: vi.fn().mockReturnValue(null),
  detectStack: vi.fn(),
  // RoE module exports — siege now imports loadRoE/synthesizeMinimalRoE/
  // validateTemporalEnvelope/validateTargetInScope. The synthesized-RoE
  // path runs when --roe is not provided; validators return decisions
  // the siege handler treats as a precondition for proceeding.
  loadRoE: vi.fn(),
  synthesizeMinimalRoE: vi.fn().mockReturnValue({
    roe_id: 'test-synthesized',
    spec_version: '0.1.0',
    operator: { organization: 'test', authorized_by: 'test', contact: 'test' },
    authorization: {
      statement: 'AEGIS-synthesized minimal RoE for tests (twenty plus chars).',
      signature_method: 'operator-attested',
    },
    in_scope: { domains: [{ pattern: 'example.com', includeSubdomains: false }], ip_ranges: [], repository_paths: [] },
    out_of_scope: { domains: [], ip_ranges: [], paths: [] },
    asset_criticality: [],
    temporal: {
      start: new Date(Date.now() - 1000).toISOString(),
      end: new Date(Date.now() + 60_000).toISOString(),
      timezone: 'UTC',
      blackout_windows: [],
    },
    stop_conditions: { on_critical_finding: 'halt' },
  }),
  validateTemporalEnvelope: vi.fn().mockReturnValue({ allowed: true, reason: 'mocked-temporal-ok' }),
  validateTargetInScope: vi.fn().mockReturnValue({ allowed: true, reason: 'mocked-scope-ok' }),
  // Cluster-2 runtime module — events + state + signals + notifications
  initStateFile: vi.fn(),
  emitEvent: vi.fn(),
  makeEvent: vi.fn().mockImplementation((engagementId: string, event: string, payload: Record<string, unknown>) => ({
    ts: '2026-04-27T00:00:00Z',
    engagement_id: engagementId,
    event,
    ...payload,
  })),
  findingEvent: vi.fn().mockImplementation((engagementId: string) => ({
    ts: '2026-04-27T00:00:00Z',
    engagement_id: engagementId,
    event: 'finding-emitted',
  })),
  isCriticalSeverity: vi.fn().mockReturnValue(false),
  writeEngagementState: vi.fn(),
  loadEngagementState: vi.fn().mockReturnValue({ ok: false, phase: 'file-missing', error: 'mock-default-no-resume' }),
  installSignalHandlers: vi.fn().mockReturnValue({ uninstall: vi.fn() }),
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  // Cluster-3 hash-chain — minimal stub that just passes events through untouched.
  ChainedEmitter: vi.fn().mockImplementation(() => ({
    emit: (ev: unknown) => ev,
    getTail: () => null,
  })),
  verifyAuditChain: vi.fn().mockReturnValue({ ok: true, total_events: 0, tail_hash: null }),
}));

vi.mock('@aegis-scan/reporters', () => ({
  terminalReporter: { name: 'terminal', format: vi.fn(() => 'mock terminal output') },
  jsonReporter: { name: 'json', format: vi.fn(() => '{}') },
  sarifReporter: { name: 'sarif', format: vi.fn(() => '{}') },
  htmlReporter: { name: 'html', format: vi.fn(() => '<html></html>') },
}));

vi.mock('@aegis-scan/scanners', () => ({
  getAllScanners: vi.fn(() => [
    { name: 'mock-scanner', category: 'security', isAvailable: vi.fn(), scan: vi.fn() },
  ]),
  getAttackScanners: vi.fn(() => [
    { name: 'auth-probe', category: 'attack', isAvailable: vi.fn(), scan: vi.fn() },
    { name: 'header-probe', category: 'attack', isAvailable: vi.fn(), scan: vi.fn() },
    { name: 'rate-limit-probe', category: 'attack', isAvailable: vi.fn(), scan: vi.fn() },
  ]),
}));

import { runSiege } from '../src/commands/siege.js';

describe('runSiege', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    // Default: target is reachable
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    // Default: orchestrator returns empty results
    mockRun.mockResolvedValue({
      score: 850,
      grade: 'A',
      badge: 'HARDENED',
      blocked: false,
      breakdown: {},
      findings: [],
      scanResults: [],
      stack: { framework: 'nextjs' },
      duration: 1000,
      timestamp: new Date().toISOString(),
      confidence: 'high',
    });

    mockRegister.mockClear();
    mockRun.mockClear();

    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('returns 1 when no target is provided', async () => {
    const exitCode = await runSiege('.', { target: '', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('returns 1 without --confirm (authorization gate)', async () => {
    const exitCode = await runSiege('.', { target: 'https://example.com' });
    expect(exitCode).toBe(1);
  });

  it('returns 1 when target is unreachable', async () => {
    fetchSpy.mockRejectedValue(new Error('Connection refused'));

    const exitCode = await runSiege('.', { target: 'https://unreachable.test', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('returns 0 when siege completes without blockers', async () => {
    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(0);
  });

  it('runs all 4 phases sequentially', async () => {
    await runSiege('.', { target: 'https://example.com', confirm: true });

    // Phase 1: fetch for recon + reachability
    expect(fetchSpy).toHaveBeenCalled();

    // Phase 2 + 3: orchestrator.run called twice (once for audit, once for attacks)
    expect(mockRun).toHaveBeenCalledTimes(2);

    // Phase 4: reporter output
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('returns 1 when blocked findings exist', async () => {
    mockRun.mockResolvedValue({
      score: 0,
      grade: 'F',
      badge: 'CRITICAL',
      blocked: true,
      blockerReason: 'test blocker',
      breakdown: {},
      findings: [{ severity: 'blocker', title: 'test' }],
      scanResults: [],
      stack: { framework: 'nextjs' },
      duration: 1000,
      timestamp: new Date().toISOString(),
      confidence: 'high',
    });

    // Mock calculateScore to return blocked
    const { calculateScore } = await import('@aegis-scan/core');
    vi.mocked(calculateScore).mockReturnValueOnce({
      score: 0,
      grade: 'F',
      badge: 'CRITICAL',
      blocked: true,
      blockerReason: 'test blocker',
      breakdown: {} as any,
      confidence: 'high',
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('registers scanners for both phases', async () => {
    await runSiege('.', { target: 'https://example.com', confirm: true });

    // getAllScanners returns 1 mock scanner, getAttackScanners returns 3
    // So register should be called 1 + 3 = 4 times total
    expect(mockRegister).toHaveBeenCalledTimes(4);
  });
});
