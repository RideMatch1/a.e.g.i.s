import { describe, it, expect } from 'vitest';
import type { AuditResult } from '@aegis-scan/core';
import { htmlReporter } from '../src/html.js';

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

describe('htmlReporter', () => {
  it('has the correct name', () => {
    expect(htmlReporter.name).toBe('html');
  });

  it('returns a string', () => {
    expect(typeof htmlReporter.format(makeResult())).toBe('string');
  });

  it('output starts with DOCTYPE html', () => {
    const output = htmlReporter.format(makeResult());
    expect(output.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('output contains score', () => {
    const output = htmlReporter.format(makeResult({ score: 780 }));
    expect(output).toContain('780');
  });

  it('output contains grade', () => {
    const output = htmlReporter.format(makeResult({ grade: 'A' }));
    expect(output).toContain('>A<');
  });

  it('output contains badge', () => {
    const output = htmlReporter.format(makeResult({ badge: 'HARDENED' }));
    expect(output).toContain('HARDENED');
  });

  it('output contains AEGIS SECURITY AUDIT header', () => {
    const output = htmlReporter.format(makeResult());
    expect(output.toLowerCase()).toContain('aegis security audit');
  });

  it('output contains category names from breakdown', () => {
    const output = htmlReporter.format(makeResult());
    expect(output).toContain('security');
    expect(output).toContain('quality');
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
    const output = htmlReporter.format(result);
    expect(output).toContain('Missing rate limiting');
    expect(output).toContain('src/app/api/auth/route.ts');
    expect(output).toContain('Add checkIPRateLimit() to the handler');
  });

  it('shows no-findings message when findings array is empty', () => {
    const output = htmlReporter.format(makeResult({ findings: [] }));
    expect(output).toContain('No findings');
  });

  it('shows BLOCKED banner when result is blocked', () => {
    const result = makeResult({
      blocked: true,
      blockerReason: 'Critical SQL injection detected',
    });
    const output = htmlReporter.format(result);
    expect(output).toContain('BLOCKED');
    expect(output).toContain('Critical SQL injection detected');
  });

  it('does NOT show BLOCKED banner when not blocked', () => {
    const output = htmlReporter.format(makeResult({ blocked: false }));
    // When not blocked, the BLOCKED text should not appear in the body content
    expect(output).not.toContain('>BLOCKED<');
  });

  it('shows scanner names in scanner section', () => {
    const output = htmlReporter.format(makeResult());
    expect(output).toContain('auth-enforcer');
    expect(output).toContain('semgrep');
  });

  it('shows timestamp in footer', () => {
    const output = htmlReporter.format(makeResult({ timestamp: '2025-01-01T00:00:00.000Z' }));
    expect(output).toContain('2025-01-01T00:00:00.000Z');
  });

  it('shows duration in footer', () => {
    // 2400ms → 2.4s
    const output = htmlReporter.format(makeResult({ duration: 2400 }));
    expect(output).toContain('2.4s');
  });

  it('escapes HTML special characters in finding titles', () => {
    const result = makeResult({
      findings: [
        {
          id: 'XSS-001',
          scanner: 'xss-checker',
          category: 'security',
          severity: 'critical',
          title: '<script>alert("xss")</script>',
          description: 'XSS vector',
          fix: 'Sanitize output',
        },
      ],
    });
    const output = htmlReporter.format(result);
    // The raw script tag must NOT appear unescaped
    expect(output).not.toContain('<script>alert(');
    expect(output).toContain('&lt;script&gt;');
  });

  it('confidence level appears in output', () => {
    const output = htmlReporter.format(makeResult({ confidence: 'medium' }));
    expect(output).toContain('MEDIUM');
  });
});
