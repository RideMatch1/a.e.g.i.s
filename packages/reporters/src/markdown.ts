import type { AuditResult, Finding, Reporter, ScanResult } from '@aegis-scan/core';
import { getVersion } from '@aegis-scan/core';
import { normalizeFix } from './util.js';

const SEVERITY_ORDER: string[] = ['blocker', 'critical', 'high', 'medium', 'low', 'info'];

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function escMd(str: string): string {
  // Escape pipe characters for table cells
  return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function severityEmoji(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'blocker':
      return '🚨';
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🔵';
    default:
      return 'ℹ️';
  }
}

function gradeLabel(grade: string): string {
  switch (grade) {
    case 'S':
    case 'A':
      return `**${grade}** — Excellent`;
    case 'B':
      return `**${grade}** — Good`;
    case 'C':
      return `**${grade}** — Acceptable`;
    case 'D':
      return `**${grade}** — Poor`;
    default:
      return `**${grade}** — Critical`;
  }
}

function renderCategoryTable(breakdown: AuditResult['breakdown']): string {
  const lines: string[] = [];
  lines.push('| Category | Score | Max | % | Findings |');
  lines.push('|----------|------:|----:|--:|---------:|');

  for (const [cat, data] of Object.entries(breakdown)) {
    const pct = data.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
    lines.push(
      `| ${escMd(cat)} | ${data.score} | ${data.maxScore} | ${pct}% | ${data.findings} |`,
    );
  }

  return lines.join('\n');
}

function renderFindingsByGroup(findings: Finding[]): string {
  if (findings.length === 0) {
    return '_No findings._\n';
  }

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  const groups: Map<string, Finding[]> = new Map();
  for (const sev of SEVERITY_ORDER) {
    groups.set(sev, []);
  }
  for (const f of sorted) {
    groups.get(f.severity)?.push(f);
  }

  const sections: string[] = [];

  for (const sev of SEVERITY_ORDER) {
    const group = groups.get(sev) ?? [];
    const label = `${severityEmoji(sev)} ${sev.toUpperCase()} (${group.length})`;

    sections.push(`### ${label}\n`);

    if (group.length === 0) {
      sections.push('_No findings._\n');
      continue;
    }

    sections.push('| ID | Scanner | Title | File | Line |');
    sections.push('|----|---------|-------|------|-----:|');

    for (const f of group) {
      const file = f.file ? escMd(f.file) : '(project-level)';
      const line = f.line != null ? String(f.line) : '—';
      sections.push(
        `| \`${escMd(f.id)}\` | ${escMd(f.scanner)} | ${escMd(f.title)} | \`${file}\` | ${line} |`,
      );
    }

    // Detail block for each finding
    sections.push('');
    for (const f of group) {
      sections.push(`#### \`${escMd(f.id)}\` — ${escMd(f.title)}\n`);
      if (f.description) {
        sections.push(`**Description:** ${escMd(f.description)}\n`);
      }
      const fix = normalizeFix(f.fix);
      if (fix) {
        sections.push(`**Fix:** ${escMd(fix.description)}\n`);
        if (fix.code) {
          sections.push('```\n' + fix.code + '\n```\n');
        }
        if (fix.links && fix.links.length > 0) {
          sections.push(`**See:** ${fix.links.map((l) => `[${escMd(l)}](${l})`).join(', ')}\n`);
        }
      }
      if (f.owasp) {
        sections.push(`**OWASP:** ${escMd(f.owasp)}`);
      }
      if (f.cwe != null) {
        sections.push(`**CWE:** [CWE-${f.cwe}](https://cwe.mitre.org/data/definitions/${f.cwe}.html)`);
      }
      if (f.reference) {
        sections.push(`**Reference:** ${escMd(f.reference)}`);
      }
      sections.push('');
    }
  }

  return sections.join('\n');
}

