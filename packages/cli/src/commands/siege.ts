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
  pinConfig,
  verifyConfig,
  safeFetch,
  isSafeFetchRejection,
  detectAuthorityClaim,
  detectScopeExpansion,
  composeEgressAllowlist,
  validateSandboxMode,
  startKillRequestWatcher,
  startDeadManHeartbeat,
  newHealthCounters,
  runHealthCheck,
  probeTargetIntegrity,
  detectScopeBreach,
  withPhaseTimeout,
  derivePhaseTimeoutMs,
  assignCiaVector,
  evaluateCiaThreshold,
  evaluateApprovalGate,
  evaluateIrreversibleGate,
  validateDelegationMatrix,
  preflightSandboxImages,
  escalateOnSeverity,
  escalateOnConfidence,
  escalateOnComplianceTrigger,
  type RoE,
  type EngagementState,
  type EventSink,
  type NotificationConfig,
  type ConfigPin,
  type IntegrityProbeBaseline,
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
  /** Sandbox mode for LLM-pentest wrappers (APTS-MR-018). One of: docker | firejail | none. Default none. */
  sandboxMode?: string;
  /** APTS-SC-009 — operator dead-man-switch heartbeat URL. CLI override of RoE.safety_controls.heartbeat_url. */
  heartbeatUrl?: string;
  /** APTS-HO-003 — per-phase timeout in minutes (CLI override of RoE.stop_conditions.phase_timeout_minutes). */
  phaseTimeoutMinutes?: number;
  /**
   * Operator opt-in to permit safeFetch against loopback IPs for legitimate
   * local-pentest workflows. Default false. When true: emits a yellow warning
   * + an "operator-acknowledged-loopback" audit event, and passes
   * allowLoopback:true to every safeFetch call. Does NOT bypass private-IP,
   * link-local, or cloud-metadata rejection.
   */
  allowLoopback?: boolean;
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
  allowLoopback: boolean,
): Promise<ReconResult> {
  spinner.text = 'Phase 1/4: Reconnaissance...';

  let framework = 'unknown';
  let tlsInfo: string | null = null;

  // Tech fingerprinting via HTTP headers — APTS-MR-007/008/009 safeFetch
  // hardened path (manual redirect re-validation, DNS-rebind defense, SSRF
  // guard against private/link-local/cloud-metadata IPs).
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await safeFetch(target, {
      method: 'HEAD',
      signal: controller.signal,
      allowLoopback,
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
  } catch (err) {
    if (isSafeFetchRejection(err)) {
      // safeFetch rejected the URL outright — this is a policy event, not a
      // network blip. Surface it so the operator sees why recon was skipped.
      spinner.warn(`safeFetch rejected target ${target}: ${err.reason}`);
    }
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

  // --- APTS-MR-018: validate sandbox-mode flag, propagate to wrapper child processes via env. ---
  const sandboxValidation = validateSandboxMode(options.sandboxMode);
  if (!sandboxValidation.ok) {
    console.error(chalk.red(`\n--sandbox-mode validation failed: ${sandboxValidation.reason}`));
    return 1;
  }
  const sandboxMode = sandboxValidation.mode ?? roe.sandboxing.mode;
  // RoE sandboxing.mode acts as a policy floor — if the operator declared
  // a stricter mode in the RoE, the CLI flag cannot weaken it.
  const effectiveSandboxMode =
    roe.sandboxing.mode !== 'none' && sandboxMode === 'none' ? roe.sandboxing.mode : sandboxMode;

  // APTS-MR-018 docker preflight: when docker mode is selected, every
  // referenced wrapper image AND the egress network must already exist.
  // This closes the audit-flagged gap where docker-mode could be selected
  // against non-existent images (operator would discover only at exec time).
  if (effectiveSandboxMode === 'docker') {
    const preflight = preflightSandboxImages({
      wrappers: ['strix', 'ptai', 'pentestswarm'],
      imageOverrides: roe.sandboxing.image_overrides,
      dockerNetwork: roe.sandboxing.docker_network,
    });
    if (!preflight.ok) {
      console.error(chalk.red(`\nAPTS-MR-018 sandbox preflight FAILED:\n`));
      console.error(chalk.yellow(preflight.remediation ?? '<no remediation>'));
      return 1;
    }
  }

  // --- APTS-MR-011: compose egress allowlist from RoE in_scope + LLM-essentials,
  //     propagate to wrapper child processes. Wrappers consume AEGIS_EGRESS_ALLOWLIST;
  //     in docker mode the allowlist is enforced via the chosen network. ---
  const egressAllowlist = composeEgressAllowlist(roe, { includeLlmEssentials: true });
  process.env.AEGIS_SANDBOX_MODE = effectiveSandboxMode;
  process.env.AEGIS_EGRESS_ALLOWLIST = egressAllowlist.envValue;

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

  // APTS-SC-010 — health counters mutated as events flow; runHealthCheck snapshots them at every phase boundary.
  const healthCounters = newHealthCounters();
  const healthThresholds = roe.safety_controls?.health_thresholds ?? {};

  // APTS-SC-009 — multi-path kill: file-based marker + dead-man heartbeat, complementing the existing signal-based path.
  let killRequested = false;
  const killWatcher = options.stateFile
    ? startKillRequestWatcher({
        markerPath: `${options.stateFile}.killreq`,
        onKillRequest: (path) => {
          killRequested = true;
          spinner.warn(`kill request received via ${path}`);
        },
      })
    : { stop: () => undefined };
  const heartbeatUrl = options.heartbeatUrl ?? roe.safety_controls?.heartbeat_url;
  const heartbeatIntervalMs = (roe.safety_controls?.heartbeat_interval_seconds ?? 30) * 1_000;
  let heartbeatFailed = false;
  const heartbeatHandle = heartbeatUrl
    ? startDeadManHeartbeat({
        url: heartbeatUrl,
        intervalMs: heartbeatIntervalMs,
        onMissedThreshold: (n) => {
          heartbeatFailed = true;
          spinner.warn(`dead-man-switch: ${n} consecutive heartbeats missed — halting`);
        },
      })
    : { stop: () => undefined };

  // APTS-HO-003 — per-phase timeout (default 30 min, override via RoE.stop_conditions.phase_timeout_minutes or CLI flag).
  const phaseTimeoutMs = derivePhaseTimeoutMs(
    {
      max_duration_minutes: roe.stop_conditions.max_duration_minutes,
      phase_timeout_minutes:
        options.phaseTimeoutMinutes ?? roe.stop_conditions.phase_timeout_minutes,
    },
    30 * 60_000,
  );

  // APTS-HO-004 — validate the operator-supplied delegation matrix at engagement start.
  // Failed validation halts immediately so the audit trail records the bad shape.
  if (roe.authorization.delegation_matrix !== undefined) {
    const matrixValidation = validateDelegationMatrix(roe.authorization.delegation_matrix);
    if (!matrixValidation.ok) {
      console.error(chalk.red('\nRoE.authorization.delegation_matrix validation failed:'));
      for (const err of matrixValidation.errors) console.error(chalk.red(`  - ${err}`));
      return 1;
    }
  }

  // APTS-MR-004 + MR-012: pin the SHA-256 of the canonical RoE at engagement-start.
  // verifyConfig is re-called at every phase boundary; mismatch → halt.
  const roePin: ConfigPin = pinConfig('roe', roe);
  emit(
    makeEvent(engagementId, 'scope-validation', {
      target: roe.roe_id,
      action: 'roe-config-integrity-pin',
      allowed: true,
      reason: `RoE pinned: hash=${roePin.hash} at ${roePin.pinned_at}`,
      apts_refs: ['APTS-MR-004', 'APTS-MR-012'],
    }),
  );

  /**
   * Halt the engagement when a finding-text scan trips a manipulation-resistance
   * detector (authority claim or scope-expansion social engineering). Emits a
   * critical-finding event with stop_action 'halt' so the audit trail captures
   * the trigger; caller short-circuits the orchestration loop afterward.
   */
  const haltOnFindingTextRisk = (f: Finding): { halt: boolean; reason?: string } => {
    const text = `${f.title}\n${f.description ?? ''}`;
    const authorityCheck = detectAuthorityClaim(text);
    if (authorityCheck.suggested_action === 'reject') {
      emit(
        makeEvent(engagementId, 'critical-finding', {
          finding_id: f.id,
          severity: f.severity,
          title: f.title,
          ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
          stop_action: 'halt',
        }),
      );
      return {
        halt: true,
        reason: `APTS-MR-005 authority-claim "${authorityCheck.claim}" rejected — operator confirmation required (matched "${authorityCheck.matched_phrase ?? ''}")`,
      };
    }
    const scopeCheck = detectScopeExpansion(text);
    if (scopeCheck.detected) {
      emit(
        makeEvent(engagementId, 'critical-finding', {
          finding_id: f.id,
          severity: f.severity,
          title: f.title,
          ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
          stop_action: 'halt',
        }),
      );
      return {
        halt: true,
        reason: `APTS-MR-010 scope-expansion phrase ("${scopeCheck.kind}") in finding text — engagement halted (matched "${scopeCheck.matched_phrase ?? ''}")`,
      };
    }
    // APTS-AL-016 — per-finding boundary breach detection.
    const breach = detectScopeBreach(
      {
        target: (f as { target?: string }).target,
        file: f.file ?? undefined,
        location: (f as { location?: string }).location,
      },
      roe,
    );
    emit(
      makeEvent(engagementId, 'scope-validation', {
        target: breach.inspected || f.id,
        action: 'finding-emitted',
        allowed: breach.in_scope,
        reason: breach.decision.reason,
        apts_refs: breach.apts_refs,
      }),
    );
    if (!breach.in_scope) {
      return {
        halt: true,
        reason: `APTS-AL-016 boundary breach in finding ${f.id}: ${breach.decision.reason}`,
      };
    }
    // APTS-SC-001 — assign CIA vector + APTS-HO-012 — evaluate threshold breach.
    if (!f.cia_vector) {
      f.cia_vector = assignCiaVector(f);
    }
    if (roe.escalation?.cia_threshold) {
      const cia = evaluateCiaThreshold(f.cia_vector, roe.escalation.cia_threshold);
      if (cia.breach) {
        emit(
          makeEvent(engagementId, 'critical-finding', {
            finding_id: f.id,
            severity: f.severity,
            title: f.title,
            ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
            stop_action: 'halt',
          }),
        );
        return { halt: true, reason: `APTS-HO-012 ${cia.rationale}` };
      }
    }
    // APTS-HO-011 — severity-based unexpected-finding escalation.
    const sevDecision = escalateOnSeverity(f, { threshold: roe.escalation?.severity_threshold });
    if (sevDecision.escalate && sevDecision.action === 'halt') {
      emit(
        makeEvent(engagementId, 'critical-finding', {
          finding_id: f.id,
          severity: f.severity,
          title: f.title,
          ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
          stop_action: 'halt',
        }),
      );
      // Severity-based escalation only halts when the operator has opted in via a non-default threshold;
      // otherwise the existing critical-finding stop_action path already covers high-severity halts.
      if (roe.escalation?.severity_threshold !== undefined) {
        return { halt: true, reason: `APTS-HO-011 ${sevDecision.reason}` };
      }
    }
    // APTS-HO-013 — confidence-based pause when operator opted in.
    const confDecision = escalateOnConfidence(f, { pause_on_low: roe.escalation?.pause_on_low_confidence });
    if (confDecision.escalate && confDecision.action === 'halt') {
      emit(
        makeEvent(engagementId, 'critical-finding', {
          finding_id: f.id,
          severity: f.severity,
          title: f.title,
          ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
          stop_action: 'halt',
        }),
      );
      return { halt: true, reason: `APTS-HO-013 ${confDecision.reason}` };
    }
    // APTS-HO-014 — regulatory-class compliance trigger.
    if (roe.compliance_triggers !== undefined) {
      const compDecision = escalateOnComplianceTrigger(f, roe.compliance_triggers);
      if (compDecision.escalate && compDecision.action === 'halt') {
        emit(
          makeEvent(engagementId, 'critical-finding', {
            finding_id: f.id,
            severity: f.severity,
            title: f.title,
            ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
            stop_action: 'halt',
          }),
        );
        return { halt: true, reason: `APTS-HO-014 ${compDecision.reason}` };
      }
    }
    return { halt: false };
  };

  /**
   * APTS-HO-001 + HO-010 — pre-phase approval gate. Returns `halt: true`
   * with a reason when:
   *   (a) the autonomy-level requires approval and none has been granted, OR
   *   (b) the phase declares irreversible-action classes and they are not
   *       per-level pre-approved (engagement-wide --confirm cannot bypass).
   * The orchestrator emits a halt event and stops.
   */
  const evaluatePhaseApproval = (
    phase: string,
  ): { halt: boolean; reason?: string; apts_refs?: string[] } => {
    const decision = evaluateApprovalGate(phase, roe.autonomy_levels, options.confirm === true);
    if (!decision.allowed) {
      return { halt: true, reason: `APTS-HO-001/010 ${decision.reason}`, apts_refs: decision.apts_refs };
    }
    // HO-010 — separate irreversible-action gate. Even when the AL gate
    // passes, irreversible classes require explicit `pre_approved: true`.
    const irrev = evaluateIrreversibleGate(phase, roe.autonomy_levels);
    if (!irrev.allowed) {
      return { halt: true, reason: `APTS-HO-010 ${irrev.reason}`, apts_refs: irrev.apts_refs };
    }
    return { halt: false };
  };

  /**
   * Run all per-phase safety checks (kill request, heartbeat, health
   * thresholds). Returns { halt: true, reason } on any breach so the
   * caller can halt + emit + uninstall handlers.
   */
  const runSafetyChecks = (phaseLabel: string): { halt: boolean; reason?: string; apts_refs?: string[] } => {
    if (killRequested) {
      return { halt: true, reason: `APTS-SC-009 kill request marker detected after ${phaseLabel}`, apts_refs: ['APTS-SC-009'] };
    }
    if (heartbeatFailed) {
      return { halt: true, reason: `APTS-SC-009 dead-man-switch consecutive heartbeats missed after ${phaseLabel}`, apts_refs: ['APTS-SC-009'] };
    }
    const health = runHealthCheck(healthCounters, healthThresholds);
    if (!health.ok) {
      return { halt: true, reason: `APTS-SC-010 ${health.reason ?? 'health check failed'}`, apts_refs: health.apts_refs };
    }
    return { halt: false };
  };

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
  // Pass the ChainedEmitter so signal-emitted kill/intervention events
  // chain into the same hash chain as the regular flow (audit-verify
  // continues to validate after a signal kill).
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
    chainEmitter: chain,
  });

  const spinner = ora('Verifying target reachability...').start();

  // APTS-SC-015 — record pre-engagement baseline for the post-test integrity probe.
  let integrityBaseline: IntegrityProbeBaseline | undefined;

  // Operator opt-in for testing against loopback (local dev servers).
  // Emits a yellow warning + an audit event so post-hoc review sees the override.
  if (options.allowLoopback) {
    console.log(
      chalk.yellow(
        '\n⚠ --allow-loopback set: safeFetch will permit 127.x.x.x and ::1. Local-pentest only — never enable in production engagements.\n',
      ),
    );
    emit(
      makeEvent(engagementId, 'operator-acknowledged-loopback', {
        target: options.target,
        apts_refs: ['APTS-MR-007', 'APTS-MR-008', 'APTS-MR-009'],
        warning: 'safeFetch loopback policy bypassed by operator opt-in',
      }),
    );
  }

  try {
    // Verify target is reachable — APTS-MR-007/008/009 hardened path.
    // Baseline response-time captured here for the SC-015 post-test integrity probe.
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const baselineStart = Date.now();
      const res = await safeFetch(options.target, {
        method: 'HEAD',
        signal: controller.signal,
        allowLoopback: options.allowLoopback === true,
      });
      clearTimeout(timeout);
      integrityBaseline = {
        baseline_response_ms: Date.now() - baselineStart,
        baseline_status: res.status,
      };
      healthCounters.last_target_response_ms = integrityBaseline.baseline_response_ms;
      if (!res.ok && res.status >= 500) {
        spinner.warn(`Target returned ${res.status} — proceeding anyway`);
      }
    } catch (fetchErr) {
      if (isSafeFetchRejection(fetchErr)) {
        spinner.fail(`Target ${options.target} rejected by safeFetch policy: ${fetchErr.reason}`);
        emit(
          makeEvent(engagementId, 'halt', {
            reason: `APTS-MR-007/008/009 safeFetch rejected target: ${fetchErr.reason}`,
            apts_refs: ['APTS-MR-007', 'APTS-MR-008', 'APTS-MR-009'],
          }),
        );
        handlers.uninstall();
        return 1;
      }
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
      const reconApproval = evaluatePhaseApproval('recon');
      if (reconApproval.halt) {
        spinner.fail(reconApproval.reason ?? 'pre-phase approval required');
        emit(makeEvent(engagementId, 'halt', { reason: reconApproval.reason ?? 'pre-phase approval required', apts_refs: ['APTS-HO-001', 'APTS-HO-010'] }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      emit(makeEvent(engagementId, 'phase-transition', { phase: 'recon', transition: 'enter' }));
      const phaseStart = Date.now();
      // APTS-HO-003 — per-phase decision-timeout with default-safe halt.
      const reconResult = await withPhaseTimeout(
        runReconnaissance(resolvedPath, options.target, spinner, options.allowLoopback === true),
        { phase: 'recon', timeout_ms: phaseTimeoutMs },
      );
      if (reconResult.timed_out) {
        spinner.fail(reconResult.reason);
        emit(makeEvent(engagementId, 'halt', { reason: reconResult.reason, apts_refs: reconResult.apts_refs }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      recon = reconResult.value;
      healthCounters.total_events += 1;
      // APTS-SE-008 — per-phase temporal-envelope recheck after each phase
      const tAfter1 = validateTemporalEnvelope(roe);
      if (!tAfter1.allowed) {
        spinner.fail(`Temporal envelope check failed after Phase 1 (recon): ${tAfter1.reason}`);
        emit(makeEvent(engagementId, 'halt', { reason: tAfter1.reason, apts_refs: tAfter1.apts_refs }));
        handlers.uninstall();
        return 1;
      }
      // APTS-MR-004 + MR-012 — verify pinned RoE config integrity at phase boundary.
      const cAfter1 = verifyConfig(roe, roePin);
      if (!cAfter1.ok) {
        spinner.fail(`Config integrity check failed after Phase 1 (recon): ${cAfter1.reason}`);
        emit(makeEvent(engagementId, 'halt', { reason: cAfter1.reason ?? 'config integrity violation', apts_refs: cAfter1.apts_refs }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      // APTS-SC-009 + SC-010 — kill request, heartbeat, health thresholds.
      const safety1 = runSafetyChecks('Phase 1 (recon)');
      if (safety1.halt) {
        spinner.fail(safety1.reason ?? 'safety check failed');
        emit(makeEvent(engagementId, 'halt', { reason: safety1.reason ?? 'safety check failed', apts_refs: safety1.apts_refs }));
        killWatcher.stop();
        heartbeatHandle.stop();
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
      const discoveryApproval = evaluatePhaseApproval('discovery');
      if (discoveryApproval.halt) {
        spinner.fail(discoveryApproval.reason ?? 'pre-phase approval required');
        emit(makeEvent(engagementId, 'halt', { reason: discoveryApproval.reason ?? 'pre-phase approval required', apts_refs: ['APTS-HO-001', 'APTS-HO-010'] }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      emit(makeEvent(engagementId, 'phase-transition', { phase: 'discovery', transition: 'enter' }));
      const phaseStart = Date.now();
      const discoveryResult = await withPhaseTimeout(
        runVulnerabilityDiscovery(resolvedPath, options.target, spinner),
        { phase: 'discovery', timeout_ms: phaseTimeoutMs },
      );
      if (discoveryResult.timed_out) {
        spinner.fail(discoveryResult.reason);
        emit(makeEvent(engagementId, 'halt', { reason: discoveryResult.reason, apts_refs: discoveryResult.apts_refs }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      auditResult = discoveryResult.value;
      healthCounters.total_events += 1;
      const tAfter2 = validateTemporalEnvelope(roe);
      if (!tAfter2.allowed) {
        spinner.fail(`Temporal envelope check failed after Phase 2 (discovery): ${tAfter2.reason}`);
        emit(makeEvent(engagementId, 'halt', { reason: tAfter2.reason, apts_refs: tAfter2.apts_refs }));
        handlers.uninstall();
        return 1;
      }
      const cAfter2 = verifyConfig(roe, roePin);
      if (!cAfter2.ok) {
        spinner.fail(`Config integrity check failed after Phase 2 (discovery): ${cAfter2.reason}`);
        emit(makeEvent(engagementId, 'halt', { reason: cAfter2.reason ?? 'config integrity violation', apts_refs: cAfter2.apts_refs }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      const safety2 = runSafetyChecks('Phase 2 (discovery)');
      if (safety2.halt) {
        spinner.fail(safety2.reason ?? 'safety check failed');
        emit(makeEvent(engagementId, 'halt', { reason: safety2.reason ?? 'safety check failed', apts_refs: safety2.apts_refs }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      // Stream individual findings as JSONL events; flag criticals for stop_conditions.
      for (const f of auditResult.findings) {
        emit(findingEvent(engagementId, f));
        healthCounters.total_events += 1;
        if (isCriticalSeverity(f.severity)) {
          emit(makeEvent(engagementId, 'critical-finding', {
            finding_id: f.id,
            severity: f.severity,
            title: f.title,
            ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
            stop_action: roe.stop_conditions.on_critical_finding,
          }));
        }
        // APTS-MR-005 + MR-010 + AL-016 — finding-text manipulation-resistance scan + boundary breach.
        const risk = haltOnFindingTextRisk(f);
        if (risk.halt) {
          spinner.fail(`Manipulation-resistance halt: ${risk.reason}`);
          emit(makeEvent(engagementId, 'halt', { reason: risk.reason ?? 'manipulation-resistance halt', apts_refs: ['APTS-MR-005', 'APTS-MR-010', 'APTS-AL-016'] }));
          killWatcher.stop();
          heartbeatHandle.stop();
          handlers.uninstall();
          return 1;
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
      const exploitApproval = evaluatePhaseApproval('exploitation');
      if (exploitApproval.halt) {
        spinner.fail(exploitApproval.reason ?? 'pre-phase approval required');
        emit(makeEvent(engagementId, 'halt', { reason: exploitApproval.reason ?? 'pre-phase approval required', apts_refs: ['APTS-HO-001', 'APTS-HO-010'] }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      emit(makeEvent(engagementId, 'phase-transition', { phase: 'exploitation', transition: 'enter' }));
      const phaseStart = Date.now();
      const exploitResult = await withPhaseTimeout(
        runExploitationAttempts(
          resolvedPath,
          options.target,
          highCritical.length,
          spinner,
        ),
        { phase: 'exploitation', timeout_ms: phaseTimeoutMs },
      );
      if (exploitResult.timed_out) {
        spinner.fail(exploitResult.reason);
        emit(makeEvent(engagementId, 'halt', { reason: exploitResult.reason, apts_refs: exploitResult.apts_refs }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      attackFindings = exploitResult.value;
      healthCounters.total_events += 1;
      const tAfter3 = validateTemporalEnvelope(roe);
      if (!tAfter3.allowed) {
        spinner.fail(`Temporal envelope check failed after Phase 3 (exploitation): ${tAfter3.reason}`);
        emit(makeEvent(engagementId, 'halt', { reason: tAfter3.reason, apts_refs: tAfter3.apts_refs }));
        handlers.uninstall();
        return 1;
      }
      const cAfter3 = verifyConfig(roe, roePin);
      if (!cAfter3.ok) {
        spinner.fail(`Config integrity check failed after Phase 3 (exploitation): ${cAfter3.reason}`);
        emit(makeEvent(engagementId, 'halt', { reason: cAfter3.reason ?? 'config integrity violation', apts_refs: cAfter3.apts_refs }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      const safety3 = runSafetyChecks('Phase 3 (exploitation)');
      if (safety3.halt) {
        spinner.fail(safety3.reason ?? 'safety check failed');
        emit(makeEvent(engagementId, 'halt', { reason: safety3.reason ?? 'safety check failed', apts_refs: safety3.apts_refs }));
        killWatcher.stop();
        heartbeatHandle.stop();
        handlers.uninstall();
        return 1;
      }
      for (const f of attackFindings) {
        emit(findingEvent(engagementId, f));
        healthCounters.total_events += 1;
        if (isCriticalSeverity(f.severity)) {
          emit(makeEvent(engagementId, 'critical-finding', {
            finding_id: f.id,
            severity: f.severity,
            title: f.title,
            ...(f.cwe !== undefined ? { cwe: f.cwe } : {}),
            stop_action: roe.stop_conditions.on_critical_finding,
          }));
        }
        const risk = haltOnFindingTextRisk(f);
        if (risk.halt) {
          spinner.fail(`Manipulation-resistance halt: ${risk.reason}`);
          emit(makeEvent(engagementId, 'halt', { reason: risk.reason ?? 'manipulation-resistance halt', apts_refs: ['APTS-MR-005', 'APTS-MR-010', 'APTS-AL-016'] }));
          killWatcher.stop();
          heartbeatHandle.stop();
          handlers.uninstall();
          return 1;
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

    // APTS-SC-015 — post-test target integrity probe.
    const integrity = await probeTargetIntegrity(options.target, {
      baseline: integrityBaseline,
      allowLoopback: options.allowLoopback === true,
    });
    emit(
      makeEvent(engagementId, 'scope-validation', {
        target: options.target,
        action: 'post-test-integrity-probe',
        allowed: integrity.ok,
        reason: integrity.reason ?? `target responsive after engagement (status ${integrity.observed?.status}, ${integrity.observed?.response_ms} ms)`,
        apts_refs: integrity.apts_refs,
      }),
    );

    emit(
      makeEvent(engagementId, 'completion', {
        duration_ms: Date.now() - Date.parse(roe.temporal.start),
        total_findings: allFindings.length,
        score: mergedResult.score,
        grade: mergedResult.grade,
        blocked: mergedResult.blocked,
      }),
    );
    killWatcher.stop();
    heartbeatHandle.stop();
    handlers.uninstall();

    return mergedResult.blocked ? 1 : 0;
  } catch (err) {
    spinner.fail('Siege failed');
    console.error(err instanceof Error ? err.message : String(err));
    healthCounters.error_events += 1;
    emit(
      makeEvent(engagementId, 'halt', {
        reason: `unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      }),
    );
    killWatcher.stop();
    heartbeatHandle.stop();
    handlers.uninstall();
    return 1;
  }
}
