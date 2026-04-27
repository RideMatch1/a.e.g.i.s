/**
 * APTS-SC-009 — multi-path kill switch tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  startKillRequestWatcher,
  requestKill,
  startDeadManHeartbeat,
} from '../../src/safety-controls/kill-switch.js';

describe('startKillRequestWatcher + requestKill', () => {
  let dir: string;
  let stateFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'aegis-kill-'));
    stateFile = join(dir, 'engagement.jsonl');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('requestKill writes a marker file at <state-file>.killreq', () => {
    const marker = requestKill(stateFile, 'unit-test');
    expect(marker).toBe(`${stateFile}.killreq`);
    expect(existsSync(marker)).toBe(true);
    const body = JSON.parse(readFileSync(marker, 'utf-8'));
    expect(body.reason).toBe('unit-test');
    expect(typeof body.requested_at).toBe('string');
  });

  it('watcher fires onKillRequest when the marker appears', async () => {
    const onKillRequest = vi.fn();
    const watcher = startKillRequestWatcher({
      markerPath: `${stateFile}.killreq`,
      pollIntervalMs: 50,
      onKillRequest,
    });
    requestKill(stateFile);
    await new Promise((r) => setTimeout(r, 120));
    expect(onKillRequest).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it('watcher stop() prevents further callbacks', async () => {
    const onKillRequest = vi.fn();
    const watcher = startKillRequestWatcher({
      markerPath: `${stateFile}.killreq`,
      pollIntervalMs: 50,
      onKillRequest,
    });
    watcher.stop();
    requestKill(stateFile);
    await new Promise((r) => setTimeout(r, 120));
    expect(onKillRequest).not.toHaveBeenCalled();
  });
});

describe('startDeadManHeartbeat', () => {
  it('fires onMissedThreshold after consecutive failures', async () => {
    const onMissedThreshold = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    const handle = startDeadManHeartbeat({
      url: 'https://heartbeat.example/ping',
      intervalMs: 30,
      maxConsecutiveFailures: 2,
      onMissedThreshold,
      fetchImpl,
    });
    await new Promise((r) => setTimeout(r, 120));
    expect(onMissedThreshold).toHaveBeenCalled();
    expect(onMissedThreshold.mock.calls[0]?.[0]).toBeGreaterThanOrEqual(2);
    handle.stop();
  });

  it('resets the consecutive counter on a successful response', async () => {
    const onMissedThreshold = vi.fn();
    const fetchImpl = vi.fn();
    fetchImpl
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const handle = startDeadManHeartbeat({
      url: 'https://heartbeat.example/ping',
      intervalMs: 30,
      maxConsecutiveFailures: 2,
      onMissedThreshold,
      fetchImpl,
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(onMissedThreshold).not.toHaveBeenCalled();
    handle.stop();
  });

  it('counts thrown errors as failures', async () => {
    const onMissedThreshold = vi.fn();
    const fetchImpl = vi.fn().mockRejectedValue(new Error('connection refused'));
    const handle = startDeadManHeartbeat({
      url: 'https://heartbeat.example/ping',
      intervalMs: 30,
      maxConsecutiveFailures: 2,
      onMissedThreshold,
      fetchImpl,
    });
    await new Promise((r) => setTimeout(r, 120));
    expect(onMissedThreshold).toHaveBeenCalled();
    handle.stop();
  });
});
