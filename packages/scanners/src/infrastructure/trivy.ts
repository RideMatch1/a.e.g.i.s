import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface TrivyVulnerability {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion?: string;
  Severity: string;
  Title?: string;
  Description?: string;
  References?: string[];
}

interface TrivyResult {
  Target: string;
  Type: string;
  Vulnerabilities?: TrivyVulnerability[];
}

interface TrivyOutput {
  Results?: TrivyResult[];
}

function mapSeverity(raw: string): Finding['severity'] {
  switch (raw.toUpperCase()) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'info';
  }
}

export const trivyScanner: Scanner = {
  name: 'trivy',
  description: 'Container and filesystem vulnerability scanning via Trivy',
  category: 'infrastructure',
  isExternal: true,

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('trivy');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const result = await exec('trivy', ['fs', '--format', 'json', projectPath]);

    let parsed: TrivyOutput;
    try {
      parsed = JSON.parse(result.stdout) as TrivyOutput;
    } catch {
      return {
        scanner: 'trivy',
        category: 'infrastructure',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'Failed to parse trivy JSON output',
      };
    }

    const findings: Finding[] = [];
    let idCounter = 1;

    for (const targetResult of parsed.Results ?? []) {
      for (const vuln of targetResult.Vulnerabilities ?? []) {
        findings.push({
          id: `TRIVY-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'trivy',
          severity: mapSeverity(vuln.Severity),
          title: `${vuln.PkgName}@${vuln.InstalledVersion}: ${vuln.VulnerabilityID}`,
          description: `${vuln.Title ?? vuln.VulnerabilityID} in ${vuln.PkgName} (installed: ${vuln.InstalledVersion}${vuln.FixedVersion ? `, fixed in: ${vuln.FixedVersion}` : ', no fix available'}).${vuln.Description ? ` ${vuln.Description.slice(0, 200)}` : ''}`,
          category: 'infrastructure',
        });
      }
    }

    return {
      scanner: 'trivy',
      category: 'infrastructure',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
