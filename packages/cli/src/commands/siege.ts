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
  type RoE,
} from '@aegis-scan/core';
import type { AuditResult, Finding, ScanCategory } from '@aegis-scan/core';
import { getAllScanners, getAttackScanners } from '@aegis-scan/scanners';
import { selectReporter, writeStdout } from '../utils.js';
import { relative } from 'path';

export interface SiegeOptions {
  target: string;
  roe?: string;
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
    const recon = await runReconnaissance(resolvedPath, options.target, spinner);
    // APTS-SE-008 — per-phase temporal-envelope recheck after each phase
    const tAfter1 = validateTemporalEnvelope(roe);
    if (!tAfter1.allowed) {
      spinner.fail(`Temporal envelope check failed after Phase 1 (recon): ${tAfter1.reason}`);
      return 1;
    }

    console.log(chalk.cyan(`  Discovered ${recon.routeCount} routes, ${recon.endpointCount} endpoints, framework: ${recon.framework}`));
    if (recon.tlsInfo) {
      console.log(chalk.dim(`  TLS: ${recon.tlsInfo}`));
    }

    // --- Phase 2: Vulnerability Discovery ---
    const auditResult = await runVulnerabilityDiscovery(resolvedPath, options.target, spinner);
    const tAfter2 = validateTemporalEnvelope(roe);
    if (!tAfter2.allowed) {
      spinner.fail(`Temporal envelope check failed after Phase 2 (discovery): ${tAfter2.reason}`);
      return 1;
    }
    const highCritical = auditResult.findings.filter(
      (f) => f.severity === 'high' || f.severity === 'critical' || f.severity === 'blocker',
    );
    console.log(chalk.cyan(`  Found ${auditResult.findings.length} findings (${highCritical.length} HIGH/CRITICAL)`));

    // --- Phase 3: Exploitation Attempts ---
    const attackFindings = await runExploitationAttempts(
      resolvedPath,
      options.target,
      highCritical.length,
      spinner,
    );
    const tAfter3 = validateTemporalEnvelope(roe);
    if (!tAfter3.allowed) {
      spinner.fail(`Temporal envelope check failed after Phase 3 (exploitation): ${tAfter3.reason}`);
      return 1;
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

    return mergedResult.blocked ? 1 : 0;
  } catch (err) {
    spinner.fail('Siege failed');
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}
