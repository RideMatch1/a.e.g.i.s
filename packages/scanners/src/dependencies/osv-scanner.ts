import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface OsvVulnerability {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
}

interface OsvPackageVulnerability {
  package: {
    name: string;
    version: string;
    ecosystem: string;
  };
  vulnerabilities: OsvVulnerability[];
}

interface OsvOutput {
  results?: Array<{
    packages?: OsvPackageVulnerability[];
  }>;
}

function mapOsvSeverity(vuln: OsvVulnerability): Finding['severity'] {
  // Try CVSS score first
  const cvss = vuln.severity?.find((s) => s.type === 'CVSS_V3' || s.type === 'CVSS_V2');
  if (cvss) {
    const score = parseFloat(cvss.score);
    // OSV sometimes returns CVSS vector strings instead of numeric scores — guard against NaN
    if (!isNaN(score)) {
      if (score >= 9.0) return 'critical';
      if (score >= 7.0) return 'high';
      if (score >= 4.0) return 'medium';
      return 'low';
    }
  }
  return 'medium'; // default when no numeric score available
}

export const osvScannerScanner: Scanner = {
  name: 'osv-scanner',
  description: 'Dependency vulnerability scanning via OSV-Scanner against the OSV database',
  category: 'dependencies',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('osv-scanner');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const result = await exec('osv-scanner', ['--json', '-r', projectPath]);

    let parsed: OsvOutput;
    try {
      parsed = JSON.parse(result.stdout) as OsvOutput;
    } catch {
      return {
        scanner: 'osv-scanner',
        category: 'dependencies',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'Failed to parse osv-scanner JSON output',
      };
    }

    const findings: Finding[] = [];
    let idCounter = 1;

    for (const resultGroup of parsed.results ?? []) {
      for (const pkg of resultGroup.packages ?? []) {
        for (const vuln of pkg.vulnerabilities ?? []) {
          findings.push({
            id: `OSV-${String(idCounter++).padStart(3, '0')}`,
            scanner: 'osv-scanner',
            severity: mapOsvSeverity(vuln),
            title: `${pkg.package.name}@${pkg.package.version}: ${vuln.id}`,
            description: vuln.summary ?? vuln.details ?? `Vulnerability ${vuln.id} in ${pkg.package.name}`,
            category: 'dependencies',
          });
        }
      }
    }

    return {
      scanner: 'osv-scanner',
      category: 'dependencies',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
