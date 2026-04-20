/**
 * v0.15.2 Item-7 — cold-install-UX banner routing contract.
 *
 * When `aegis scan` detects that external-tool scanners (semgrep,
 * gitleaks, osv-scanner, trufflehog, etc.) are not available on PATH,
 * it must surface a warning banner so users know the scan ran with
 * partial coverage. The banner is a stderr-only diagnostic — stdout
 * must remain a pure, machine-consumable payload for `--format json`
 * consumers piping to jq or similar JSON processors.
 *
 * This integration test spawns the compiled CLI with a cleared PATH
 * so every external-tool-wrapper scanner's `isAvailable()` returns
 * false, then asserts the banner surfaces on stderr, stdout stays
 * valid JSON, and the banner text never leaks into stdout.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

vi.setConfig({ testTimeout: 60_000 });

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_BIN = join(__dirname, '..', 'dist', 'index.js');
// Absolute path to the current node binary — lets us clear PATH inside the
// child env (which is what makes external-tool commandExists lookups fail)
// without simultaneously breaking the shell's ability to find `node` itself.
const NODE_BIN = process.execPath;

async function runCli(
  args: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(`"${NODE_BIN}" "${CLI_BIN}" ${args}`, {
      cwd,
      env,
      timeout: 45_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.code ?? 1 };
  }
}

describe('Item-7 — scan external-tool missing banner (stderr-only contract)', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'aegis-banner-test-'));
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify(
        {
          name: 'aegis-banner-test',
          version: '0.0.1',
          dependencies: { next: '^14.0.0' },
        },
        null,
        2,
      ),
    );
    mkdirSync(join(tempDir, 'app'), { recursive: true });
    writeFileSync(
      join(tempDir, 'app', 'page.tsx'),
      'export default function Page() { return <div>ok</div>; }\n',
    );
  });

  afterAll(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  // Clearing PATH forces every external-tool scanner's commandExists
  // lookup to fail, which in turn makes isAvailable return false for
  // semgrep / gitleaks / osv-scanner / trufflehog / etc.
  function noPathEnv(): NodeJS.ProcessEnv {
    return { ...process.env, PATH: '/nonexistent-aegis-banner-test' };
  }

  it('emits external-tools-missing banner to stderr when tools are absent from PATH', async () => {
    const result = await runCli('scan . --format json', tempDir, noPathEnv());
    expect(result.stderr).toMatch(/external scanners unavailable/i);
  });

  it('banner references aegis doctor (v0.15.3) upgrade path on stderr', async () => {
    const result = await runCli('scan . --format json', tempDir, noPathEnv());
    expect(result.stderr).toContain('aegis doctor');
  });

  it('stdout stays parseable JSON even when banner fires on stderr', async () => {
    const result = await runCli('scan . --format json', tempDir, noPathEnv());
    const jsonStart = result.stdout.indexOf('{');
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    expect(() => JSON.parse(result.stdout.slice(jsonStart))).not.toThrow();
  });

  it('banner text never leaks into stdout (JSON-purity guarantee)', async () => {
    const result = await runCli('scan . --format json', tempDir, noPathEnv());
    expect(result.stdout).not.toMatch(/external scanners unavailable/i);
    expect(result.stdout).not.toContain('aegis doctor');
  });

  it('banner uses the warning glyph or the literal word "unavailable" so it is visually distinct on stderr', async () => {
    const result = await runCli('scan . --format json', tempDir, noPathEnv());
    expect(result.stderr).toMatch(/⚠|unavailable/);
  });
});
