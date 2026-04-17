import { describe, it, expect } from 'vitest';
import type { AuditResult } from '@aegis-scan/core';
import { terminalReporter } from '../src/terminal.js';

function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    score: 82,
    grade: 'B',
    badge: 'GOOD',
    blocked: false,
    confidence: 'high',
    breakdown: {
      Authentication: { score: 18, maxScore: 20, findings: 1 },
      Authorization: { score: 20, maxScore: 20, findings: 0 },
    },
    findings: [],
    scanResults: [{} as never, {} as never],
    stack: { framework: 'Next.js', database: 'PostgreSQL', language: 'TypeScript' },
    duration: 1420,
    timestamp: '2025-01-01T00:00:00.000Z',
    ...overrides,
  } as AuditResult;
}

describe('terminalReporter', () => {
  it('has the correct name', () => {
    expect(terminalReporter.name).toBe('terminal');
  });

  it('output contains AEGIS SECURITY AUDIT header', () => {
    const output = terminalReporter.format(makeResult());
    // Strip ANSI escape codes for plain text comparison
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('AEGIS SECURITY AUDIT');
  });

  it('output contains the score', () => {
    const output = terminalReporter.format(makeResult({ score: 82 }));
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('82');
  });

  it('output contains the grade', () => {
    const output = terminalReporter.format(makeResult({ grade: 'B' }));
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('Grade:');
    expect(plain).toContain('B');
  });

  it('output contains the badge', () => {
    const output = terminalReporter.format(makeResult({ badge: 'GOOD' }));
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('Badge:');
    expect(plain).toContain('GOOD');
  });

  it('shows findings when present', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-001',
          scanner: 'auth-scanner',
          category: 'Authentication',
          severity: 'high',
          title: 'Weak password policy',
          description: 'No minimum length enforced',
          file: 'src/auth/password.ts',
          line: 42,
          fix: 'Enforce minimum 12 character passwords',
        },
      ],
    });
    const output = terminalReporter.format(result);
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('Weak password policy');
    expect(plain).toContain('src/auth/password.ts');
    expect(plain).toContain('42');
    expect(plain).toContain('Enforce minimum 12 character passwords');
  });

  it('shows clean audit message when no findings', () => {
    const output = terminalReporter.format(makeResult({ findings: [] }));
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('No findings');
  });

  it('shows BLOCKED warning when result is blocked', () => {
    const result = makeResult({
      blocked: true,
      blockerReason: 'Critical XSS vulnerability detected',
    });
    const output = terminalReporter.format(result);
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('BLOCKED');
    expect(plain).toContain('Critical XSS vulnerability detected');
  });

  it('shows duration and scanner count in footer', () => {
    const result = makeResult({ duration: 1420, scanResults: [{} as never, {} as never] });
    const output = terminalReporter.format(result);
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('1.4s');
    expect(plain).toContain('2 scanners');
  });

  it('shows category breakdown', () => {
    const output = terminalReporter.format(makeResult());
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('Authentication');
    expect(plain).toContain('18/20');
  });

  it('shows confidence level in output', () => {
    const output = terminalReporter.format(makeResult({ confidence: 'medium' }));
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('Confidence:');
    expect(plain).toContain('MEDIUM');
  });

  // v0.9.2 regression (validator MINOR-01): LOW confidence prefixes the
  // badge with [LOW-CONFIDENCE] so HARDENED / FORTRESS isn't misread on
  // a thinly-scanned project where only built-in scanners ran.
  it('prefixes badge with [LOW-CONFIDENCE] when confidence is low', () => {
    const output = terminalReporter.format(
      makeResult({ confidence: 'low', badge: 'HARDENED' }),
    );
    const plain = output.replace(/\x1B\[[0-9;]*m/g, '');
    expect(plain).toContain('[LOW-CONFIDENCE]');
    expect(plain).toContain('HARDENED');
    // Sub-note explains what LOW confidence means
    expect(plain).toContain('no security-focused external tools');
  });

  it('does NOT prefix the badge when confidence is medium or high', () => {
    const medium = terminalReporter.format(
      makeResult({ confidence: 'medium', badge: 'HARDENED' }),
    );
    const high = terminalReporter.format(
      makeResult({ confidence: 'high', badge: 'HARDENED' }),
    );
    const stripMedium = medium.replace(/\x1B\[[0-9;]*m/g, '');
    const stripHigh = high.replace(/\x1B\[[0-9;]*m/g, '');
    expect(stripMedium).not.toContain('[LOW-CONFIDENCE]');
    expect(stripHigh).not.toContain('[LOW-CONFIDENCE]');
  });

  it('returns a string', () => {
    expect(typeof terminalReporter.format(makeResult())).toBe('string');
  });
});
