/**
 * APTS-HO-003 — decision timeout + default-safe behavior tests.
 */
import { describe, it, expect } from 'vitest';
import {
  withPhaseTimeout,
  derivePhaseTimeoutMs,
} from '../../src/safety-controls/decision-timeout.js';

describe('withPhaseTimeout', () => {
  it('resolves with the wrapped value when the phase completes in time', async () => {
    const result = await withPhaseTimeout(Promise.resolve(42), { phase: 'recon', timeout_ms: 100 });
    expect(result.timed_out).toBe(false);
    if (!result.timed_out) {
      expect(result.value).toBe(42);
    }
  });

  it('returns a TimeoutFailure when the wrapped phase exceeds the timeout', async () => {
    const slow = new Promise((r) => setTimeout(() => r('done'), 200));
    const result = await withPhaseTimeout(slow, { phase: 'discovery', timeout_ms: 30 });
    expect(result.timed_out).toBe(true);
    if (result.timed_out) {
      expect(result.phase).toBe('discovery');
      expect(result.timeout_ms).toBe(30);
      expect(result.default_action).toBe('halt');
      expect(result.apts_refs).toContain('APTS-HO-003');
      expect(result.reason).toMatch(/decision timeout/);
    }
  });

  it('aborts via supplied AbortController on timeout', async () => {
    const ctrl = new AbortController();
    const slow = new Promise((r) => setTimeout(() => r('done'), 200));
    await withPhaseTimeout(slow, { phase: 'recon', timeout_ms: 20, controller: ctrl });
    expect(ctrl.signal.aborted).toBe(true);
  });

  it('rethrows wrapped errors so the caller can handle them normally', async () => {
    const failing = Promise.reject(new Error('boom'));
    await expect(
      withPhaseTimeout(failing, { phase: 'recon', timeout_ms: 100 }),
    ).rejects.toThrow(/boom/);
  });
});

describe('derivePhaseTimeoutMs', () => {
  it('honors phase_timeout_minutes when explicitly set', () => {
    expect(derivePhaseTimeoutMs({ phase_timeout_minutes: 5 }, 9_999)).toBe(5 * 60_000);
  });

  it('derives 1/4 of max_duration_minutes when only that is set', () => {
    expect(derivePhaseTimeoutMs({ max_duration_minutes: 60 }, 9_999)).toBe(15 * 60_000);
  });

  it('falls back to default when neither is set', () => {
    expect(derivePhaseTimeoutMs({}, 7_000)).toBe(7_000);
  });
});
