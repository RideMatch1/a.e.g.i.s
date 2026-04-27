import chalk from 'chalk';
import ora from 'ora';
import {
  loadConfig,
  Orchestrator,
  walkFiles,
  readFileSafe,
  loadRoE,
  synthesizeMinimalRoE,
  validateTemporalEnvelope,
  validateTargetInScope,
  initStateFile,
  emitEvent,
  makeEvent,
  findingEvent,
  isCriticalSeverity,
  writeEngagementState,
  loadEngagementState,
  installSignalHandlers,
  dispatchNotification,
  ChainedEmitter,
  type RoE,
  type EngagementState,
  type EventSink,
  type NotificationConfig,
} from '@aegis-scan/core';
import type { AuditResult, Finding, ScanCategory } from '@aegis-scan/core';
import { getAllScanners, getAttackScanners } from '@aegis-scan/scanners';
import { selectReporter, writeStdout } from '../utils.js';
import { relative } from 'path';

export interface SiegeOptions {
  target: string;
  roe?: string;
  /** Path to write JSONL engagement events + final-state JSON for resume. */
  stateFile?: string;
  /** Path of a prior engagement-state JSON to resume from (skips already-completed phases). */
  resume?: string;
  /** Webhook URL(s) to POST critical events (engagement-start, critical-finding, halt, kill, completion). Repeatable. */
  notifyWebhook?: string[];
  format?: string;
  confirm?: boolean;
  color?: boolean;
}

interface ReconResult {
  routeCount: number;
  endpointCount: number;
  framework: string;
  tlsInfo: string | null;
  routes: string[];
}

/**
 * Phase 1: Reconnaissance
 * - Tech fingerprinting from HTTP headers
 * - Map API routes from project files
 * - Check TLS cert info
 */
