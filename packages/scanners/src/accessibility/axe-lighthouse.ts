import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface LighthouseAudit {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  details?: {
    items?: LighthouseAuditItem[];
  };
}

interface LighthouseAuditItem {
  node?: { snippet?: string; selector?: string };
  url?: string;
}

interface LighthouseReport {
  categories?: {
    accessibility?: { score: number | null };
  };
  audits?: Record<string, LighthouseAudit>;
}

function mapSeverity(score: number | null): Finding['severity'] {
  if (score === null) return 'info';
  if (score === 0) return 'high';
  if (score < 0.5) return 'medium';
  return 'low';
}

/** Accessibility-relevant audit IDs in Lighthouse / axe-core */
const A11Y_AUDIT_PREFIXES = [
  'aria-',
  'button-name',
  'color-contrast',
  'document-title',
  'duplicate-id',
  'frame-title',
  'html-has-lang',
  'html-lang-valid',
  'image-alt',
  'input-image-alt',
  'label',
  'link-name',
  'list',
  'listitem',
  'meta-refresh',
  'meta-viewport',
  'object-alt',
  'tabindex',
  'td-headers-attr',
  'th-has-data-cells',
  'valid-lang',
  'video-caption',
];

function isAccessibilityAudit(auditId: string): boolean {
  return A11Y_AUDIT_PREFIXES.some((prefix) => auditId.startsWith(prefix));
}

export const axeLighthouseScanner: Scanner = {
  name: 'axe-lighthouse',
  description: 'Accessibility scanner using Lighthouse CLI (includes axe-core)',
  category: 'accessibility',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('lighthouse');
  },

  async scan(_projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const target = config.target;
    if (!target) {
      return {
        scanner: 'axe-lighthouse',
        category: 'accessibility',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'axe-lighthouse scanner requires config.target to be set',
      };
    }

    const result = await exec('lighthouse', [
      target,
      '--output', 'json',
      '--chrome-flags=--headless --no-sandbox',
      '--only-categories=accessibility',
      '--quiet',
    ]);

    let parsed: LighthouseReport;
    try {
      const raw = result.stdout.trim() || result.stderr.trim();
      parsed = JSON.parse(raw) as LighthouseReport;
    } catch {
      return {
        scanner: 'axe-lighthouse',
        category: 'accessibility',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `Failed to parse lighthouse JSON output: ${(result.stdout + result.stderr).slice(0, 200)}`,
      };
    }

    const findings: Finding[] = [];
    let idCounter = 1;

    for (const [auditId, audit] of Object.entries(parsed.audits ?? {})) {
      // Skip non-a11y audits and passing audits (score === 1)
      if (!isAccessibilityAudit(auditId)) continue;
      if (audit.score === 1 || audit.scoreDisplayMode === 'notApplicable' || audit.scoreDisplayMode === 'manual') continue;

      findings.push({
        id: `A11Y-${String(idCounter++).padStart(3, '0')}`,
        scanner: 'axe-lighthouse',
        severity: mapSeverity(audit.score),
        title: audit.title,
        description: audit.description ?? audit.title,
        category: 'accessibility' as const,
      });
    }

    return {
      scanner: 'axe-lighthouse',
      category: 'accessibility',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
