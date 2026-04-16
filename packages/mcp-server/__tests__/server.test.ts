import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditResult, Finding } from '@aegis-scan/core';
import {
  handleFindings,
  handleFixSuggestion,
  setLastResult,
  getLastResult,
} from '../src/handlers.js';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const baseStack = {
  framework: 'nextjs' as const,
  database: 'supabase' as const,
  auth: 'supabase-auth' as const,
  ai: 'none' as const,
  payment: 'none' as const,
  deploy: 'docker' as const,
  language: 'typescript' as const,
  hasI18n: false,
  hasTests: true,
};

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'test-id-1',
    scanner: 'auth-enforcer',
    category: 'security',
    severity: 'high',
    title: 'Missing auth check',
    description: 'Route is missing authentication',
    file: 'src/api/users.ts',
    line: 42,
    fix: 'Add requireRole() call at top of handler',
    ...overrides,
  };
}

function makeAuditResult(findings: Finding[] = []): AuditResult {
  return {
    score: 850,
    grade: 'A',
    badge: 'HARDENED',
    blocked: false,
    breakdown: {
      security: { score: 900, maxScore: 1000, findings: findings.filter((f) => f.category === 'security').length },
      dast: { score: 1000, maxScore: 1000, findings: 0 },
      dependencies: { score: 1000, maxScore: 1000, findings: 0 },
      compliance: { score: 1000, maxScore: 1000, findings: 0 },
      quality: { score: 800, maxScore: 1000, findings: 0 },
      accessibility: { score: 1000, maxScore: 1000, findings: 0 },
      performance: { score: 1000, maxScore: 1000, findings: 0 },
      infrastructure: { score: 1000, maxScore: 1000, findings: 0 },
      i18n: { score: 1000, maxScore: 1000, findings: 0 },
      'ai-llm': { score: 1000, maxScore: 1000, findings: 0 },
      runtime: { score: 1000, maxScore: 1000, findings: 0 },
      attack: { score: 1000, maxScore: 1000, findings: 0 },
    },
    findings,
    scanResults: [],
    stack: baseStack,
    duration: 1200,
    timestamp: new Date().toISOString(),
    confidence: 'medium',
  };
}

// ---------------------------------------------------------------------------
// aegis_findings — no prior scan
// ---------------------------------------------------------------------------

