import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface BearerRisk {
  id: string;
  title: string;
  description?: string;
  severity?: string;
  filename?: string;
  line_number?: number;
  data_types?: string[];
}

interface BearerOutput {
  risks?: BearerRisk[];
  // Bearer may also emit a top-level object per category
  critical?: BearerRisk[];
  high?: BearerRisk[];
  medium?: BearerRisk[];
  low?: BearerRisk[];
  warning?: BearerRisk[];
}

function mapSeverity(raw: string | undefined): Finding['severity'] {
  switch ((raw ?? '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    case 'warning':
      return 'info';
    default:
      return 'info';
  }
}

/**
 * Flatten Bearer JSON output into a single risk list regardless of output shape.
 * Bearer can emit either `{ risks: [...] }` or `{ critical: [...], high: [...], ... }`.
 */
function extractRisks(parsed: BearerOutput): BearerRisk[] {
  if (Array.isArray(parsed.risks) && parsed.risks.length > 0) {
    return parsed.risks;
  }

  const severityKeys: (keyof BearerOutput)[] = ['critical', 'high', 'medium', 'low', 'warning'];
  const result: BearerRisk[] = [];

  for (const key of severityKeys) {
    const bucket = parsed[key];
    if (Array.isArray(bucket)) {
      for (const risk of bucket) {
        result.push({ ...risk, severity: risk.severity ?? key });
      }
    }
  }

  return result;
}

export const bearerScanner: Scanner = {
  name: 'bearer',
  description: 'Privacy-focused SAST — detects PII data flows via Bearer',
  category: 'compliance',
  isExternal: true,

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('bearer');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const result = await exec('bearer', ['scan', projectPath, '--format', 'json', '--quiet']);

    let parsed: BearerOutput;
    try {
      // Bearer may write JSON to stdout or stderr depending on version
      const raw = result.stdout.trim() || result.stderr.trim();
      parsed = JSON.parse(raw) as BearerOutput;
    } catch {
      return {
        scanner: 'bearer',
        category: 'compliance',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `Failed to parse bearer JSON output: ${(result.stdout + result.stderr).slice(0, 200)}`,
      };
    }

    const risks = extractRisks(parsed);
    let idCounter = 1;

    const findings: Finding[] = risks.map((risk) => ({
      id: `BEARER-${String(idCounter++).padStart(3, '0')}`,
      scanner: 'bearer',
      severity: mapSeverity(risk.severity),
      title: risk.title ?? risk.id,
      description: risk.description ?? risk.id,
      file: risk.filename,
      line: risk.line_number,
      category: 'compliance' as const,
    }));

    return {
      scanner: 'bearer',
      category: 'compliance',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
