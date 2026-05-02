import { describe, it, expect, beforeEach } from 'vitest';
import {
  opsecPace,
  applyOpsecHeaders,
  _resetOpsecPacingForTesting,
} from '../../src/runtime/opsec.js';

describe('opsecPace — request pacing', () => {
  beforeEach(() => _resetOpsecPacingForTesting());

  it('is a no-op when opsec is undefined', async () => {
    const start = Date.now();
    await opsecPace(undefined);
    expect(Date.now() - start).toBeLessThan(20);
  });

  it('is a no-op when rateMs and jitterMs are both 0', async () => {
    const start = Date.now();
    await opsecPace({ rateMs: 0, jitterMs: 0 });
    expect(Date.now() - start).toBeLessThan(20);
  });

  it('enforces rateMs minimum between successive calls', async () => {
    const opsec = { rateMs: 100 };
    await opsecPace(opsec);
    const t1 = Date.now();
    await opsecPace(opsec);
    const t2 = Date.now();
    // Must wait at least rateMs between calls. Allow some scheduler slop on the upper bound.
    expect(t2 - t1).toBeGreaterThanOrEqual(80);
    expect(t2 - t1).toBeLessThan(180);
  });

  it('adds jitter on top of rateMs', async () => {
    const opsec = { rateMs: 50, jitterMs: 50 };
    await opsecPace(opsec);
    const t1 = Date.now();
    await opsecPace(opsec);
    const t2 = Date.now();
    // 50 base + 0..50 jitter = 50..100ms; allow scheduler slop
    expect(t2 - t1).toBeGreaterThanOrEqual(40);
    expect(t2 - t1).toBeLessThan(140);
  });

  it('applies jitter even when rateMs is 0', async () => {
    const opsec = { rateMs: 0, jitterMs: 100 };
    const start = Date.now();
    await opsecPace(opsec);
    const elapsed = Date.now() - start;
    // 0..100ms jitter
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(140);
  });

  it('pacing across non-trivial gap does not over-sleep', async () => {
    const opsec = { rateMs: 50 };
    await opsecPace(opsec);
    // Manually wait longer than rateMs
    await new Promise((r) => setTimeout(r, 80));
    const t1 = Date.now();
    await opsecPace(opsec);
    const t2 = Date.now();
    // Should NOT sleep — already 80ms since last call, > 50ms rate
    expect(t2 - t1).toBeLessThan(20);
  });
});

describe('applyOpsecHeaders — User-Agent override', () => {
  it('returns a new init unchanged when opsec is undefined', () => {
    const init = { method: 'GET' };
    const result = applyOpsecHeaders(init, undefined);
    expect(result).toEqual(init);
    expect(result).not.toBe(init);
  });

  it('returns init unchanged when opsec has no userAgent', () => {
    const init = { method: 'GET' };
    const result = applyOpsecHeaders(init, { rateMs: 100 });
    expect(result).toEqual(init);
  });

  it('handles undefined init by returning a fresh init with UA', () => {
    const result = applyOpsecHeaders(undefined, { userAgent: 'AEGIS-Engagement/1.0' });
    const headers = new Headers(result.headers);
    expect(headers.get('User-Agent')).toBe('AEGIS-Engagement/1.0');
  });

  it('sets User-Agent when opsec.userAgent is provided', () => {
    const result = applyOpsecHeaders({ method: 'GET' }, { userAgent: 'AEGIS-Engagement-2026/1.0' });
    const headers = new Headers(result.headers);
    expect(headers.get('User-Agent')).toBe('AEGIS-Engagement-2026/1.0');
  });

  it('overrides an existing User-Agent header', () => {
    const result = applyOpsecHeaders(
      { method: 'GET', headers: { 'User-Agent': 'old-ua' } },
      { userAgent: 'new-ua' },
    );
    const headers = new Headers(result.headers);
    expect(headers.get('User-Agent')).toBe('new-ua');
  });

  it('preserves other headers', () => {
    const result = applyOpsecHeaders(
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
      },
      { userAgent: 'AEGIS' },
    );
    const headers = new Headers(result.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Custom')).toBe('value');
    expect(headers.get('User-Agent')).toBe('AEGIS');
  });

  it('does NOT mutate the input init', () => {
    const init = { method: 'GET', headers: { 'User-Agent': 'original' } };
    const result = applyOpsecHeaders(init, { userAgent: 'override' });
    // Original init's headers should be unchanged
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('original');
    // Result has the override
    const resHeaders = new Headers(result.headers);
    expect(resHeaders.get('User-Agent')).toBe('override');
  });
});