describe('handleFindings — no prior scan', () => {
  beforeEach(() => {
    // Clear the last result so tests are isolated
    // We can set it to null by using a small workaround via the setter
    setLastResult(null as unknown as AuditResult);
  });

  it('returns empty results when no scan has been run', () => {
    const output = handleFindings({});
    expect(output.findings).toHaveLength(0);
    expect(output.total).toBe(0);
    expect(output.filtered).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// aegis_findings — with scan results
// ---------------------------------------------------------------------------

describe('handleFindings — with scan results', () => {
  const findings: Finding[] = [
    makeFinding({ id: 'f-1', severity: 'critical', scanner: 'semgrep', category: 'security' }),
    makeFinding({ id: 'f-2', severity: 'high', scanner: 'auth-enforcer', category: 'security' }),
    makeFinding({ id: 'f-3', severity: 'medium', scanner: 'semgrep', category: 'quality' }),
    makeFinding({ id: 'f-4', severity: 'low', scanner: 'npm-audit', category: 'dependencies' }),
    makeFinding({ id: 'f-5', severity: 'info', scanner: 'npm-audit', category: 'dependencies' }),
  ];

  beforeEach(() => {
    setLastResult(makeAuditResult(findings));
  });

  it('returns all findings without filters', () => {
    const output = handleFindings({});
    expect(output.total).toBe(5);
    expect(output.findings.length).toBeLessThanOrEqual(100); // default limit
  });

  it('filters by severity', () => {
    const output = handleFindings({ severity: 'high' });
    expect(output.findings).toHaveLength(1);
    expect(output.findings[0].id).toBe('f-2');
  });

  it('filters by scanner', () => {
    const output = handleFindings({ scanner: 'semgrep' });
    expect(output.findings).toHaveLength(2);
    expect(output.findings.map((f) => f.id).sort()).toEqual(['f-1', 'f-3'].sort());
  });

  it('filters by both severity and scanner', () => {
    const output = handleFindings({ severity: 'medium', scanner: 'semgrep' });
    expect(output.findings).toHaveLength(1);
    expect(output.findings[0].id).toBe('f-3');
  });

  it('respects limit', () => {
    const output = handleFindings({ limit: 2 });
    expect(output.findings.length).toBe(2);
    expect(output.total).toBe(5);
    expect(output.filtered).toBe(2);
  });

  it('returns findings sorted by severity (most severe first)', () => {
    const output = handleFindings({});
    const severities = output.findings.map((f) => f.severity);
    // critical should come before high, high before medium, etc.
    const order = ['blocker', 'critical', 'high', 'medium', 'low', 'info'];
    for (let i = 0; i < severities.length - 1; i++) {
      expect(order.indexOf(severities[i])).toBeLessThanOrEqual(order.indexOf(severities[i + 1]));
    }
  });
});

// ---------------------------------------------------------------------------
// aegis_fix_suggestion — no prior scan
// ---------------------------------------------------------------------------

describe('handleFixSuggestion — no prior scan', () => {
  beforeEach(() => {
    setLastResult(null as unknown as AuditResult);
  });

  it('returns found=false when no scan has been run', () => {
    const output = handleFixSuggestion({ findingId: 'missing-id' });
    expect(output.found).toBe(false);
    expect(output.description).toContain('No scan results available');
  });
});

// ---------------------------------------------------------------------------
// aegis_fix_suggestion — with scan results
// ---------------------------------------------------------------------------

describe('handleFixSuggestion — with scan results', () => {
  const finding = makeFinding({
    id: 'fix-test-1',
    title: 'SQL Injection Risk',
    description: 'User input concatenated into SQL query',
    severity: 'critical',
    file: 'src/api/query.ts',
    line: 88,
    fix: 'Use parameterized queries with $1, $2 placeholders',
    owasp: 'A03:2021',
    cwe: 89,
  });

  beforeEach(() => {
    setLastResult(makeAuditResult([finding]));
  });

  it('returns the finding with full details', () => {
    const output = handleFixSuggestion({ findingId: 'fix-test-1' });
    expect(output.found).toBe(true);
    expect(output.title).toBe('SQL Injection Risk');
    expect(output.severity).toBe('critical');
    expect(output.file).toBe('src/api/query.ts');
    expect(output.line).toBe(88);
    expect(output.fix).toBe('Use parameterized queries with $1, $2 placeholders');
    expect(output.owasp).toBe('A03:2021');
    expect(output.cwe).toBe(89);
  });

  it('returns found=false for unknown ID', () => {
    const output = handleFixSuggestion({ findingId: 'does-not-exist' });
    expect(output.found).toBe(false);
    expect(output.description).toContain('does-not-exist');
  });

  it('returns fix placeholder text when finding has no fix', () => {
    const noFixFinding = makeFinding({ id: 'no-fix', fix: undefined });
    setLastResult(makeAuditResult([noFixFinding]));
    const output = handleFixSuggestion({ findingId: 'no-fix' });
    expect(output.found).toBe(true);
    expect(output.fix).toBe('No automated fix suggestion available for this finding.');
  });
});

// ---------------------------------------------------------------------------
// getLastResult / setLastResult — state management
// ---------------------------------------------------------------------------

describe('state management', () => {
  it('getLastResult returns null initially when cleared', () => {
    setLastResult(null as unknown as AuditResult);
    expect(getLastResult()).toBeNull();
  });

  it('setLastResult stores and getLastResult retrieves the result', () => {
    const result = makeAuditResult([makeFinding()]);
    setLastResult(result);
    expect(getLastResult()).toBe(result);
    expect(getLastResult()!.score).toBe(850);
  });

  it('setLastResult replaces previous result', () => {
    const first = makeAuditResult([makeFinding({ id: 'first' })]);
    const second = makeAuditResult([makeFinding({ id: 'second' }), makeFinding({ id: 'second-b' })]);
    setLastResult(first);
    setLastResult(second);
    expect(getLastResult()!.findings).toHaveLength(2);
  });
});
