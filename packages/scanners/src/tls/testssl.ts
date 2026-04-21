import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface TestsslFinding {
  id: string;
  ip?: string;
  port?: string;
  severity: string;
  finding: string;
  cve?: string;
}

interface TestsslOutput {
  scanTime?: string;
  version?: string;
  openssl?: string;
  startTime?: string;
  scanResult?: Array<{
    ip?: string;
    port?: string;
    findings?: TestsslFinding[];
  }>;
}

function mapSeverity(raw: string): Finding['severity'] {
  switch (raw.toUpperCase()) {
    case 'CRITICAL':
    case 'FATAL':
      return 'critical';
    case 'HIGH':
    case 'SEVERE':
      return 'high';
    case 'MEDIUM':
    case 'WARN':
      return 'medium';
    case 'LOW':
    case 'OK':
    case 'INFO':
    case 'HINT':
      return 'low';
    default:
      return 'info';
  }
}

export const testsslScanner: Scanner = {
  name: 'testssl',
  description: 'TLS/SSL configuration and certificate analysis via testssl.sh',
  category: 'infrastructure',
  isExternal: true,

  async isAvailable(_projectPath: string): Promise<boolean> {
    const [testsslExists, testsslShExists] = await Promise.all([
      commandExists('testssl'),
      commandExists('testssl.sh'),
    ]);
    return testsslExists || testsslShExists;
  },

  async scan(_projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const target = config.target;
    if (!target) {
      return {
        scanner: 'testssl',
        category: 'infrastructure',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'testssl scanner requires config.target to be set',
      };
    }

    // Prefer 'testssl' over 'testssl.sh'
    const command = (await commandExists('testssl')) ? 'testssl' : 'testssl.sh';

    const result = await exec(command, ['--jsonfile', '-', target]);

    const rawOutput = result.stdout || result.stderr;

    let parsed: TestsslOutput;
    try {
      parsed = JSON.parse(rawOutput) as TestsslOutput;
    } catch {
      return {
        scanner: 'testssl',
        category: 'infrastructure',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `Failed to parse testssl JSON output: ${rawOutput.slice(0, 200)}`,
      };
    }

    const findings: Finding[] = [];
    let idCounter = 1;

    for (const scanResult of parsed.scanResult ?? []) {
      for (const finding of scanResult.findings ?? []) {
        const sev = mapSeverity(finding.severity);
        // Skip purely informational findings
        if (sev === 'info' || sev === 'low') continue;

        findings.push({
          id: `TLS-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'testssl',
          severity: sev,
          title: `TLS issue: ${finding.id}`,
          description: `${finding.finding}${finding.cve ? ` (${finding.cve})` : ''}`,
          category: 'infrastructure',
        });
      }
    }

    return {
      scanner: 'testssl',
      category: 'infrastructure',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
