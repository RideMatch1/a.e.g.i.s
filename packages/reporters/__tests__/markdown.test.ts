import { describe, it, expect } from 'vitest';
import type { AuditResult } from '@aegis-scan/core';
import { markdownReporter } from '../src/markdown.js';

function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    score: 780,
    grade: 'A',
    badge: 'HARDENED',
    blocked: false,
    confidence: 'high',
    breakdown: {
      security: { score: 18, maxScore: 20, findings: 1 },
      quality: { score: 20, maxScore: 20, findings: 0 },
    },
    findings: [],
    scanResults: [
      { scanner: 'auth-enforcer', category: 'security', findings: [], duration: 120, available: true },
      { scanner: 'semgrep', category: 'security', findings: [], duration: 0, available: false },
    ],
    stack: {
      framework: 'nextjs',
      database: 'supabase',
      language: 'typescript',
      auth: 'supabase-auth',
      ai: 'none',
      payment: 'none',
      deploy: 'vercel',
      hasI18n: true,
      hasTests: true,
    },
    duration: 2400,
    timestamp: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as AuditResult;
}

describe('markdownReporter', () => {
  it('has name "markdown"', () => {
    expect(markdownReporter.name).toBe('markdown');
  });

  it('returns a string', () => {
    expect(typeof markdownReporter.format(makeResult())).toBe('string');
  });

  it('starts with a top-level H1 heading', () => {
    const output = markdownReporter.format(makeResult());
    expect(output.trimStart()).toMatch(/^# AEGIS Security Audit Report/);
  });

  it('contains the score', () => {
    const output = markdownReporter.format(makeResult({ score: 780 }));
    expect(output).toContain('780');
  });

  it('contains the grade', () => {
    const output = markdownReporter.format(makeResult({ grade: 'A' }));
    expect(output).toContain('**A**');
  });

  it('contains the badge', () => {
    const output = markdownReporter.format(makeResult({ badge: 'HARDENED' }));
    expect(output).toContain('HARDENED');
  });

  it('contains confidence level uppercased', () => {
    const output = markdownReporter.format(makeResult({ confidence: 'medium' }));
    expect(output).toContain('MEDIUM');
  });

  it('contains the timestamp', () => {
    const output = markdownReporter.format(makeResult({ timestamp: '2025-01-01T00:00:00.000Z' }));
    expect(output).toContain('2025-01-01T00:00:00.000Z');
  });

  it('shows duration in seconds for values >= 1000ms', () => {
    const output = markdownReporter.format(makeResult({ duration: 2400 }));
    expect(output).toContain('2.4s');
  });

  it('shows duration in milliseconds for values < 1000ms', () => {
    const output = markdownReporter.format(makeResult({ duration: 450 }));
    expect(output).toContain('450ms');
  });

  it('contains category names from breakdown', () => {
    const output = markdownReporter.format(makeResult());
    expect(output).toContain('security');
    expect(output).toContain('quality');
  });

  it('contains H2 sections for Executive Summary, Findings, Scanners, Methodology', () => {
    const output = markdownReporter.format(makeResult());
    expect(output).toContain('## Executive Summary');
    expect(output).toContain('## Findings by Severity');
    expect(output).toContain('## Scanner Results');
    expect(output).toContain('## Methodology');
  });

  it('contains scanner names in the scanner table', () => {
    const output = markdownReporter.format(makeResult());
    expect(output).toContain('auth-enforcer');
    expect(output).toContain('semgrep');
  });

  it('shows "No findings" style text when findings array is empty', () => {
    const output = markdownReporter.format(makeResult({ findings: [] }));
    expect(output).toContain('_No findings._');
  });

  it('shows finding title when findings are present', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-001',
          scanner: 'auth-enforcer',
          category: 'security',
          severity: 'high',
          title: 'Missing rate limiting',
          description: 'No rate limit on login endpoint',
          file: 'src/app/api/auth/route.ts',
          line: 14,
          fix: 'Add checkIPRateLimit() to the handler',
        },
      ],
    });
    const output = markdownReporter.format(result);
    expect(output).toContain('Missing rate limiting');
    expect(output).toContain('src/app/api/auth/route.ts');
    expect(output).toContain('Add checkIPRateLimit() to the handler');
  });

  it('groups findings under severity H3 headings', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-001',
          scanner: 'test',
          category: 'security',
          severity: 'high',
          title: 'High finding',
          description: 'desc',
        },
        {
          id: 'SEC-002',
          scanner: 'test',
          category: 'security',
          severity: 'medium',
          title: 'Medium finding',
          description: 'desc',
        },
      ],
    });
    const output = markdownReporter.format(result);
    expect(output).toContain('### 🟠 HIGH');
    expect(output).toContain('### 🟡 MEDIUM');
    expect(output).toContain('High finding');
    expect(output).toContain('Medium finding');
  });

  it('shows BLOCKED callout when result is blocked', () => {
    const result = makeResult({
      blocked: true,
      blockerReason: 'Critical SQL injection detected',
    });
    const output = markdownReporter.format(result);
    expect(output).toContain('BLOCKED');
    expect(output).toContain('Critical SQL injection detected');
  });

  it('does NOT show BLOCKED when not blocked', () => {
    const output = markdownReporter.format(makeResult({ blocked: false }));
    expect(output).not.toContain('BLOCKED');
  });

  it('contains the stack info', () => {
    const output = markdownReporter.format(makeResult());
    expect(output).toContain('nextjs');
    expect(output).toContain('supabase');
    expect(output).toContain('typescript');
  });

  it('includes unavailable scanner warning note when scanners are missing', () => {
    const output = markdownReporter.format(makeResult());
    // makeResult has 1 unavailable scanner (semgrep)
    expect(output).toContain('unavailable');
  });

  it('escapes pipe characters in finding titles for table cells', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-PIPE',
          scanner: 'test',
          category: 'security',
          severity: 'low',
          title: 'Title with | pipe',
          description: 'Has a pipe',
        },
      ],
    });
    const output = markdownReporter.format(result);
    // The raw pipe in a title must be escaped
    expect(output).toContain('\\|');
  });

  it('includes OWASP and CWE references when present', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-003',
          scanner: 'test',
          category: 'security',
          severity: 'critical',
          title: 'SQL Injection',
          description: 'desc',
          owasp: 'A03:2021',
          cwe: 89,
        },
      ],
    });
    const output = markdownReporter.format(result);
    expect(output).toContain('A03:2021');
    expect(output).toContain('CWE-89');
  });

  it('contains a markdown table separator row for category breakdown', () => {
    const output = markdownReporter.format(makeResult());
    expect(output).toMatch(/\|[-: |]+\|/);
  });

  it('mentions AEGIS version in methodology section', () => {
    const output = markdownReporter.format(makeResult());
    // Don't hardcode the version — drift-proof assertion
    expect(output).toMatch(/AEGIS v\d+\.\d+\.\d+/);
  });
});

