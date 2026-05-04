/**
 * Cluster-2 runtime tests — events + state + signals + notifications.
 *
 * Closes APTS-HO-002 (Real-Time Monitoring), HO-006 (Graceful Pause + State
 * Preservation), HO-008 (Immediate Kill Switch + State Dump), HO-015 (Multi-
 * Channel Notification — webhook subset), AL-008 (Real-Time Approval Gates —
 * intervention API), AL-012 (Kill Switch + Pause Capability) — partial-to-met
 * via the runtime/* module.
 */
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  emitEvent,
  makeEvent,
  findingEvent,
  isCriticalSeverity,
  initStateFile,
  EngagementStateSchema,
  newEngagementState,
  writeEngagementState,
  loadEngagementState,
  installSignalHandlers,
  dispatchNotification,
  type EngagementEvent,
  type EngagementState,
} from '../../src/runtime/index.js';

const tmp = (): string => mkdtempSync(join(tmpdir(), 'aegis-runtime-test-'));

// ---------------------------------------------------------------------------
// events

describe('runtime/events', () => {
  it('makeEvent stamps ts + engagement_id', () => {
    const ev = makeEvent('eng-1', 'engagement-start', {
      target: 'https://example.com',
      roe_id: 'roe-1',
      roe_synthesized: false,
      mode: 'siege',
    });
    expect(ev.event).toBe('engagement-start');
    expect(ev.engagement_id).toBe('eng-1');
    expect(typeof ev.ts).toBe('string');
    expect(ev.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('emitEvent → undefined sink is no-op', () => {
    expect(() =>
      emitEvent(
        makeEvent('eng', 'halt', { reason: 'test' }),
        undefined,
      ),
    ).not.toThrow();
  });

  it('emitEvent → callback sink calls the function with the event', () => {
    const cb = vi.fn();
    const ev = makeEvent('eng', 'halt', { reason: 'test' });
    emitEvent(ev, cb);
    expect(cb).toHaveBeenCalledWith(ev);
  });

  it('emitEvent → file sink appends one JSON line per event', () => {
    const dir = tmp();
    const file = join(dir, 'events.jsonl');
    initStateFile(file);
    emitEvent(makeEvent('eng', 'halt', { reason: 'one' }), file);
    emitEvent(makeEvent('eng', 'halt', { reason: 'two' }), file);
    const lines = readFileSync(file, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).reason).toBe('one');
    expect(JSON.parse(lines[1]!).reason).toBe('two');
  });

  it('findingEvent extracts severity + title + cwe', () => {
    const ev = findingEvent('eng', {
      id: 'f1',
      scanner: 'test',
      category: 'security',
      severity: 'critical',
      title: 'SQL Injection',
      cwe: 89,
    });
    expect(ev.event).toBe('finding-emitted');
    if (ev.event === 'finding-emitted') {
      expect(ev.severity).toBe('critical');
      expect(ev.title).toBe('SQL Injection');
      expect(ev.cwe).toBe(89);
    }
  });

  it('isCriticalSeverity flags blocker + critical + high', () => {
    expect(isCriticalSeverity('blocker')).toBe(true);
    expect(isCriticalSeverity('critical')).toBe(true);
    expect(isCriticalSeverity('high')).toBe(true);
    expect(isCriticalSeverity('medium')).toBe(false);
    expect(isCriticalSeverity('low')).toBe(false);
    expect(isCriticalSeverity('info')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// state

describe('runtime/state', () => {
  it('newEngagementState produces a schema-valid snapshot', () => {
    const s = newEngagementState({
      engagement_id: 'eng-1',
      target: 'example.com',
      roe_id: 'roe-1',
    });
    expect(EngagementStateSchema.safeParse(s).success).toBe(true);
    expect(s.completed_phases).toEqual([]);
    expect(s.findings_so_far).toEqual([]);
  });

  it('writeEngagementState + loadEngagementState round-trip', () => {
    const dir = tmp();
    const file = join(dir, 'state.json');
    const s = newEngagementState({
      engagement_id: 'eng-2',
      target: 'example.com',
      roe_id: 'roe-2',
    });
    writeEngagementState(file, s);
    expect(existsSync(file)).toBe(true);
    const loaded = loadEngagementState(file);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.state.engagement_id).toBe('eng-2');
    }
  });

  it('loadEngagementState returns file-missing when path absent', () => {
    const dir = tmp();
    const r = loadEngagementState(join(dir, 'nope.json'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phase).toBe('file-missing');
  });

  it('loadEngagementState returns json-parse on bad JSON', () => {
    const dir = tmp();
    const file = join(dir, 'bad.json');
    writeFileSync(file, 'not json');
    const r = loadEngagementState(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phase).toBe('json-parse');
  });

  it('loadEngagementState returns schema-validation on missing fields', () => {
    const dir = tmp();
    const file = join(dir, 'partial.json');
    writeFileSync(file, JSON.stringify({ engagement_id: 'x', state_version: '0.1.0' }));
    const r = loadEngagementState(file);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phase).toBe('schema-validation');
  });

  describe('JSONL state-file format (audit-fix 2026-04-27)', () => {
    it('appends snapshots as single-line JSONL, not pretty-printed', () => {
      const dir = tmp();
      const file = join(dir, 'state.jsonl');
      const s = newEngagementState({ engagement_id: 'eng-jsonl', target: 'a.test', roe_id: 'r-1' });
      writeEngagementState(file, s);
      const raw = require('node:fs').readFileSync(file, 'utf-8');
      // Pretty-printed JSON had newlines inside the object; JSONL has only ONE newline (terminator).
      expect(raw.split('\n').filter((l: string) => l.length > 0).length).toBe(1);
      expect(raw.endsWith('\n')).toBe(true);
      expect(raw).not.toContain('\n  '); // no indentation
    });

    it('returns the LATEST snapshot when multiple are appended', () => {
      const dir = tmp();
      const file = join(dir, 'state.jsonl');
      const s1 = newEngagementState({ engagement_id: 'eng-3', target: 'a.test', roe_id: 'r-1' });
      writeEngagementState(file, s1);
      const s2 = { ...s1, completed_phases: ['recon' as const], reason: 'phase-recon-complete' };
      writeEngagementState(file, s2);
      const s3 = { ...s2, completed_phases: ['recon' as const, 'discovery' as const], reason: 'phase-discovery-complete' };
      writeEngagementState(file, s3);
      const loaded = loadEngagementState(file);
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.state.completed_phases).toEqual(['recon', 'discovery']);
        expect(loaded.state.reason).toBe('phase-discovery-complete');
      }
    });

    it('skips event lines and returns the snapshot in a mixed JSONL stream', () => {
      const dir = tmp();
      const file = join(dir, 'state.jsonl');
      const s = newEngagementState({ engagement_id: 'eng-4', target: 'b.test', roe_id: 'r-2' });
      writeEngagementState(file, s);
      // Append event lines (the events.ts channel does this in production).
      require('node:fs').appendFileSync(file, JSON.stringify({ ts: '2026-04-27T00:00:00Z', engagement_id: 'eng-4', event: 'phase-transition' }) + '\n');
      require('node:fs').appendFileSync(file, JSON.stringify({ ts: '2026-04-27T00:00:01Z', engagement_id: 'eng-4', event: 'finding' }) + '\n');
      const loaded = loadEngagementState(file);
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.state.engagement_id).toBe('eng-4');
      }
    });

    it('back-compat: still parses a pre-audit pretty-printed single-object file', () => {
      const dir = tmp();
      const file = join(dir, 'old-state.json');
      const s = newEngagementState({ engagement_id: 'eng-old', target: 'c.test', roe_id: 'r-3' });
      writeFileSync(file, JSON.stringify(s, null, 2));
      const loaded = loadEngagementState(file);
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.state.engagement_id).toBe('eng-old');
      }
    });

    it('returns schema-validation when no snapshot is present', () => {
      const dir = tmp();
      const file = join(dir, 'events-only.jsonl');
      writeFileSync(file, JSON.stringify({ ts: '2026-04-27T00:00:00Z', engagement_id: 'x', event: 'halt' }) + '\n');
      const loaded = loadEngagementState(file);
      expect(loaded.ok).toBe(false);
      if (!loaded.ok) expect(loaded.phase).toBe('schema-validation');
    });
  });
});

