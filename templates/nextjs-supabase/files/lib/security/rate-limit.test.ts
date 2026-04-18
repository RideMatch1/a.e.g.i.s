// templates/nextjs-supabase/files/lib/security/rate-limit.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getTrustedClientIp, checkIPRateLimit, _resetLimiterForTests } from './rate-limit';

describe('getTrustedClientIp', () => {
  it('returns null when no X-Forwarded-For header is present', () => {
    const req = new Request('http://x', { headers: {} });
    expect(getTrustedClientIp(req)).toBeNull();
  });

  it('returns the leftmost IP in X-Forwarded-For when trustProxyCount=1', () => {
    const req = new Request('http://x', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 10.0.0.2' },
    });
    expect(getTrustedClientIp(req, { trustProxyCount: 1 })).toBe('10.0.0.1');
  });

  it('returns the leftmost client IP when trustProxyCount exceeds header length', () => {
    const req = new Request('http://x', {
      headers: { 'x-forwarded-for': '203.0.113.5' },
    });
    expect(getTrustedClientIp(req, { trustProxyCount: 5 })).toBe('203.0.113.5');
  });

  it('trims whitespace around entries', () => {
    const req = new Request('http://x', {
      headers: { 'x-forwarded-for': ' 203.0.113.5 ,  10.0.0.1 , 10.0.0.2 ' },
    });
    expect(getTrustedClientIp(req, { trustProxyCount: 1 })).toBe('10.0.0.1');
  });
});

describe('checkIPRateLimit', () => {
  beforeEach(() => _resetLimiterForTests());

  it('allows the first N requests within the window', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkIPRateLimit('1.1.1.1', { limit: 5, windowMs: 1000 })).toMatchObject({ allowed: true, remaining: 4 - i });
    }
  });

  it('denies the (N+1)th request', () => {
    for (let i = 0; i < 5; i++) checkIPRateLimit('1.1.1.2', { limit: 5, windowMs: 1000 });
    expect(checkIPRateLimit('1.1.1.2', { limit: 5, windowMs: 1000 })).toMatchObject({ allowed: false, remaining: 0 });
  });

  it('tracks distinct IPs independently', () => {
    for (let i = 0; i < 3; i++) checkIPRateLimit('1.1.1.3', { limit: 3, windowMs: 1000 });
    expect(checkIPRateLimit('1.1.1.3', { limit: 3, windowMs: 1000 }).allowed).toBe(false);
    expect(checkIPRateLimit('1.1.1.4', { limit: 3, windowMs: 1000 }).allowed).toBe(true);
  });
});