function renderScannerTable(scanResults: ScanResult[]): string {
  const lines: string[] = [];
  lines.push('| Scanner | Category | Available | Findings | Duration |');
  lines.push('|---------|----------|:---------:|---------:|---------:|');

  const available = scanResults.filter((r) => r.available);
  const unavailable = scanResults.filter((r) => !r.available);

  for (const r of available) {
    lines.push(
      `| ${escMd(r.scanner)} | ${escMd(r.category)} | ✅ | ${r.findings.length} | ${formatDuration(r.duration)} |`,
    );
  }

  for (const r of unavailable) {
    const errNote = r.error ? ` _(${escMd(r.error)})_` : '';
    lines.push(
      `| ${escMd(r.scanner)} | ${escMd(r.category)} | ❌${errNote} | — | — |`,
    );
  }

  return lines.join('\n');
}

function format(result: AuditResult): string {
  const now = result.timestamp;
  const durationStr = formatDuration(result.duration);
  const totalScanners = result.scanResults.length;
  const activeCount = result.scanResults.filter((r) => r.available).length;
  const unavailableCount = totalScanners - activeCount;

  const stackParts = [
    result.stack.framework,
    result.stack.database,
    result.stack.language,
  ]
    .filter(Boolean)
    .join(' · ');

  // Severity counts for executive summary
  const countBySeverity: Record<string, number> = {};
  for (const sev of SEVERITY_ORDER) {
    countBySeverity[sev] = result.findings.filter((f) => f.severity === sev).length;
  }

  const lines: string[] = [];

  // ── Title ──────────────────────────────────────────────────────
  lines.push('# AEGIS Security Audit Report\n');

  lines.push('---\n');

  // ── Header metadata ────────────────────────────────────────────
  lines.push(`**Date:** ${now}  `);
  lines.push(`**Score:** ${result.score}/1000 — Grade ${gradeLabel(result.grade)} (${result.badge})  `);
  lines.push(`**Confidence:** ${result.confidence.toUpperCase()}  `);
  lines.push(`**Scanners:** ${activeCount}/${totalScanners} active  `);
  lines.push(`**Stack:** ${stackParts}  `);
  lines.push(`**Duration:** ${durationStr}  `);

  if (result.blocked) {
    lines.push('');
    lines.push(`> ⛔ **BLOCKED** — ${escMd(result.blockerReason ?? 'Critical security issues detected')}`);
  }

  lines.push('\n---\n');

  // ── Executive Summary ──────────────────────────────────────────
  lines.push('## Executive Summary\n');

  lines.push('### Score Breakdown\n');
  lines.push(renderCategoryTable(result.breakdown));
  lines.push('');

  lines.push('### Findings Summary\n');
  lines.push('| Severity | Count |');
  lines.push('|----------|------:|');
  for (const sev of SEVERITY_ORDER) {
    lines.push(`| ${severityEmoji(sev)} ${sev.charAt(0).toUpperCase() + sev.slice(1)} | ${countBySeverity[sev]} |`);
  }
  lines.push(`| **Total** | **${result.findings.length}** |`);
  lines.push('');

  if (unavailableCount > 0) {
    lines.push(
      `> ⚠️ **Note:** ${unavailableCount}/${totalScanners} scanners were unavailable. ` +
      `Score may be incomplete. Install missing tools for a comprehensive audit.`,
    );
    lines.push('');
  }

  lines.push('---\n');

  // ── Findings by Severity ───────────────────────────────────────
  lines.push('## Findings by Severity\n');
  lines.push(renderFindingsByGroup(result.findings));

  lines.push('---\n');

  // ── Scanner Results ────────────────────────────────────────────
  lines.push('## Scanner Results\n');
  lines.push(renderScannerTable(result.scanResults));
  lines.push('');

  lines.push('---\n');

  // ── Methodology ────────────────────────────────────────────────
  lines.push('## Methodology\n');
  lines.push(
    `AEGIS v${getVersion()} — ${totalScanners} scanners across multiple categories.  `,
  );
  lines.push('OWASP Top 10 2021 coverage: A01–A10.  ');
  lines.push('');
  lines.push('> _Generated by [AEGIS](https://github.com/RideMatch1/a.e.g.i.s) — ' +
    'Automated Enterprise-Grade Inspection Suite._');

  return lines.join('\n');
}

export const markdownReporter: Reporter = {
  name: 'markdown',
  format,
};