describe('markdownReporter fix-field union rendering', () => {
  const baseFinding = {
    id: 'SEC-300',
    scanner: 'jwt-detector',
    category: 'security' as const,
    severity: 'critical' as const,
    title: 'Hardcoded JWT detected',
    description: 'JWT-shaped token found in source',
    file: 'src/config/secrets.ts',
    line: 3,
  };

  it('renders FixGuidance.description in the Fix markdown block', () => {
    const result = makeResult({
      findings: [{ ...baseFinding, fix: { description: 'Move the JWT into process.env.' } }],
    });
    const output = markdownReporter.format(result);
    expect(output).toContain('**Fix:** Move the JWT into process.env.');
  });

  it('renders FixGuidance.code inside a fenced code block when present', () => {
    const result = makeResult({
      findings: [{
        ...baseFinding,
        fix: { description: 'Use an env-var.', code: 'const k = process.env.JWT_KEY;' },
      }],
    });
    const output = markdownReporter.format(result);
    expect(output).toMatch(/```\nconst k = process\.env\.JWT_KEY;\n```/);
  });

  it('renders (project-level) for findings with no file (null or missing)', () => {
    const result = makeResult({
      findings: [{
        ...baseFinding,
        id: 'PROJ-002',
        title: 'Project-level issue',
        file: undefined,
      }],
    });
    expect(markdownReporter.format(result)).toContain('(project-level)');
  });

  it('renders FixGuidance.links as markdown links when present', () => {
    const result = makeResult({
      findings: [{
        ...baseFinding,
        fix: {
          description: 'See references.',
          links: ['https://cwe.mitre.org/data/definitions/798.html'],
        },
      }],
    });
    const output = markdownReporter.format(result);
    expect(output).toContain('**See:** [https://cwe.mitre.org/data/definitions/798.html]');
  });
});
