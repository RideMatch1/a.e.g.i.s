import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface NpmAuditVulnerability {
  name: string;
  severity: string;
  via: Array<string | { title: string; url: string; severity: string }>;
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: boolean | { name: string; version: string };
}

interface NpmAuditOutput {
  auditReportVersion: number;
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
  // legacy v1 format
  advisories?: Record<
    string,
    {
      module_name: string;
      severity: string;
      title: string;
      url: string;
      findings: Array<{ paths: string[] }>;
    }
  >;
}

function mapSeverity(raw: string): Finding['severity'] {
  switch (raw.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    default:
      return 'medium';
  }
}

export const npmAuditScanner: Scanner = {
  name: 'npm-audit',
  description: 'Dependency vulnerability scanning via npm audit',
  category: 'dependencies',
  isExternal: true,

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('npm');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const result = await exec('npm', ['audit', '--json'], { cwd: projectPath });

    let parsed: NpmAuditOutput;
    try {
      parsed = JSON.parse(result.stdout) as NpmAuditOutput;
    } catch {
      return {
        scanner: 'npm-audit',
        category: 'dependencies',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'Failed to parse npm audit JSON output',
      };
    }

    const findings: Finding[] = [];
    let idCounter = 1;

    // npm audit v7+ format
    if (parsed.vulnerabilities) {
      for (const [, vuln] of Object.entries(parsed.vulnerabilities)) {
        const sev = vuln.severity.toLowerCase();
        if (sev !== 'critical' && sev !== 'high') continue;

        const title =
          typeof vuln.via[0] === 'string'
            ? `Vulnerable dependency: ${vuln.name}`
            : `Vulnerable dependency: ${vuln.name} — ${(vuln.via[0] as { title: string }).title}`;

        findings.push({
          id: `NPM-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'npm-audit',
          severity: mapSeverity(vuln.severity),
          title,
          description: `Package "${vuln.name}" has a ${vuln.severity} severity vulnerability. Affected range: ${vuln.range}. Fix available: ${vuln.fixAvailable === true ? 'yes' : vuln.fixAvailable === false ? 'no' : `update to ${(vuln.fixAvailable as { version: string }).version}`}.`,
          category: 'dependencies',
        });
      }
    } else if (parsed.advisories) {
      // Legacy npm audit v1 format
      for (const [, advisory] of Object.entries(parsed.advisories)) {
        const sev = advisory.severity.toLowerCase();
        if (sev !== 'critical' && sev !== 'high') continue;

        findings.push({
          id: `NPM-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'npm-audit',
          severity: mapSeverity(advisory.severity),
          title: `Vulnerable dependency: ${advisory.module_name} — ${advisory.title}`,
          description: `${advisory.title}. More info: ${advisory.url}`,
          category: 'dependencies',
        });
      }
    }

    return {
      scanner: 'npm-audit',
      category: 'dependencies',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
