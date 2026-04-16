import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface NucleiResult {
  'template-id': string;
  info: {
    name: string;
    severity: string;
    description?: string;
    tags?: string[];
  };
  host: string;
  matched: string;
  type: string;
  'curl-command'?: string;
}

function mapSeverity(raw: string): Finding['severity'] {
  switch (raw.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'info';
  }
}

export const nucleiScanner: Scanner = {
  name: 'nuclei',
  description: 'Dynamic Application Security Testing via Nuclei template engine',
  category: 'dast',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('nuclei');
  },

  async scan(_projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const target = config.target;
    if (!target) {
      return {
        scanner: 'nuclei',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'nuclei scanner requires config.target to be set',
      };
    }

    const result = await exec('nuclei', ['-u', target, '-jsonl', '-silent']);

    const findings: Finding[] = [];
    let idCounter = 1;

    // JSONL: one JSON object per line
    const lines = (result.stdout + result.stderr)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      try {
        const r = JSON.parse(line) as NucleiResult;
        findings.push({
          id: `NUCLEI-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'nuclei',
          severity: mapSeverity(r.info.severity),
          title: r.info.name,
          description: `${r.info.description ?? r['template-id']} — matched at ${r.matched}`,
          category: 'dast',
        });
      } catch {
        // skip non-JSON lines (nuclei sometimes emits status lines)
      }
    }

    return {
      scanner: 'nuclei',
      category: 'dast',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
