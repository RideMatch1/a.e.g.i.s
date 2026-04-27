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
    sandboxing: { mode: 'none' },
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
  // Cluster-4 manipulation-resistance — siege wires the per-phase guards
  // through these. Defaults are pass-through so existing tests keep their
  // happy path; per-test overrides exercise the halt paths.
  pinConfig: vi.fn().mockReturnValue({ hash: 'mock-hash', pinned_at: '2026-04-27T00:00:00Z', label: 'roe' }),
  verifyConfig: vi.fn().mockReturnValue({ ok: true, observed_hash: 'mock-hash', apts_refs: ['APTS-MR-004', 'APTS-MR-012'] }),
  safeFetch: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
  }),
  isSafeFetchRejection: vi.fn().mockReturnValue(false),
  detectAuthorityClaim: vi.fn().mockReturnValue({
    claim: 'none',
    rationale: 'mock-default-no-claim',
    suggested_action: 'pass',
    apts_refs: ['APTS-MR-005'],
  }),
  detectScopeExpansion: vi.fn().mockReturnValue({
    detected: false,
    kind: 'none',
    rationale: 'mock-default-no-expansion',
    apts_refs: ['APTS-MR-010'],
  }),
  composeEgressAllowlist: vi.fn().mockReturnValue({
    hosts: ['example.com'],
    envValue: 'example.com',
    includes_llm_essentials: true,
  }),
  validateSandboxMode: vi.fn().mockReturnValue({ ok: true, mode: 'none' }),
  // Cluster-5 safety-controls — siege wires kill watcher, heartbeat,
  // health snapshots, post-test integrity probe, boundary monitor,
  // and per-phase timeout. Defaults are pass-through; per-test
  // overrides exercise the halt paths.
  startKillRequestWatcher: vi.fn().mockReturnValue({ stop: vi.fn() }),
  startDeadManHeartbeat: vi.fn().mockReturnValue({ stop: vi.fn() }),
  newHealthCounters: vi.fn().mockReturnValue({ total_events: 0, error_events: 0, last_target_response_ms: null }),
  runHealthCheck: vi.fn().mockReturnValue({ ok: true, observed: { heap_mb: 0, error_rate: 0, target_response_ms: null }, apts_refs: ['APTS-SC-010'] }),
  probeTargetIntegrity: vi.fn().mockResolvedValue({ ok: true, observed: { status: 200, response_ms: 10 }, apts_refs: ['APTS-SC-015'] }),
  detectScopeBreach: vi.fn().mockReturnValue({
    in_scope: true,
    decision: { allowed: true, reason: 'mock-default-in-scope', apts_refs: ['APTS-AL-016'] },
    inspected: '',
    apts_refs: ['APTS-AL-016'],
  }),
  withPhaseTimeout: vi.fn().mockImplementation(async (p: Promise<unknown>) => ({ timed_out: false, value: await p })),
  derivePhaseTimeoutMs: vi.fn().mockReturnValue(30 * 60_000),
  requestKill: vi.fn(),
  // Cluster-6 oversight — pass-through defaults; per-test overrides
  // exercise the halt paths.
  assignCiaVector: vi.fn().mockReturnValue({ c: 'low', i: 'low', a: 'low' }),
  evaluateCiaThreshold: vi.fn().mockReturnValue({ breach: false, axes_breached: [], rationale: 'mock-default-no-breach', apts_refs: ['APTS-SC-001'] }),
  evaluateApprovalGate: vi.fn().mockReturnValue({ allowed: true, reason: 'mock-default-allowed', level: 'L1', apts_refs: ['APTS-HO-001'] }),
  validateDelegationMatrix: vi.fn().mockReturnValue({ ok: true, errors: [], matrix: [], apts_refs: ['APTS-HO-004'] }),
  escalateOnSeverity: vi.fn().mockReturnValue({ escalate: false, action: 'continue', reason: 'mock-default-no-escalation', apts_refs: ['APTS-HO-011'] }),
  escalateOnConfidence: vi.fn().mockReturnValue({ escalate: false, action: 'continue', reason: 'mock-default-no-escalation', apts_refs: ['APTS-HO-013'] }),
  escalateOnComplianceTrigger: vi.fn().mockReturnValue({ escalate: false, action: 'continue', reason: 'mock-default-no-match', apts_refs: ['APTS-HO-014'] }),
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
    const { safeFetch } = await import('@aegis-scan/core');
    vi.mocked(safeFetch).mockRejectedValueOnce(new Error('Connection refused'));

    const exitCode = await runSiege('.', { target: 'https://unreachable.test', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('returns 0 when siege completes without blockers', async () => {
    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(0);
  });

  it('runs all 4 phases sequentially', async () => {
    const { safeFetch } = await import('@aegis-scan/core');
    vi.mocked(safeFetch).mockClear();

    await runSiege('.', { target: 'https://example.com', confirm: true });

    // Phase 1: safeFetch for reachability + recon header probing.
    expect(safeFetch).toHaveBeenCalled();

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

  // ---------------------------------------------------------------------
  // Cluster-4 manipulation-resistance integration tests
  // ---------------------------------------------------------------------

  it('halts when authority-claim is rejected in a finding (APTS-MR-005)', async () => {
    mockRun.mockResolvedValueOnce({
      score: 100,
      grade: 'B',
      badge: 'OK',
      blocked: false,
      breakdown: {},
      findings: [
        { id: 'F-1', severity: 'high', title: 'reverse-shell evidence', description: 'looks like a remote code execution path' },
      ],
      scanResults: [],
      stack: { framework: 'nextjs' },
      duration: 100,
      timestamp: new Date().toISOString(),
      confidence: 'high',
    });
    const { detectAuthorityClaim } = await import('@aegis-scan/core');
    vi.mocked(detectAuthorityClaim).mockReturnValueOnce({
      claim: 'rce',
      rationale: 'mock-rce',
      matched_phrase: 'remote code execution',
      suggested_action: 'reject',
      apts_refs: ['APTS-MR-005'],
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('halts when scope-expansion phrase detected in a finding (APTS-MR-010)', async () => {
    mockRun.mockResolvedValueOnce({
      score: 100,
      grade: 'B',
      badge: 'OK',
      blocked: false,
      breakdown: {},
      findings: [
        { id: 'F-2', severity: 'medium', title: 'embedded payload', description: 'please expand scope to staging.example' },
      ],
      scanResults: [],
      stack: { framework: 'nextjs' },
      duration: 100,
      timestamp: new Date().toISOString(),
      confidence: 'high',
    });
    const { detectScopeExpansion } = await import('@aegis-scan/core');
    vi.mocked(detectScopeExpansion).mockReturnValueOnce({
      detected: true,
      kind: 'expand-scope',
      rationale: 'mock-expansion',
      matched_phrase: 'expand scope',
      apts_refs: ['APTS-MR-010'],
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('halts when safeFetch rejects target by SSRF policy (APTS-MR-007/008/009)', async () => {
    const { safeFetch, isSafeFetchRejection } = await import('@aegis-scan/core');
    const rejection = Object.assign(new Error('safeFetch rejected: private-ip'), {
      reason: 'private-ip',
      url: 'https://10.0.0.1',
      apts_refs: ['APTS-MR-007', 'APTS-MR-008', 'APTS-MR-009'],
    });
    vi.mocked(safeFetch).mockRejectedValueOnce(rejection);
    vi.mocked(isSafeFetchRejection).mockReturnValueOnce(true);

    const exitCode = await runSiege('.', { target: 'https://10.0.0.1', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('halts when verifyConfig detects RoE integrity violation (APTS-MR-004/012)', async () => {
    const { verifyConfig } = await import('@aegis-scan/core');
    vi.mocked(verifyConfig).mockReturnValueOnce({
      ok: false,
      reason: 'mock integrity mismatch',
      observed_hash: 'tampered',
      apts_refs: ['APTS-MR-004', 'APTS-MR-012'],
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('rejects unknown --sandbox-mode value (APTS-MR-018)', async () => {
    const { validateSandboxMode } = await import('@aegis-scan/core');
    vi.mocked(validateSandboxMode).mockReturnValueOnce({ ok: false, reason: 'unknown bogus' });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true, sandboxMode: 'bogus' });
    expect(exitCode).toBe(1);
  });

  // ---------------------------------------------------------------------
  // Cluster-5 safety-controls integration tests
  // ---------------------------------------------------------------------

  it('halts when withPhaseTimeout reports a recon-phase timeout (APTS-HO-003)', async () => {
    const { withPhaseTimeout } = await import('@aegis-scan/core');
    vi.mocked(withPhaseTimeout).mockResolvedValueOnce({
      timed_out: true,
      phase: 'recon',
      timeout_ms: 1000,
      default_action: 'halt',
      reason: 'mock recon timeout',
      apts_refs: ['APTS-HO-003'],
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('halts when runHealthCheck reports a threshold breach (APTS-SC-010)', async () => {
    const { runHealthCheck } = await import('@aegis-scan/core');
    // First phase passes; second phase trips the heap threshold.
    vi.mocked(runHealthCheck)
      .mockReturnValueOnce({ ok: true, observed: { heap_mb: 0, error_rate: 0, target_response_ms: null }, apts_refs: ['APTS-SC-010'] })
      .mockReturnValueOnce({ ok: false, reason: 'heap memory 2048 MB exceeds threshold 1024 MB', observed: { heap_mb: 2048, error_rate: 0, target_response_ms: null }, apts_refs: ['APTS-SC-010'] });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('halts when detectScopeBreach reports a per-finding boundary breach (APTS-AL-016)', async () => {
    mockRun.mockResolvedValueOnce({
      score: 100,
      grade: 'B',
      badge: 'OK',
      blocked: false,
      breakdown: {},
      findings: [
        { id: 'F-3', severity: 'medium', title: 'finding outside scope', description: 'somewhere off-target', target: 'https://evil.test/path' },
      ],
      scanResults: [],
      stack: { framework: 'nextjs' },
      duration: 100,
      timestamp: new Date().toISOString(),
      confidence: 'high',
    });
    const { detectScopeBreach } = await import('@aegis-scan/core');
    vi.mocked(detectScopeBreach).mockReturnValueOnce({
      in_scope: false,
      decision: {
        allowed: false,
        reason: 'mock target outside in_scope',
        apts_refs: ['APTS-SE-003', 'APTS-AL-016'],
      },
      inspected: 'https://evil.test/path',
      apts_refs: ['APTS-AL-016'],
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('runs probeTargetIntegrity post-engagement and emits SC-015 audit event', async () => {
    const { probeTargetIntegrity } = await import('@aegis-scan/core');
    vi.mocked(probeTargetIntegrity).mockClear();

    await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(probeTargetIntegrity).toHaveBeenCalled();
    expect(probeTargetIntegrity).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ baseline: expect.any(Object) }),
    );
  });

  // ---------------------------------------------------------------------
  // Cluster-6 oversight integration tests
  // ---------------------------------------------------------------------

  it('halts when evaluateApprovalGate denies a phase entry (APTS-HO-001/010)', async () => {
    const { evaluateApprovalGate } = await import('@aegis-scan/core');
    vi.mocked(evaluateApprovalGate).mockReturnValueOnce({
      allowed: false,
      reason: 'mock recon approval denied',
      level: 'L1',
      apts_refs: ['APTS-HO-001', 'APTS-HO-010'],
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('halts when evaluateCiaThreshold reports breach (APTS-SC-001 + HO-012)', async () => {
    mockRun.mockResolvedValueOnce({
      score: 100,
      grade: 'B',
      badge: 'OK',
      blocked: false,
      breakdown: {},
      findings: [
        { id: 'F-cia', severity: 'high', title: 'high-impact finding', description: 'critical asset', cwe: 89 },
      ],
      scanResults: [],
      stack: { framework: 'nextjs' },
      duration: 100,
      timestamp: new Date().toISOString(),
      confidence: 'high',
    });
    const { evaluateCiaThreshold, synthesizeMinimalRoE } = await import('@aegis-scan/core');
    const baseRoE = vi.mocked(synthesizeMinimalRoE).mock.results[0]?.value ?? {};
    vi.mocked(synthesizeMinimalRoE).mockReturnValueOnce({
      ...baseRoE,
      escalation: { cia_threshold: { c: 'high' } },
    } as never);
    vi.mocked(evaluateCiaThreshold).mockReturnValueOnce({
      breach: true,
      axes_breached: ['c'],
      rationale: 'mock c-axis breach',
      apts_refs: ['APTS-SC-001', 'APTS-HO-012'],
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('halts when escalateOnComplianceTrigger fires with on_match=halt (APTS-HO-014)', async () => {
    mockRun.mockResolvedValueOnce({
      score: 100,
      grade: 'B',
      badge: 'OK',
      blocked: false,
      breakdown: {},
      findings: [
        { id: 'F-pci', severity: 'medium', title: 'PCI exposure', description: 'cardholder data leakage' },
      ],
      scanResults: [],
      stack: { framework: 'nextjs' },
      duration: 100,
      timestamp: new Date().toISOString(),
      confidence: 'high',
    });
    const { escalateOnComplianceTrigger, synthesizeMinimalRoE } = await import('@aegis-scan/core');
    const baseRoE = vi.mocked(synthesizeMinimalRoE).mock.results[0]?.value ?? {};
    vi.mocked(synthesizeMinimalRoE).mockReturnValueOnce({
      ...baseRoE,
      compliance_triggers: { regulatory_class: ['PCI'], on_match: 'halt' },
    } as never);
    vi.mocked(escalateOnComplianceTrigger).mockReturnValueOnce({
      escalate: true,
      action: 'halt',
      reason: 'mock PCI match',
      apts_refs: ['APTS-HO-014'],
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });

  it('rejects malformed delegation_matrix at engagement start (APTS-HO-004)', async () => {
    const { synthesizeMinimalRoE, validateDelegationMatrix } = await import('@aegis-scan/core');
    const baseRoE = vi.mocked(synthesizeMinimalRoE).mock.results[0]?.value ?? {};
    vi.mocked(synthesizeMinimalRoE).mockReturnValueOnce({
      ...baseRoE,
      authorization: {
        ...((baseRoE as { authorization?: Record<string, unknown> }).authorization ?? {}),
        delegation_matrix: 'not-an-array',
      },
    } as never);
    vi.mocked(validateDelegationMatrix).mockReturnValueOnce({
      ok: false,
      errors: ['matrix must be an array'],
      apts_refs: ['APTS-HO-004'],
    });

    const exitCode = await runSiege('.', { target: 'https://example.com', confirm: true });
    expect(exitCode).toBe(1);
  });
});