// ---------------------------------------------------------------------------
// signals

describe('runtime/signals', () => {
  it('installSignalHandlers registers SIGINT, SIGTERM, SIGUSR1', () => {
    const registrations: { sig: string; handler: () => void }[] = [];
    const exits: number[] = [];
    const inst = installSignalHandlers({
      stateFilePath: null,
      getState: () => newEngagementState({ engagement_id: 'e', target: 't', roe_id: 'r' }),
      eventSink: undefined,
      engagementId: 'e',
      exit: (code) => exits.push(code),
      on: (sig, handler) => registrations.push({ sig, handler }),
    });
    const sigs = registrations.map((r) => r.sig);
    expect(sigs).toContain('SIGINT');
    expect(sigs).toContain('SIGTERM');
    expect(sigs).toContain('SIGUSR1');
    inst.uninstall();
  });

  it('SIGINT handler exits 130 + emits kill event', () => {
    const events: EngagementEvent[] = [];
    const exits: number[] = [];
    let registered: (() => void) | undefined;

    installSignalHandlers({
      stateFilePath: null,
      getState: () => newEngagementState({ engagement_id: 'e', target: 't', roe_id: 'r' }),
      eventSink: (ev) => events.push(ev),
      engagementId: 'e',
      exit: (code) => exits.push(code),
      on: (sig, handler) => {
        if (sig === 'SIGINT') registered = handler;
      },
    });
    expect(registered).toBeDefined();
    registered!();

    expect(exits).toEqual([130]);
    const killEv = events.find((e) => e.event === 'kill');
    expect(killEv).toBeDefined();
    if (killEv && killEv.event === 'kill') expect(killEv.signal).toBe('SIGINT');
  });

  it('SIGTERM handler exits 143', () => {
    const exits: number[] = [];
    let registered: (() => void) | undefined;
    installSignalHandlers({
      stateFilePath: null,
      getState: () => newEngagementState({ engagement_id: 'e', target: 't', roe_id: 'r' }),
      eventSink: undefined,
      engagementId: 'e',
      exit: (code) => exits.push(code),
      on: (sig, handler) => {
        if (sig === 'SIGTERM') registered = handler;
      },
    });
    registered!();
    expect(exits).toEqual([143]);
  });

  it('SIGUSR1 handler exits 0 + emits intervention/pause event', () => {
    const events: EngagementEvent[] = [];
    const exits: number[] = [];
    let registered: (() => void) | undefined;

    installSignalHandlers({
      stateFilePath: null,
      getState: () => newEngagementState({ engagement_id: 'e', target: 't', roe_id: 'r' }),
      eventSink: (ev) => events.push(ev),
      engagementId: 'e',
      exit: (code) => exits.push(code),
      on: (sig, handler) => {
        if (sig === 'SIGUSR1') registered = handler;
      },
    });
    registered!();
    expect(exits).toEqual([0]);
    const interv = events.find((e) => e.event === 'intervention');
    expect(interv).toBeDefined();
    if (interv && interv.event === 'intervention') {
      expect(interv.kind).toBe('pause');
      expect(interv.trigger).toBe('signal-SIGUSR1');
    }
  });

  it('signal handler dumps state to disk when stateFilePath is set', () => {
    const dir = tmp();
    const stateFile = join(dir, 'dump.json');
    const exits: number[] = [];
    let registered: (() => void) | undefined;
    const state: EngagementState = newEngagementState({
      engagement_id: 'eng-dump',
      target: 'example.com',
      roe_id: 'roe-dump',
    });
    state.completed_phases = ['recon', 'discovery'];

    installSignalHandlers({
      stateFilePath: stateFile,
      getState: () => state,
      eventSink: undefined,
      engagementId: 'eng-dump',
      exit: (code) => exits.push(code),
      on: (sig, handler) => {
        if (sig === 'SIGTERM') registered = handler;
      },
    });
    registered!();

    expect(existsSync(stateFile)).toBe(true);
    const dumped = JSON.parse(readFileSync(stateFile, 'utf-8'));
    expect(dumped.engagement_id).toBe('eng-dump');
    expect(dumped.completed_phases).toEqual(['recon', 'discovery']);
    expect(dumped.reason).toMatch(/^signal-SIGTERM/);
  });
});

