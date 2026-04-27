/**
 * APTS-MR-018 — AI input/output sandbox boundary tests.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  validateSandboxMode,
  wrapForSandbox,
  preflightSandboxImages,
  SANDBOX_MODES,
  DEFAULT_WRAPPER_IMAGES,
} from '../../src/manipulation-resistance/ai-io-boundary.js';
import { composeEgressAllowlist } from '../../src/manipulation-resistance/oob-blocker.js';
import type { RoE } from '../../src/roe/types.js';

function buildRoE(): RoE {
  return {
    roe_id: 'mr018-test',
    spec_version: '0.1.0',
    operator: { organization: 'lab', authorized_by: 'tester', contact: 'tester@example.com' },
    authorization: {
      statement: 'authorized for unit testing of sandbox-mode wrapping',
      signature_method: 'operator-attested',
    },
    in_scope: {
      domains: [{ pattern: 'target.test', includeSubdomains: true }],
      ip_ranges: [],
      repository_paths: [],
    },
    out_of_scope: { domains: [], ip_ranges: [], paths: [] },
    asset_criticality: [],
    temporal: {
      start: new Date(Date.now() - 1_000).toISOString(),
      end: new Date(Date.now() + 60_000).toISOString(),
      timezone: 'UTC',
      blackout_windows: [],
    },
    stop_conditions: { on_critical_finding: 'halt' },
    sandboxing: { mode: 'none' },
  };
}

describe('validateSandboxMode', () => {
  it('accepts each enumerated mode', () => {
    for (const m of SANDBOX_MODES) {
      const r = validateSandboxMode(m);
      expect(r.ok).toBe(true);
      expect(r.mode).toBe(m);
    }
  });

  it('returns "none" for empty input', () => {
    expect(validateSandboxMode(undefined)).toEqual({ ok: true, mode: 'none' });
    expect(validateSandboxMode('')).toEqual({ ok: true, mode: 'none' });
  });

  it('rejects unknown modes with explicit reason', () => {
    const r = validateSandboxMode('chroot');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/unknown.*sandbox-mode/);
  });
});

describe('wrapForSandbox', () => {
  const allowlist = composeEgressAllowlist(buildRoE());

  it('passes through unchanged in mode "none"', () => {
    const w = wrapForSandbox('strix', 'strix', ['--target', 'https://t.test'], 'none', { allowlist });
    expect(w.binary).toBe('strix');
    expect(w.args).toEqual(['--target', 'https://t.test']);
    expect(w.sandboxed).toBe(false);
    expect(w.mode_applied).toBe('none');
    expect(w.envAdditions.AEGIS_SANDBOX_MODE).toBe('none');
    expect(w.envAdditions.AEGIS_EGRESS_ALLOWLIST).toBe(allowlist.envValue);
  });

  it('rewrites strix invocation through docker run with custom network', () => {
    const w = wrapForSandbox('strix', 'strix', ['--target', 'https://t.test'], 'docker', { allowlist, dockerNetwork: 'aegis-egress' });
    expect(w.binary).toBe('docker');
    expect(w.args[0]).toBe('run');
    expect(w.args).toContain('--rm');
    expect(w.args).toContain('--network=aegis-egress');
    expect(w.args).toContain('--security-opt=no-new-privileges');
    expect(w.args).toContain('--cap-drop=ALL');
    expect(w.args).toContain(DEFAULT_WRAPPER_IMAGES.strix);
    expect(w.sandboxed).toBe(true);
    expect(w.mode_applied).toBe('docker');
  });

  it('falls back to pass-through with diagnostic env when wrapper has no image mapping', () => {
    const w = wrapForSandbox('unknown', 'unknown', [], 'docker', { allowlist });
    expect(w.binary).toBe('unknown');
    expect(w.sandboxed).toBe(false);
    expect(w.mode_applied).toBe('none');
    expect(w.envAdditions.AEGIS_SANDBOX_FALLBACK).toMatch(/unmapped-wrapper/);
  });

  it('builds firejail invocation in firejail mode', () => {
    const w = wrapForSandbox('strix', 'strix', ['--target', 'https://t.test'], 'firejail', { allowlist });
    expect(w.binary).toBe('firejail');
    expect(w.args).toContain('--read-only=/');
    expect(w.args).toContain('--noroot');
    expect(w.sandboxed).toBe(true);
  });

  it('honors explicit imageOverride for docker mode', () => {
    const w = wrapForSandbox('strix', 'strix', [], 'docker', { allowlist, imageOverride: 'private/strix:custom' });
    expect(w.args).toContain('private/strix:custom');
    expect(w.args).not.toContain(DEFAULT_WRAPPER_IMAGES.strix);
  });
});

describe('preflightSandboxImages — APTS-MR-018 docker preflight', () => {
  it('returns ok=true when every required image and the network exist', () => {
    const probe = vi.fn(() => true);
    const r = preflightSandboxImages({
      wrappers: ['strix', 'ptai', 'pentestswarm'],
      probe,
    });
    expect(r.ok).toBe(true);
    expect(r.missing_network).toBe(false);
    expect(Object.keys(r.missing_images)).toEqual([]);
    expect(r.network_name).toBe('aegis-egress');
    expect(r.apts_refs).toContain('APTS-MR-018');
    expect(r.remediation).toBeUndefined();
  });

  it('returns ok=false with remediation when an image is missing', () => {
    const probe = vi.fn((kind, ref) => {
      if (kind === 'image' && ref.includes('strix')) return false;
      return true;
    });
    const r = preflightSandboxImages({
      wrappers: ['strix', 'ptai', 'pentestswarm'],
      probe,
    });
    expect(r.ok).toBe(false);
    expect(r.missing_images).toEqual({ strix: 'aegis/strix-sandbox:latest' });
    expect(r.missing_network).toBe(false);
    expect(r.remediation).toContain('Missing docker images');
    expect(r.remediation).toContain('aegis/strix-sandbox:latest');
    expect(r.remediation).toContain('bash dockerfiles/sandboxes/build.sh');
  });

  it('returns ok=false with remediation when the egress network is missing', () => {
    const probe = vi.fn((kind, _ref) => kind === 'image');
    const r = preflightSandboxImages({
      wrappers: ['strix'],
      probe,
    });
    expect(r.ok).toBe(false);
    expect(r.missing_network).toBe(true);
    expect(r.remediation).toContain('Missing docker network: aegis-egress');
    expect(r.remediation).toContain('docker network create');
    expect(r.remediation).toContain('--internal');
  });

  it('honors imageOverrides per wrapper', () => {
    const probe = vi.fn(() => true);
    const r = preflightSandboxImages({
      wrappers: ['strix'],
      imageOverrides: { strix: 'private/strix:v2' },
      probe,
    });
    expect(r.ok).toBe(true);
    expect(probe).toHaveBeenCalledWith('image', 'private/strix:v2');
  });

  it('skips unmapped wrappers (they fall back to pass-through in wrapForSandbox)', () => {
    const probe = vi.fn(() => true);
    const r = preflightSandboxImages({
      wrappers: ['unknown-wrapper'],
      probe,
    });
    expect(r.ok).toBe(true);
    expect(Object.keys(r.missing_images)).toEqual([]);
  });

  it('honors custom dockerNetwork', () => {
    const probe = vi.fn(() => true);
    const r = preflightSandboxImages({
      wrappers: [],
      dockerNetwork: 'corp-pentest-egress',
      probe,
    });
    expect(r.network_name).toBe('corp-pentest-egress');
    expect(probe).toHaveBeenCalledWith('network', 'corp-pentest-egress');
  });
});
