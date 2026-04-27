/**
 * APTS-MR-002 + MR-005 — response validation + authority-claim detection tests.
 */
import { describe, it, expect } from 'vitest';
import {
  validateWrapperResponse,
  detectAuthorityClaim,
} from '../../src/manipulation-resistance/response-validator.js';

describe('validateWrapperResponse (MR-002)', () => {
  it('accepts a well-formed strix output and returns sanitized cleaned data', () => {
    const raw = {
      findings: [
        { id: 'S-1', severity: 'high', title: 'XSS in <script>', description: 'tag>>>injection' },
      ],
    };
    const result = validateWrapperResponse('strix', raw);
    expect(result.ok).toBe(true);
    expect(result.cleaned).toBeDefined();
    const cleaned = result.cleaned as { findings: Array<{ title: string; description: string }> };
    expect(cleaned.findings[0].title).toContain('&lt;');
    expect(cleaned.findings[0].description).toContain('&gt;');
  });

  it('rejects an unknown wrapper outright', () => {
    const result = validateWrapperResponse('phantom-wrapper', { foo: 'bar' });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no validation schema/);
    expect(result.apts_refs).toContain('APTS-MR-002');
  });

  it('rejects a wrapper output that violates the schema', () => {
    const result = validateWrapperResponse('strix', { findings: 'should-be-array' });
    expect(result.ok).toBe(false);
    expect(result.apts_refs).toContain('APTS-MR-002');
  });

  it('caps oversized fields to defend against memory-exhaustion via finding-flood', () => {
    const huge = 'a'.repeat(20_000);
    const result = validateWrapperResponse('strix', {
      findings: [{ id: 'S-2', title: huge, description: huge }],
    });
    expect(result.ok).toBe(true);
    const cleaned = result.cleaned as { findings: Array<{ title: string }> };
    expect(cleaned.findings[0].title.length).toBeLessThan(huge.length);
    expect(cleaned.findings[0].title).toMatch(/truncated/);
  });

  it('accepts ptai SARIF top-level shape', () => {
    const result = validateWrapperResponse('ptai', {
      runs: [{ results: [{ ruleId: 'CWE-89', level: 'error' }] }],
    });
    expect(result.ok).toBe(true);
  });

  it('accepts pentestswarm output with findings or report fields', () => {
    const result = validateWrapperResponse('pentestswarm', {
      findings: [{ id: 'PS-1', severity: 'medium' }],
      report: { meta: 'arbitrary' },
    });
    expect(result.ok).toBe(true);
  });
});

describe('detectAuthorityClaim (MR-005)', () => {
  it('flags reverse-shell as reject', () => {
    const r = detectAuthorityClaim('observed reverse shell on the web tier');
    expect(r.claim).toBe('reverse-shell');
    expect(r.suggested_action).toBe('reject');
  });

  it('flags RCE as reject', () => {
    const r = detectAuthorityClaim('finding indicates remote code execution via injection');
    expect(r.claim).toBe('rce');
    expect(r.suggested_action).toBe('reject');
  });

  it('flags root-shell as verify (not reject)', () => {
    const r = detectAuthorityClaim('indicator of root shell access on the bastion');
    expect(r.claim).toBe('root');
    expect(r.suggested_action).toBe('verify');
  });

  it('flags assertive admin claims as verify', () => {
    const r = detectAuthorityClaim('I have gained admin on the dashboard');
    expect(r.claim).toBe('admin');
    expect(r.suggested_action).toBe('verify');
  });

  it('does not flag bare "admin endpoint exposed" finding text as a claim', () => {
    const r = detectAuthorityClaim('admin endpoint exposed without authentication');
    expect(r.claim).toBe('none');
    expect(r.suggested_action).toBe('pass');
  });

  it('returns none for ordinary finding text', () => {
    const r = detectAuthorityClaim('reflected XSS in the search input on /search');
    expect(r.claim).toBe('none');
  });
});