// ---------------------------------------------------------------------------
// notifications

describe('runtime/notifications', () => {
  it('dispatchNotification posts JSON to each configured webhook', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const event = makeEvent('eng', 'critical-finding', {
      finding_id: 'f1',
      severity: 'critical',
      title: 'SQLi',
      stop_action: 'halt',
    });
    await dispatchNotification(
      event,
      { webhooks: ['https://hooks.example.com/a', 'https://hooks.example.com/b'] },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url1, init1] = fetcher.mock.calls[0]!;
    expect(url1).toBe('https://hooks.example.com/a');
    expect(init1.method).toBe('POST');
    expect(init1.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init1.body).event).toBe('critical-finding');
  });

  it('dispatchNotification skips events outside the allow-list', async () => {
    const fetcher = vi.fn();
    const event = makeEvent('eng', 'finding-emitted', {
      finding_id: 'f1',
      severity: 'low',
      title: 'minor',
    });
    await dispatchNotification(
      event,
      { webhooks: ['https://hooks.example.com/a'] },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('dispatchNotification swallows webhook errors (non-fatal)', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('connection refused'));
    const event = makeEvent('eng', 'kill', { signal: 'SIGTERM' });
    const events: EngagementEvent[] = [];
    await expect(
      dispatchNotification(
        event,
        { webhooks: ['https://hooks.example.com/a'] },
        (e) => events.push(e),
        fetcher as unknown as typeof fetch,
      ),
    ).resolves.not.toThrow();
    // Failure is recorded as a halt-event with the failure reason
    expect(events.some((e) => e.event === 'halt' && /webhook .* threw/.test((e as { reason: string }).reason))).toBe(true);
  });

  it('dispatchNotification respects custom event allow-list', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const event = makeEvent('eng', 'finding-emitted', {
      finding_id: 'f1',
      severity: 'low',
      title: 'minor',
    });
    await dispatchNotification(
      event,
      {
        webhooks: ['https://hooks.example.com/a'],
        events: ['finding-emitted'],
      },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

// F-NOTIFY-CHANNELS-1 — Slack + Discord channel adapters
// Closes APTS-HO-015 multi-channel partial work (was webhook-only).

describe('runtime/notifications — Slack channel', () => {
  it('posts a Slack-shaped payload to each slack URL', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const event = makeEvent('eng-1', 'critical-finding', {
      finding_id: 'f1', severity: 'critical', title: 'SQLi', stop_action: 'halt',
    });
    await dispatchNotification(
      event,
      { slack: ['https://hooks.slack.com/services/xxx', 'https://hooks.slack.com/services/yyy'] },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://hooks.slack.com/services/xxx');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.text).toContain('AEGIS');
    expect(body.text).toContain('critical-finding');
    expect(body.blocks).toBeDefined();
    expect(Array.isArray(body.blocks)).toBe(true);
    expect(body.blocks.length).toBeGreaterThan(0);
  });

  it('Slack payload includes engagement_id in a block', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const event = makeEvent('engagement-deadbeef', 'engagement-start', { roe_hash: 'abc' });
    await dispatchNotification(
      event,
      { slack: ['https://hooks.slack.com/services/xxx'] },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    const [, init] = fetcher.mock.calls[0]!;
    const body = JSON.parse(init.body);
    const flat = JSON.stringify(body);
    expect(flat).toContain('engagement-deadbeef');
  });

  it('Slack channel respects event allow-list', async () => {
    const fetcher = vi.fn();
    const event = makeEvent('eng', 'finding-emitted', { finding_id: 'f1', severity: 'low', title: 'minor' });
    await dispatchNotification(
      event,
      { slack: ['https://hooks.slack.com/services/xxx'] },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('Slack failure is non-fatal and logged with channel-tagged reason', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('slack down'));
    const event = makeEvent('eng', 'kill', { signal: 'SIGTERM' });
    const events: EngagementEvent[] = [];
    await expect(
      dispatchNotification(
        event,
        { slack: ['https://hooks.slack.com/services/xxx'] },
        (e) => events.push(e),
        fetcher as unknown as typeof fetch,
      ),
    ).resolves.not.toThrow();
    expect(events.some((e) => e.event === 'halt' && /notification-slack .* threw/.test((e as { reason: string }).reason))).toBe(true);
  });
});

describe('runtime/notifications — Discord channel', () => {
  it('posts a Discord-shaped payload to each discord URL', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const event = makeEvent('eng-2', 'critical-finding', {
      finding_id: 'f1', severity: 'critical', title: 'XSS', stop_action: 'halt',
    });
    await dispatchNotification(
      event,
      { discord: ['https://discord.com/api/webhooks/123/abc'] },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://discord.com/api/webhooks/123/abc');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.content).toContain('AEGIS');
    expect(body.embeds).toBeDefined();
    expect(Array.isArray(body.embeds)).toBe(true);
    expect(body.embeds[0].title).toBe('critical-finding');
    expect(typeof body.embeds[0].color).toBe('number');
  });

  it('Discord critical-finding gets a red color', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const event = makeEvent('eng', 'critical-finding', { finding_id: 'f1', severity: 'critical', title: 'X', stop_action: 'halt' });
    await dispatchNotification(
      event,
      { discord: ['https://discord.com/api/webhooks/123/abc'] },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    const [, init] = fetcher.mock.calls[0]!;
    const body = JSON.parse(init.body);
    expect(body.embeds[0].color).toBe(16711680);
  });

  it('Discord completion gets a green color', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const event = makeEvent('eng', 'completion', { duration_ms: 1234 });
    await dispatchNotification(
      event,
      { discord: ['https://discord.com/api/webhooks/123/abc'] },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    const [, init] = fetcher.mock.calls[0]!;
    const body = JSON.parse(init.body);
    expect(body.embeds[0].color).toBe(5763719);
  });

  it('Discord failure is non-fatal and logged with channel-tagged reason', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('discord down'));
    const event = makeEvent('eng', 'kill', { signal: 'SIGTERM' });
    const events: EngagementEvent[] = [];
    await dispatchNotification(
      event,
      { discord: ['https://discord.com/api/webhooks/123/abc'] },
      (e) => events.push(e),
      fetcher as unknown as typeof fetch,
    );
    expect(events.some((e) => e.event === 'halt' && /notification-discord .* threw/.test((e as { reason: string }).reason))).toBe(true);
  });
});

describe('runtime/notifications — multi-channel dispatch', () => {
  it('fan-outs to all 3 channel types in a single config', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    const event = makeEvent('eng', 'critical-finding', { finding_id: 'f', severity: 'critical', title: 'X', stop_action: 'halt' });
    await dispatchNotification(
      event,
      {
        webhooks: ['https://hooks.example.com/raw'],
        slack: ['https://hooks.slack.com/services/xxx'],
        discord: ['https://discord.com/api/webhooks/123/abc'],
      },
      undefined,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
    // Each URL should be called exactly once
    const calledUrls = fetcher.mock.calls.map((c) => c[0]);
    expect(calledUrls).toContain('https://hooks.example.com/raw');
    expect(calledUrls).toContain('https://hooks.slack.com/services/xxx');
    expect(calledUrls).toContain('https://discord.com/api/webhooks/123/abc');
  });

  it('config with no channels (all undefined) is a no-op', async () => {
    const fetcher = vi.fn();
    const event = makeEvent('eng', 'critical-finding', { finding_id: 'f', severity: 'critical', title: 'X', stop_action: 'halt' });
    await dispatchNotification(
      event,
      {},
      undefined,
      fetcher as unknown as typeof fetch,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
