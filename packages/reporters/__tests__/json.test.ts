import { describe, it, expect } from 'vitest';
import type { AuditResult } from '@aegis-scan/core';
import { jsonReporter } from '../src/json.js';

function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    score: 75,
    grade: 'C',
    badge: 'FAIR',
    blocked: false,
    confidence: 'high',
    breakdown: {
      Authorization: { score: 15, maxScore: 20, findings: 2 },
    },
    findings: [],
    scanResults: [],
    stack: { framework: 'Express', database: 'MySQL', language: 'JavaScript' },
    duration: 890,
    timestamp: '2025-06-15T12:00:00.000Z',
    ...overrides,
  } as AuditResult;
}

describe('jsonReporter', () => {
  it('has the correct name', () => {
    expect(jsonReporter.name).toBe('json');
  });

  it('produces valid JSON', () => {
    const output = jsonReporter.format(makeResult());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('output contains the score', () => {
    const output = jsonReporter.format(makeResult({ score: 75 }));
    const parsed = JSON.parse(output) as AuditResult;
    expect(parsed.score).toBe(75);
  });

  it('output contains the grade', () => {
    const output = jsonReporter.format(makeResult({ grade: 'C' }));
    const parsed = JSON.parse(output) as AuditResult;
    expect(parsed.grade).toBe('C');
  });

  it('output contains the badge', () => {
    const output = jsonReporter.format(makeResult({ badge: 'FAIR' }));
    const parsed = JSON.parse(output) as AuditResult;
    expect(parsed.badge).toBe('FAIR');
  });

  it('serializes findings correctly', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-002',
          scanner: 'injection-scanner',
          category: 'Injection',
          severity: 'critical',
          title: 'SQL Injection',
          description: 'Unsanitized user input passed to query',
          file: 'src/db/query.js',
          line: 18,
          fix: 'Use parameterized queries',
        },
      ],
    });
    const output = jsonReporter.format(result);
    const parsed = JSON.parse(output) as AuditResult;
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.findings[0].id).toBe('SEC-002');
    expect(parsed.findings[0].severity).toBe('critical');
  });

  it('pretty-prints with 2-space indent', () => {
    const output = jsonReporter.format(makeResult());
    // Pretty-printed JSON contains newlines and spaces
    expect(output).toContain('\n');
    expect(output).toContain('  ');
  });

  it('round-trips the full result without loss', () => {
    const original = makeResult({
      score: 91,
      grade: 'A',
      badge: 'EXCELLENT',
      blocked: false,
      breakdown: {
        Authentication: { score: 20, maxScore: 20, findings: 0 },
        Injection: { score: 18, maxScore: 20, findings: 1 },
      },
    });
    const output = jsonReporter.format(original);
    const parsed = JSON.parse(output) as AuditResult;
    expect(parsed.score).toBe(original.score);
    expect(parsed.breakdown).toEqual(original.breakdown);
    expect(parsed.stack).toEqual(original.stack);
  });

  it('returns a string', () => {
    expect(typeof jsonReporter.format(makeResult())).toBe('string');
  });
});
