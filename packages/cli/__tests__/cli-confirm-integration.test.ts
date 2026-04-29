import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { join } from 'path';

/**
 * v0.17.8 MED-005 — integration test against the actual CLI binary so a
 * future regression in Commander.js parsing of `--confirm` is caught.
 * Pre-v0.17.8 the disclaimer logic was unit-tested via direct calls to
 * evaluateActiveModeAuthorization, bypassing the CLI parser entirely.
 *
 * These tests spawn the built CLI binary as a child process so the
 * full argv -> Commander -> runPentest path is exercised end-to-end.
 */

const CLI = join(__dirname, '..', 'dist', 'index.js');

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): CliResult {
  const result = spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    timeout: 15000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('CLI --confirm parsing (MED-005 integration test)', () => {
  it('aegis pentest WITHOUT --confirm exits 1 and prints the legal disclaimer', () => {
    const r = runCli(['pentest', '.', '--target', 'http://localhost:3000']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/AEGIS PENTEST — ACTIVE-MODE TRAFFIC/);
    expect(r.stderr).toMatch(/CFAA/);
    expect(r.stderr).toMatch(/StGB/);
    expect(r.stderr).toMatch(/Computer Misuse Act/);
    expect(r.stderr).toMatch(/--confirm to acknowledge/);
  });

  it('aegis siege WITHOUT --confirm exits 1 and prints the legal disclaimer', () => {
    const r = runCli(['siege', '.', '--target', 'http://localhost:3000']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/AEGIS SIEGE — ACTIVE-MODE TRAFFIC/);
    expect(r.stderr).toMatch(/CFAA/);
  });

  it('aegis pentest with --confirm=false is rejected by Commander (no truthy bypass)', () => {
    const r = runCli(['pentest', '.', '--target', 'http://localhost:3000', '--confirm=false']);
    // Commander.js: --confirm is a boolean flag; --confirm=false is an unknown
    // option syntax. Expect a non-zero exit with an error message rather than
    // a treat-string-as-truthy bypass.
    expect(r.status).not.toBe(0);
  });

  it(
    'aegis pentest with --confirm shows the authorization-acknowledgement banner on stderr',
    { timeout: 20000 },
    () => {
      // 10.0.0.1 is RFC 1918 — safeFetch rejects immediately, so the test
      // does not hang on a real network attempt.
      const r = runCli([
        'pentest',
        '.',
        '--target',
        'http://10.0.0.1',
        '--confirm',
      ]);
      // The disclaimer ack should print to stderr before the safeFetch
      // rejection. We don't assert on exit-code — only that --confirm was
      // honored at the gate.
      expect(r.stderr).toMatch(/\[authorization\] aegis pentest --confirm acknowledged/);
      // The legal-warning block (ACTIVE-MODE TRAFFIC) must NOT print when
      // --confirm is supplied — only the brief acknowledgement.
      expect(r.stderr).not.toMatch(/AEGIS PENTEST — ACTIVE-MODE TRAFFIC/);
    },
  );

  it(
    'aegis siege with --confirm shows the authorization-acknowledgement banner on stderr',
    { timeout: 20000 },
    () => {
      const r = runCli([
        'siege',
        '.',
        '--target',
        'http://10.0.0.1',
        '--confirm',
      ]);
      expect(r.stderr).toMatch(/\[authorization\] aegis siege --confirm acknowledged/);
    },
  );
});