async function runReconnaissance(
  projectPath: string,
  target: string,
  spinner: ReturnType<typeof ora>,
): Promise<ReconResult> {
  spinner.text = 'Phase 1/4: Reconnaissance...';

  let framework = 'unknown';
  let tlsInfo: string | null = null;

  // Tech fingerprinting via HTTP headers
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(target, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    // Detect framework from headers
    const poweredBy = response.headers.get('x-powered-by') ?? '';
    const server = response.headers.get('server') ?? '';
    const via = response.headers.get('via') ?? '';

    if (poweredBy.includes('Next.js') || response.headers.get('x-nextjs-cache')) {
      framework = 'Next.js';
    } else if (poweredBy.includes('Express')) {
      framework = 'Express';
    } else if (server.includes('nginx')) {
      framework = 'nginx';
    } else if (via.includes('Vercel') || response.headers.get('x-vercel-id')) {
      framework = 'Vercel (Next.js)';
    }

    // TLS info
    if (target.startsWith('https://')) {
      tlsInfo = 'HTTPS enabled';
    }
  } catch {
    // Target unreachable for fingerprinting — continue
  }

  // Map API routes from project files
  const routeFiles = walkFiles(projectPath, [
    'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
  ], ['ts', 'js', 'tsx', 'jsx']);

  const routes: string[] = [];
  for (const file of routeFiles) {
    const rel = relative(projectPath, file);
    const isApiRoute =
      /(?:^|\/)app\/api\/.*\/route\.[tj]sx?$/.test(rel) ||
      /(?:^|\/)pages\/api\/.*\.[tj]sx?$/.test(rel);

    if (isApiRoute) {
      let routePath = rel
        .replace(/^src\//, '')
        .replace(/^app\/api\//, '/api/')
        .replace(/^pages\/api\//, '/api/')
        .replace(/\/route\.[tj]sx?$/, '')
        .replace(/\.[tj]sx?$/, '');
      routePath = routePath.replace(/\[([^\]]+)\]/g, ':$1');
      routes.push(routePath);
    }
  }

  // Count page routes too
  const pageRoutes: string[] = [];
  for (const file of routeFiles) {
    const rel = relative(projectPath, file);
    const isPageRoute =
      /(?:^|\/)app\/.*\/page\.[tj]sx?$/.test(rel) ||
      /(?:^|\/)pages\/(?!api\/).*\.[tj]sx?$/.test(rel);

    if (isPageRoute) {
      pageRoutes.push(rel);
    }
  }

  const result: ReconResult = {
    routeCount: routes.length + pageRoutes.length,
    endpointCount: routes.length,
    framework,
    tlsInfo,
    routes,
  };

  spinner.text = `Phase 1/4: Reconnaissance — Discovered ${result.routeCount} routes, ${result.endpointCount} endpoints, framework: ${result.framework}`;

  return result;
}

/**
 * Phase 2: Vulnerability Discovery
 * Runs ALL existing AEGIS scanners (equivalent to aegis audit).
 */
async function runVulnerabilityDiscovery(
  projectPath: string,
  target: string,
  spinner: ReturnType<typeof ora>,
): Promise<AuditResult> {
  const config = await loadConfig(projectPath, 'siege');
  config.target = target;

  const orchestrator = new Orchestrator();
  const allScanners = getAllScanners();
  for (const scanner of allScanners) {
    orchestrator.register(scanner);
  }

  spinner.text = `Phase 2/4: Vulnerability Discovery — Running ${allScanners.length} scanners...`;

  const result = await orchestrator.run(config);

  const highCritical = result.findings.filter(
    (f) => f.severity === 'high' || f.severity === 'critical' || f.severity === 'blocker',
  );
  spinner.text = `Phase 2/4: Vulnerability Discovery — Found ${result.findings.length} findings (${highCritical.length} HIGH/CRITICAL)`;

  return result;
}

/**
 * Phase 3: Exploitation Attempts
 * Runs attack verification scanners against live target.
 * Only runs SAFE verification — no destructive actions.
 */
async function runExploitationAttempts(
  projectPath: string,
  target: string,
  highCriticalCount: number,
  spinner: ReturnType<typeof ora>,
): Promise<Finding[]> {
  spinner.text = `Phase 3/4: Exploitation Attempts — Verifying ${highCriticalCount} HIGH/CRITICAL findings...`;

  const config = await loadConfig(projectPath, 'siege');
  config.target = target;

  const orchestrator = new Orchestrator();
  const attackScanners = getAttackScanners();
  for (const scanner of attackScanners) {
    orchestrator.register(scanner);
  }

  const result = await orchestrator.run(config);

  spinner.text = `Phase 3/4: Exploitation Attempts — ${result.findings.length} verified vulnerabilities`;

  return result.findings;
}

/**
 * aegis siege — Multi-phase adversary simulation.
 *
 * Runs 4 sequential phases:
 * 1. Reconnaissance (tech fingerprinting, route mapping, TLS check)
 * 2. Vulnerability Discovery (all AEGIS scanners)
 * 3. Exploitation Attempts (safe verification of HIGH/CRITICAL findings)
 * 4. Report Generation (attack narrative + scoring)
 */
export async function runSiege(
  path: string,
  options: SiegeOptions,
): Promise<number> {
  if (!options.target) {
    console.error(chalk.red('Error: --target <url> is required for siege mode.'));
    console.error(chalk.dim('Example: aegis siege . --target https://example.com'));
    return 1;
  }

  // Authorization gate — aegis siege sends LIVE HTTP requests
  if (!options.confirm) {
    console.error(chalk.red.bold('\n  ⚠  AEGIS SIEGE — ACTIVE ATTACK SIMULATION\n'));
    console.error(chalk.yellow(`  Target: ${options.target}`));
    console.error(chalk.yellow('  This will send live HTTP requests to the target URL.'));
    console.error(chalk.yellow('  Only run against systems you own or have explicit authorization to test.\n'));
    console.error(chalk.dim('  Add --confirm to acknowledge and proceed.'));
    console.error(chalk.dim('  Example: aegis siege . --target https://localhost:3000 --confirm\n'));
    return 1;
  }

  const resolvedPath = path || process.cwd();

  // --- RoE gate (APTS-SE-001 / SE-003 / SE-004 / SE-006 / AL-006 / AL-014) ---
  let roe: RoE;
  if (options.roe) {
    const result = loadRoE(options.roe);
    if (!result.ok) {
      console.error(chalk.red(`\nRoE validation failed (${result.phase}):`));
      console.error(chalk.red(result.error));
      console.error(chalk.dim('\nFix the RoE file or omit --roe to fall back to a synthesized minimal RoE.'));
      return 1;
    }
    roe = result.roe;
    console.log(chalk.dim(`  RoE loaded: ${roe.roe_id} (${roe.operator.organization}, authorized by ${roe.operator.authorized_by})`));

    // Pre-engagement temporal-envelope check (APTS-SE-004 + SE-008)
    const temporal = validateTemporalEnvelope(roe);
    if (!temporal.allowed) {
      console.error(chalk.red(`\nRoE temporal-envelope check failed:`));
      console.error(chalk.red(`  ${temporal.reason}`));
      return 1;
    }

    // Pre-engagement target-in-scope check (APTS-SE-003 + SE-006 + AL-006)
    const scope = validateTargetInScope(options.target, roe);
    if (!scope.allowed) {
      console.error(chalk.red(`\nRoE scope check failed:`));
      console.error(chalk.red(`  ${scope.reason}`));
      return 1;
    }
    console.log(chalk.dim(`  RoE scope: ${scope.reason}`));
  } else {
    roe = synthesizeMinimalRoE(options.target);
    console.log(chalk.yellow(`  No --roe file provided — synthesized minimal RoE (${roe.roe_id}). For institutional engagements, author a Rules-of-Engagement JSON file per APTS-SE-001.`));
  }

  // --- Cluster-2: engagement-id + state + JSONL event channel (APTS-HO-002/006/008/015) ---
  let engagementId = `siege-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  let completedPhases: ('recon' | 'discovery' | 'exploitation' | 'reporting')[] = [];
  let findingsCarried: Finding[] = [];

  if (options.resume) {
    const r = loadEngagementState(options.resume);
    if (!r.ok) {
      console.error(chalk.red(`\nResume failed (${r.phase}):`));
      console.error(chalk.red(r.error));
      return 1;
    }
    engagementId = r.state.engagement_id;
    completedPhases = [...r.state.completed_phases];
    findingsCarried = [...r.state.findings_so_far];
    console.log(chalk.dim(`  Resuming engagement ${engagementId} from ${options.resume} — completed: ${completedPhases.join(', ') || '<none>'}, findings carried: ${findingsCarried.length}`));
  }

  const eventSink: EventSink = options.stateFile;
  if (options.stateFile && !options.resume) {
    initStateFile(options.stateFile);
  }

  const notifyConfig: NotificationConfig | null = options.notifyWebhook && options.notifyWebhook.length > 0
    ? { webhooks: options.notifyWebhook }
    : null;

  // APTS-AR-012: Chained emitter maintains the SHA-256 hash chain across
  // emissions. Each event carries prev_hash + this_hash; an audit-verify run
  // detects any post-hoc tampering at the line where the chain breaks.
  const chain = new ChainedEmitter({ sink: eventSink });

  // Helper: emit event via the chain + dispatch to webhooks (notifications
  // are fire-and-forget). The chain emitter writes to eventSink directly.
  const emit = (ev: ReturnType<typeof makeEvent>): void => {
    const chained = chain.emit(ev);
    if (notifyConfig) {
      void dispatchNotification(chained, notifyConfig, eventSink);
    }
  };

  emit(
    makeEvent(engagementId, 'engagement-start', {
      target: options.target,
      roe_id: roe.roe_id,
      roe_synthesized: roe.roe_id.startsWith('synthesized-'),
      mode: 'siege',
    }),
  );

  // APTS-SE-015: scope-enforcement audit event captures the in-scope decision
  // that authorized this engagement. The chained emission means any future
  // tamper with the audit log breaks the chain.
  const scopeDecision = validateTargetInScope(options.target, roe);
  emit(
    makeEvent(engagementId, 'scope-validation', {
      target: options.target,
      action: 'engagement-start',
      allowed: scopeDecision.allowed,
      reason: scopeDecision.reason,
      ...(scopeDecision.apts_refs ? { apts_refs: scopeDecision.apts_refs } : {}),
    }),
  );

  // Persist initial state-snapshot at engagement start (resume-safe baseline).
  const persistState = (reason: string): void => {
    if (!options.stateFile) return;
    const snap: EngagementState = {
      state_version: '0.1.0',
      engagement_id: engagementId,
      target: options.target,
      roe_id: roe.roe_id,
      completed_phases: [...completedPhases],
      findings_so_far: [...findingsCarried],
      paused_at: new Date().toISOString(),
      reason,
    };
    writeEngagementState(options.stateFile, snap);
  };
  persistState('engagement-start');

  // Install signal handlers for graceful pause + kill (APTS-HO-008, AL-012).
  const handlers = installSignalHandlers({
    stateFilePath: options.stateFile ?? null,
    getState: () => ({
      state_version: '0.1.0',
      engagement_id: engagementId,
      target: options.target,
      roe_id: roe.roe_id,
      completed_phases: [...completedPhases],
      findings_so_far: [...findingsCarried],
      paused_at: new Date().toISOString(),
      reason: 'signal-handler',
    }),
    eventSink,
    engagementId,
  });

  const spinner = ora('Verifying target reachability...').start();

  try {
    // Verify target is reachable
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(options.target, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);
      if (!res.ok && res.status >= 500) {
        spinner.warn(`Target returned ${res.status} — proceeding anyway`);
      }
    } catch (fetchErr) {
      spinner.fail(`Target unreachable: ${options.target}`);
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error(chalk.red(`  ${msg}`));
      console.error(chalk.dim('  Make sure the target is running and accessible before running siege.'));
      return 1;
    }

    // --- Phase 1: Reconnaissance ---
    let recon: ReconResult | undefined;
    if (completedPhases.includes('recon')) {
      console.log(chalk.dim(`  Skipping Phase 1 (recon) — already completed in resumed engagement.`));
    } else {
      emit(makeEvent(engagementId, 'phase-transition', { phase: 'recon', transition: 'enter' }));
      const phaseStart = Date.now();
      recon = await runReconnaissance(resolvedPath, options.target, spinner);
      // APTS-SE-008 — per-phase temporal-envelope recheck after each phase
      const tAfter1 = validateTemporalEnvelope(roe);
      if (!tAfter1.allowed) {
        spinner.fail(`Temporal envelope check failed after Phase 1 (recon): ${tAfter1.reason}`);
        emit(makeEvent(engagementId, 'halt', { reason: tAfter1.reason, apts_refs: tAfter1.apts_refs }));
        handlers.uninstall();
        return 1;
      }
      emit(makeEvent(engagementId, 'phase-transition', { phase: 'recon', transition: 'exit', duration_ms: Date.now() - phaseStart }));
      completedPhases.push('recon');
      persistState('phase-recon-complete');

      console.log(chalk.cyan(`  Discovered ${recon.routeCount} routes, ${recon.endpointCount} endpoints, framework: ${recon.framework}`));
      if (recon.tlsInfo) {
        console.log(chalk.dim(`  TLS: ${recon.tlsInfo}`));
      }
    }

    // --- Phase 2: Vulnerability Discovery ---
    let auditResult: AuditResult;
    if (completedPhases.includes('discovery')) {
      console.log(chalk.dim(`  Skipping Phase 2 (discovery) — already completed in resumed engagement.`));
      // Re-derive a minimal auditResult shape from carried findings (no re-scan).
      // The stack/breakdown fields are stale-on-resume but harmless for the
      // Phase-4 reporter, which reads `findings` and re-scores from scratch.
      auditResult = {
        score: 0,
        grade: 'F',
        badge: 'CRITICAL',
        blocked: false,
        breakdown: {},
        findings: findingsCarried,
        scanResults: [],
        stack: {},
        duration: 0,
        timestamp: new Date().toISOString(),
        confidence: 'medium',
      } as unknown as AuditResult;
    } else {
      emit(makeEvent(engagementId, 'phase-transition', { phase: 'discovery', transition: 'enter' }));
      const phaseStart = Date.now();
      auditResult = await runVulnerabilityDiscovery(resolvedPath, options.target, spinner);
      const tAfter2 = validateTemporalEnvelope(roe);
      if (!tAfter2.allowed) {
        spinner.fail(`Temporal envelope check failed after Phase 2 (discovery): ${tAfter2.reason}`);
        emit(makeEvent(engagementId, 'halt', { reason: tAfter2.reason, apts_refs: tAfter2.apts_refs }));
        handlers.uninstall();
        return 1;
      }
      // Stream individual findings as JSONL events; flag criticals for stop_conditions.
      for (const f of auditResult.findings) {
        emit(findingEvent(engagementId, f));
        if (isCriticalSeverity(f.severity)) {
          emit(makeEvent(engagementId, 'critical-finding', {
            finding_id: f.id,
            severity: f.severity,
            title: f.title,
            ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
            stop_action: roe.stop_conditions.on_critical_finding,
          }));
        }
      }
      findingsCarried.push(...auditResult.findings);
      emit(makeEvent(engagementId, 'phase-transition', { phase: 'discovery', transition: 'exit', duration_ms: Date.now() - phaseStart }));
      completedPhases.push('discovery');
      persistState('phase-discovery-complete');
    }
    const highCritical = auditResult.findings.filter(
      (f) => f.severity === 'high' || f.severity === 'critical' || f.severity === 'blocker',
    );
    console.log(chalk.cyan(`  Found ${auditResult.findings.length} findings (${highCritical.length} HIGH/CRITICAL)`));

    // --- Phase 3: Exploitation Attempts ---
    let attackFindings: Finding[];
    if (completedPhases.includes('exploitation')) {
      console.log(chalk.dim(`  Skipping Phase 3 (exploitation) — already completed in resumed engagement.`));
      attackFindings = []; // findings already merged in findingsCarried
    } else {
      emit(makeEvent(engagementId, 'phase-transition', { phase: 'exploitation', transition: 'enter' }));
      const phaseStart = Date.now();
      attackFindings = await runExploitationAttempts(
        resolvedPath,
        options.target,
        highCritical.length,
        spinner,
      );
      const tAfter3 = validateTemporalEnvelope(roe);
      if (!tAfter3.allowed) {
        spinner.fail(`Temporal envelope check failed after Phase 3 (exploitation): ${tAfter3.reason}`);
        emit(makeEvent(engagementId, 'halt', { reason: tAfter3.reason, apts_refs: tAfter3.apts_refs }));
        handlers.uninstall();
        return 1;
      }
      for (const f of attackFindings) {
        emit(findingEvent(engagementId, f));
        if (isCriticalSeverity(f.severity)) {
          emit(makeEvent(engagementId, 'critical-finding', {
            finding_id: f.id,
            severity: f.severity,
            title: f.title,
            ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
            stop_action: roe.stop_conditions.on_critical_finding,
          }));
        }
      }
      findingsCarried.push(...attackFindings);
      emit(makeEvent(engagementId, 'phase-transition', { phase: 'exploitation', transition: 'exit', duration_ms: Date.now() - phaseStart }));
      completedPhases.push('exploitation');
      persistState('phase-exploitation-complete');
    }
    console.log(chalk.cyan(`  Verified ${attackFindings.length} vulnerabilities via live probes`));

    // --- Phase 4: Report Generation ---
    spinner.text = 'Phase 4/4: Generating Report...';

    // Merge all findings: audit findings + attack findings (deduplicated)
    const allFindings = [...auditResult.findings];
    const existingKeys = new Set(
      allFindings.map((f) => `${f.file ?? ''}:${f.line ?? 0}:${f.title}`),
    );
    for (const f of attackFindings) {
      const key = `${f.file ?? ''}:${f.line ?? 0}:${f.title}`;
      if (!existingKeys.has(key)) {
        allFindings.push(f);
        existingKeys.add(key);
      }
    }

    // Create a merged AuditResult for the reporter
    const { calculateScore } = await import('@aegis-scan/core');
    const scoreResult = calculateScore(allFindings, auditResult.confidence);

    const mergedResult: AuditResult = {
      score: scoreResult.score,
      grade: scoreResult.grade,
      badge: scoreResult.badge,
      blocked: scoreResult.blocked,
      blockerReason: scoreResult.blockerReason,
      breakdown: scoreResult.breakdown,
      findings: allFindings,
      scanResults: [
        ...auditResult.scanResults,
        {
          scanner: 'attack-engine',
          category: 'attack' as ScanCategory,
          findings: attackFindings,
          duration: 0,
          available: true,
        },
      ],
      stack: auditResult.stack,
      duration: auditResult.duration,
      timestamp: new Date().toISOString(),
      confidence: auditResult.confidence,
    };

    spinner.stop();

    const reporter = selectReporter(options.format);
    const output = reporter.format(mergedResult);
    await writeStdout(output + '\n');

    completedPhases.push('reporting');
    persistState('phase-reporting-complete');
    emit(
      makeEvent(engagementId, 'completion', {
        duration_ms: Date.now() - Date.parse(roe.temporal.start),
        total_findings: allFindings.length,
        score: mergedResult.score,
        grade: mergedResult.grade,
        blocked: mergedResult.blocked,
      }),
    );
    handlers.uninstall();

    return mergedResult.blocked ? 1 : 0;
  } catch (err) {
    spinner.fail('Siege failed');
    console.error(err instanceof Error ? err.message : String(err));
    emit(
      makeEvent(engagementId, 'halt', {
        reason: `unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      }),
    );
    handlers.uninstall();
    return 1;
  }
}
