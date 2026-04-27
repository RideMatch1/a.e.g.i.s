/**
 * APTS-SC-010 — health-check thresholds + auto-halt tests.
 */
import { describe, it, expect } from 'vitest';
import {
  runHealthCheck,
  newHealthCounters,
  errorRate,
} from '../../src/safety-controls/health-monitor.js';

describe('errorRate', () => {
  it('returns 0 when total_events is 0', () => {
    expect(errorRate({ total_events: 0, error_events: 0, last_target_response_ms: null })).toBe(0);
  });

  it('returns errors / total when both present', () => {
    expect(errorRate({ total_events: 100, error_events: 25, last_target_response_ms: null })).toBe(0.25);
  });
});

describe('runHealthCheck', () => {
  it('returns ok=true on a fresh counters object with no thresholds breached', () => {
    const r = runHealthCheck(newHealthCounters());
    expect(r.ok).toBe(true);
    expect(r.observed?.heap_mb).toBeGreaterThanOrEqual(0);
    expect(r.observed?.error_rate).toBe(0);
    expect(r.apts_refs).toContain('APTS-SC-010');
  });

  it('flags heap memory breach', () => {
    const r = runHealthCheck(newHealthCounters(), { max_heap_mb: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/heap memory/);
  });

  it('flags error-rate breach', () => {
    const r = runHealthCheck(
      { total_events: 10, error_events: 6, last_target_response_ms: null },
      { max_error_rate: 0.5 },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/error rate/);
  });

  it('flags target-response-time breach', () => {
    const r = runHealthCheck(
      { total_events: 1, error_events: 0, last_target_response_ms: 30_000 },
      { max_target_response_ms: 10_000 },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/target response time/);
  });

  it('does not flag when target response is null', () => {
    const r = runHealthCheck(newHealthCounters(), { max_target_response_ms: 1 });
    expect(r.ok).toBe(true);
  });
});
