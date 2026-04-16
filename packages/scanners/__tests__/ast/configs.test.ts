import { describe, it, expect } from 'vitest';
import { TAINT_SOURCES, isSourceExpression } from '../../src/ast/sources.js';
import { TAINT_SINKS, getSinkMeta } from '../../src/ast/sinks.js';
import { TAINT_SANITIZERS, isSanitizer } from '../../src/ast/sanitizers.js';

describe('sources', () => {
  it('has at least 10 source patterns', () => {
    expect(TAINT_SOURCES.length).toBeGreaterThanOrEqual(10);
  });

  it('matches req.body', () => {
    expect(isSourceExpression('req.body')).toBe(true);
  });

  it('matches req.body.id (property of source)', () => {
    expect(isSourceExpression('req.body.id')).toBe(true);
  });

  it('matches searchParams.get', () => {
    expect(isSourceExpression('searchParams.get')).toBe(true);
  });

  it('does NOT match process.env', () => {
    expect(isSourceExpression('process.env')).toBe(false);
    expect(isSourceExpression('process.env.API_URL')).toBe(false);
  });

  it('does NOT match plain variable', () => {
    expect(isSourceExpression('myVariable')).toBe(false);
  });

  it('matches req.json / req.text / req.formData (v0.7.1 BLOCKER fix)', () => {
    // Pre-fix asymmetry: `request.json` was a source but `req.json` wasn't
    // — a byte-identical handler with `request` → `req` renamed silently
    // dropped every cross-file SSRF/SQLi/XSS finding. Symmetric coverage
    // is load-bearing for the `req`-alias convention that's common in
    // Next.js App Router routes.
    expect(isSourceExpression('req.json')).toBe(true);
    expect(isSourceExpression('req.text')).toBe(true);
    expect(isSourceExpression('req.formData')).toBe(true);
    // Property-of-source traversal (awaited .json() then destructured):
    expect(isSourceExpression('req.json.id')).toBe(true);
  });

  it('matches request.params (v0.7.1 symmetric-coverage fix)', () => {
    expect(isSourceExpression('request.params')).toBe(true);
    expect(isSourceExpression('request.params.id')).toBe(true);
  });

  it('matches req.nextUrl.searchParams (Next.js middleware pattern)', () => {
    // NextRequest is bound to `req` in middleware and `request` in routes
    // — both should match the searchParams source.
    expect(isSourceExpression('req.nextUrl.searchParams')).toBe(true);
    expect(isSourceExpression('req.nextUrl.searchParams.get')).toBe(true);
  });
});

describe('sinks', () => {
  it('has at least 20 sink patterns', () => {
    expect(Object.keys(TAINT_SINKS).length).toBeGreaterThanOrEqual(20);
  });

  it('returns metadata for exec', () => {
    const meta = getSinkMeta('exec');
    expect(meta).toBeDefined();
    expect(meta!.cwe).toBe(78);
    expect(meta!.severity).toBe('critical');
  });

  it('returns metadata for fetch', () => {
    const meta = getSinkMeta('fetch');
    expect(meta).toBeDefined();
    expect(meta!.cwe).toBe(918);
  });

  it('does NOT match .from( as a sink', () => {
    expect(getSinkMeta('from')).toBeUndefined();
  });

  it('does NOT match .eq( as a sink', () => {
    expect(getSinkMeta('eq')).toBeUndefined();
  });
});

describe('sanitizers', () => {
  it('has at least 15 sanitizer patterns', () => {
    expect(TAINT_SANITIZERS.length).toBeGreaterThanOrEqual(15);
  });

  it('recognizes parseInt as sanitizer', () => {
    expect(isSanitizer('parseInt')).toBe(true);
  });

  it('recognizes encodeURIComponent as sanitizer', () => {
    expect(isSanitizer('encodeURIComponent')).toBe(true);
  });

  it('recognizes DOMPurify.sanitize as sanitizer', () => {
    expect(isSanitizer('DOMPurify.sanitize')).toBe(true);
  });

  it('does NOT recognize JSON.parse as sanitizer', () => {
    expect(isSanitizer('JSON.parse')).toBe(false);
  });

  it('recognizes isValidUUID as sanitizer', () => {
    expect(isSanitizer('isValidUUID')).toBe(true);
  });
});
