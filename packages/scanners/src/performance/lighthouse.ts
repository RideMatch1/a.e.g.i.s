import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface LighthouseAudit {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  numericValue?: number;
  displayValue?: string;
  scoreDisplayMode?: string;
}

interface LighthouseReport {
  categories?: {
    performance?: { score: number | null; title?: string };
  };
  audits?: Record<string, LighthouseAudit>;
}

/** Core Web Vitals and key performance audit IDs */
const CWV_AUDIT_IDS = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'speed-index',
  'interactive',
  'server-response-time',
];

function mapScoreToSeverity(score: number): Finding['severity'] {
  if (score < 0.5) return 'high';
  if (score < 0.7) return 'medium';
  return 'info';
}

export const lighthousePerformanceScanner: Scanner = {
  name: 'lighthouse-performance',
  description: 'Performance scanner extracting Lighthouse score and Core Web Vitals',
  category: 'performance',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('lighthouse');
  },

  async scan(_projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const target = config.target;
    if (!target) {
      return {
        scanner: 'lighthouse-performance',
        category: 'performance',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'lighthouse-performance scanner requires config.target to be set',
      };
    }

    const result = await exec('lighthouse', [
      target,
      '--output', 'json',
      '--chrome-flags=--headless --no-sandbox',
      '--only-categories=performance',
      '--quiet',
    ]);

    let parsed: LighthouseReport;
    try {
      const raw = result.stdout.trim() || result.stderr.trim();
      parsed = JSON.parse(raw) as LighthouseReport;
    } catch {
      return {
        scanner: 'lighthouse-performance',
        category: 'performance',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `Failed to parse lighthouse JSON output: ${(result.stdout + result.stderr).slice(0, 200)}`,
      };
    }

    const findings: Finding[] = [];
    let idCounter = 1;

    // Overall performance score finding
    const perfScore = parsed.categories?.performance?.score ?? null;
    if (perfScore !== null && perfScore < 0.7) {
      const pct = Math.round(perfScore * 100);
      findings.push({
        id: `PERF-${String(idCounter++).padStart(3, '0')}`,
        scanner: 'lighthouse-performance',
        severity: perfScore < 0.5 ? 'high' : 'medium',
        title: `Low Lighthouse performance score: ${pct}/100`,
        description: `Lighthouse performance score is ${pct}/100. Scores below 50 indicate serious performance problems affecting user experience and SEO.`,
        category: 'performance' as const,
      });
    }

    // Individual Core Web Vitals findings
    for (const auditId of CWV_AUDIT_IDS) {
      const audit = parsed.audits?.[auditId];
      if (!audit) continue;
      if (audit.score === null || audit.scoreDisplayMode === 'notApplicable') continue;
      if (audit.score >= 0.7) continue; // only flag poor/needs-improvement

      const severity = mapScoreToSeverity(audit.score);
      findings.push({
        id: `PERF-${String(idCounter++).padStart(3, '0')}`,
        scanner: 'lighthouse-performance',
        severity,
        title: audit.title,
        description: `${audit.description ?? audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ''}`,
        category: 'performance' as const,
      });
    }

    return {
      scanner: 'lighthouse-performance',
      category: 'performance',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
