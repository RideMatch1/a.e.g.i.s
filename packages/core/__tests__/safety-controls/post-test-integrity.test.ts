/**
 * APTS-SC-015 — post-test integrity probe tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { probeTargetIntegrity } from '../../src/safety-controls/post-test-integrity.js';

describe('probeTargetIntegrity', () => {
  it('returns ok on a 2xx target response', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const r = await probeTargetIntegrity('https://routable.example/', { fetchImpl });
    expect(r.ok).toBe(true);
    expect(r.observed?.status).toBe(200);
  });

  it('flags 5xx responses as integrity failure', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const r = await probeTargetIntegrity('https://routable.example/', { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/server-side fault/);
    expect(r.apts_refs).toContain('APTS-SC-015');
  });

  it('flags response-time spike vs baseline', async () => {
    const fetchImpl = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 60));
      return new Response(null, { status: 200 });
    });
    const r = await probeTargetIntegrity('https://routable.example/', {
      fetchImpl,
      baseline: { baseline_response_ms: 5, baseline_status: 200 },
      max_response_delta_ms: 20,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/response time spiked/);
  });

  it('returns ok when delta is within threshold', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const r = await probeTargetIntegrity('https://routable.example/', {
      fetchImpl,
      baseline: { baseline_response_ms: 100, baseline_status: 200 },
      max_response_delta_ms: 5_000,
    });
    expect(r.ok).toBe(true);
    expect(r.observed?.response_delta_ms).toBeDefined();
  });

  it('returns ok=false when fetch throws', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('connection refused');
    });
    const r = await probeTargetIntegrity('https://routable.example/', { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/probe failed/);
  });
});
