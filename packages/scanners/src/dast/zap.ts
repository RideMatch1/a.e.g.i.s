import { exec, commandExists, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

interface ZapAlert {
  riskcode: string;
  name: string;
  desc: string;
  uri?: string;
  cweid?: string;
  instances?: Array<{ uri: string }>;
}

interface ZapReport {
  site?: Array<{
    alerts?: ZapAlert[];
  }>;
}

function mapRiskCode(code: string): Finding['severity'] {
  switch (code) {
    case '3':
      return 'high';
    case '2':
      return 'medium';
    case '1':
      return 'low';
    default:
      return 'info';
  }
}

/** Rewrite localhost URLs to host.docker.internal for Docker access */
function rewriteLocalhostTarget(target: string): string {
  try {
    const url = new URL(target);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = 'host.docker.internal';
      return url.toString();
    }
  } catch {
    // Invalid URL — return as-is, let ZAP handle the error
  }
  return target;
}

function isLocalhostTarget(target: string): boolean {
  try {
    const url = new URL(target);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export const zapScanner: Scanner = {
  name: 'zap',
  description: 'Dynamic Application Security Testing via OWASP ZAP (Docker)',
  category: 'dast',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('docker');
  },

  async scan(_projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const target = config.target;
    if (!target) {
      return {
        scanner: 'zap',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'ZAP requires --target URL',
      };
    }

    // Choose scan type based on mode
    const scanScript = config.mode === 'pentest' ? 'zap-full-scan.py' : 'zap-baseline.py';
    const timeout = config.mode === 'pentest' ? 600_000 : 300_000;

    // Unique tempdir per run — prevents reading stale reports from previous runs
    const reportDir = mkdtempSync(join(tmpdir(), 'aegis-zap-'));
    const reportFile = 'report.json';

    // Rewrite localhost → host.docker.internal so ZAP container can reach the host
    const dockerTarget = rewriteLocalhostTarget(target);

    const dockerArgs: string[] = [
      'run', '--rm',
      '-v', `${reportDir}:/zap/wrk:rw`,
    ];

    if (isLocalhostTarget(target)) {
      dockerArgs.push('--add-host=host.docker.internal:host-gateway');
    }

    dockerArgs.push(
      'ghcr.io/zaproxy/zaproxy:stable',
      scanScript,
      '-t', dockerTarget,
      '-J', reportFile,
      '-I',
    );

    const result = await exec('docker', dockerArgs, { timeout });

    // Only read report if docker exited successfully (exit 0 or 1 = scan complete, 2+ = error)
    if (result.exitCode > 1) {
      rmSync(reportDir, { recursive: true, force: true });
      return {
        scanner: 'zap',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `ZAP Docker exited with code ${result.exitCode}: ${result.stderr.slice(0, 200)}`,
      };
    }

    const reportPath = join(reportDir, reportFile);
    const reportContent = readFileSafe(reportPath);

    // Clean up tempdir
    rmSync(reportDir, { recursive: true, force: true });

    if (!reportContent) {
      return {
        scanner: 'zap',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'ZAP report not generated',
      };
    }

    let report: ZapReport;
    try {
      report = JSON.parse(reportContent) as ZapReport;
    } catch {
      return {
        scanner: 'zap',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'Failed to parse ZAP JSON report',
      };
    }

    const findings: Finding[] = [];
    let idCounter = 1;

    if (report.site) {
      for (const site of report.site) {
        if (!site.alerts) continue;
        for (const alert of site.alerts) {
          const finding: Finding = {
            id: `ZAP-${String(idCounter++).padStart(3, '0')}`,
            scanner: 'zap',
            severity: mapRiskCode(alert.riskcode),
            title: alert.name,
            description: alert.desc,
            category: 'dast',
          };

          if (alert.cweid && alert.cweid !== '-1') {
            finding.cwe = parseInt(alert.cweid, 10) || undefined;
          }

          findings.push(finding);
        }
      }
    }

    return {
      scanner: 'zap',
      category: 'dast',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
