/**
 * Hash + chain tests — closes APTS-AR-010 (Cryptographic Hashing of All
 * Evidence) + APTS-AR-012 (Tamper-Evident Logging with Hash Chains).
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sha256,
  canonicalize,
  hashCanonical,
  ChainedEmitter,
  verifyAuditChain,
  initStateFile,
  makeEvent,
  findingEvent,
  type EngagementEvent,
} from '../../src/runtime/index.js';

const tmp = (): string => mkdtempSync(join(tmpdir(), 'aegis-chain-test-'));

// ---------------------------------------------------------------------------
// hash + canonicalize

describe('runtime/hash', () => {
  it('sha256 produces 64-hex-char output', () => {
    const h = sha256('hello');
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(h)).toBe(true);
  });

  it('sha256 matches RFC 6234 known-value for "abc"', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('canonicalize produces identical output for differently-key-ordered objects', () => {
    const a = { b: 2, a: 1, c: { y: 'y', x: 'x' } };
    const b = { a: 1, c: { x: 'x', y: 'y' }, b: 2 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('canonicalize handles arrays in declaration order (not sorted)', () => {
    const a = canonicalize([3, 1, 2]);
    const b = canonicalize([3, 1, 2]);
    expect(a).toBe(b);
    // Order-changed array is a different value
    expect(a).not.toBe(canonicalize([1, 2, 3]));
  });

  it('canonicalize drops undefined-valued fields', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe(canonicalize({ a: 1 }));
  });

  it('hashCanonical is stable across key-order permutations', () => {
    const ev1 = { event: 'halt', engagement_id: 'e', ts: '2026-04-27T00:00:00Z', reason: 'r' };
    const ev2 = { reason: 'r', ts: '2026-04-27T00:00:00Z', engagement_id: 'e', event: 'halt' };
    expect(hashCanonical(ev1)).toBe(hashCanonical(ev2));
  });
});

// ---------------------------------------------------------------------------
// ChainedEmitter

describe('runtime/ChainedEmitter', () => {
  it('first emission has prev_hash = null and a populated this_hash', () => {
    const captured: EngagementEvent[] = [];
    const emitter = new ChainedEmitter({ sink: (ev) => captured.push(ev) });
    const out = emitter.emit(makeEvent('eng', 'halt', { reason: 'first' }));
    expect(out.prev_hash).toBe(null);
    expect(typeof out.this_hash).toBe('string');
    expect(out.this_hash).toHaveLength(64);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.this_hash).toBe(out.this_hash);
  });

  it('subsequent emissions chain prev_hash to the previous this_hash', () => {
    const captured: EngagementEvent[] = [];
    const emitter = new ChainedEmitter({ sink: (ev) => captured.push(ev) });
    const a = emitter.emit(makeEvent('eng', 'halt', { reason: 'a' }));
    const b = emitter.emit(makeEvent('eng', 'halt', { reason: 'b' }));
    const c = emitter.emit(makeEvent('eng', 'halt', { reason: 'c' }));
    expect(b.prev_hash).toBe(a.this_hash);
    expect(c.prev_hash).toBe(b.this_hash);
  });

  it('caller-provided this_hash is overwritten by the emitter', () => {
    const captured: EngagementEvent[] = [];
    const emitter = new ChainedEmitter({ sink: (ev) => captured.push(ev) });
    const out = emitter.emit({
      ts: '2026-04-27T00:00:00Z',
      engagement_id: 'eng',
      event: 'halt',
      reason: 'caller-tampered',
      this_hash: 'definitely-not-the-real-hash',
    } as EngagementEvent);
    expect(out.this_hash).not.toBe('definitely-not-the-real-hash');
    expect(out.this_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('initialPrevHash threads chain across resume', () => {
    const captured: EngagementEvent[] = [];
    const emitter = new ChainedEmitter({
      sink: (ev) => captured.push(ev),
      initialPrevHash: 'prior-tail-hash-from-resume-state',
    });
    const out = emitter.emit(makeEvent('eng', 'resume', {
      from_state_file: '/tmp/x.json',
      completed_phases: [],
      findings_carried: 0,
    }));
    expect(out.prev_hash).toBe('prior-tail-hash-from-resume-state');
  });

  it('getTail returns the hash of the most recent emission', () => {
    const emitter = new ChainedEmitter({ sink: undefined });
    expect(emitter.getTail()).toBe(null);
    const a = emitter.emit(makeEvent('eng', 'halt', { reason: 'a' }));
    expect(emitter.getTail()).toBe(a.this_hash);
    const b = emitter.emit(makeEvent('eng', 'halt', { reason: 'b' }));
    expect(emitter.getTail()).toBe(b.this_hash);
  });
});

// ---------------------------------------------------------------------------
// verifyAuditChain

describe('runtime/verifyAuditChain', () => {
  it('returns ok on a freshly-emitted chain', () => {
    const dir = tmp();
    const file = join(dir, 'chain.jsonl');
    initStateFile(file);
    const emitter = new ChainedEmitter({ sink: file });
    emitter.emit(makeEvent('eng', 'engagement-start', {
      target: 'example.com',
      roe_id: 'r',
      roe_synthesized: false,
      mode: 'siege',
    }));
    emitter.emit(makeEvent('eng', 'phase-transition', { phase: 'recon', transition: 'enter' }));
    emitter.emit(makeEvent('eng', 'phase-transition', { phase: 'recon', transition: 'exit', duration_ms: 100 }));
    emitter.emit(makeEvent('eng', 'completion', {
      duration_ms: 200,
      total_findings: 0,
      score: 1000,
      grade: 'S',
      blocked: false,
    }));
    const result = verifyAuditChain(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.total_events).toBe(4);
      expect(result.tail_hash).toBe(emitter.getTail());
    }
  });

  it('detects this_hash mismatch (event content tampered)', () => {
    const dir = tmp();
    const file = join(dir, 'chain.jsonl');
    initStateFile(file);
    const emitter = new ChainedEmitter({ sink: file });
    emitter.emit(makeEvent('eng', 'halt', { reason: 'original' }));
    emitter.emit(makeEvent('eng', 'halt', { reason: 'second' }));

    // Tamper line 1 — flip the `reason` to a new value, keep this_hash.
    const lines = readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    const tampered = JSON.parse(lines[1]!);
    tampered.reason = 'tampered-after-emit';
    lines[1] = JSON.stringify(tampered);
    writeFileSync(file, lines.join('\n') + '\n');

    const result = verifyAuditChain(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.broken_at).toBe(1);
      expect(result.error).toMatch(/this_hash mismatch/);
    }
  });

  it('detects prev_hash chain break (event removed from middle)', () => {
    const dir = tmp();
    const file = join(dir, 'chain.jsonl');
    initStateFile(file);
    const emitter = new ChainedEmitter({ sink: file });
    emitter.emit(makeEvent('eng', 'halt', { reason: 'a' }));
    emitter.emit(makeEvent('eng', 'halt', { reason: 'b' }));
    emitter.emit(makeEvent('eng', 'halt', { reason: 'c' }));

    // Remove the middle line — now line2 (was c) has prev_hash pointing at b's hash, but the previous-on-disk is now a.
    const lines = readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    writeFileSync(file, [lines[0], lines[2]].join('\n') + '\n');

    const result = verifyAuditChain(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.broken_at).toBe(1);
      expect(result.error).toMatch(/prev_hash chain break/);
    }
  });

  it('returns failure on file-missing', () => {
    const dir = tmp();
    const result = verifyAuditChain(join(dir, 'nope.jsonl'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found/);
  });

  it('returns failure on malformed JSON', () => {
    const dir = tmp();
    const file = join(dir, 'bad.jsonl');
    writeFileSync(file, '{ this is not valid json }\n');
    const result = verifyAuditChain(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/);
  });
});

// ---------------------------------------------------------------------------
// findingEvent now produces evidence_hash

describe('runtime/findingEvent — evidence_hash for AR-010', () => {
  it('includes evidence_hash on the emitted finding-event', () => {
    const ev = findingEvent('eng', {
      id: 'F1',
      scanner: 'test',
      category: 'security',
      severity: 'critical',
      title: 'SQL Injection',
      cwe: 89,
    });
    if (ev.event === 'finding-emitted') {
      expect(ev.evidence_hash).toBeDefined();
      expect(ev.evidence_hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(ev.evidence_hash!)).toBe(true);
    }
  });

  it('evidence_hash is deterministic for identical finding shapes', () => {
    const a = findingEvent('eng', { id: 'F1', scanner: 't', category: 'security', severity: 'critical', title: 't' });
    const b = findingEvent('eng', { id: 'F1', scanner: 't', category: 'security', severity: 'critical', title: 't' });
    if (a.event === 'finding-emitted' && b.event === 'finding-emitted') {
      expect(a.evidence_hash).toBe(b.evidence_hash);
    }
  });

  it('different finding content yields different evidence_hash', () => {
    const a = findingEvent('eng', { id: 'F1', scanner: 't', category: 'security', severity: 'critical', title: 't' });
    const b = findingEvent('eng', { id: 'F1', scanner: 't', category: 'security', severity: 'high', title: 't' });
    if (a.event === 'finding-emitted' && b.event === 'finding-emitted') {
      expect(a.evidence_hash).not.toBe(b.evidence_hash);
    }
  });
});
