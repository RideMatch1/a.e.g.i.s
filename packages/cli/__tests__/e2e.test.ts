/**
 * E2E tests for the AEGIS CLI binary.
 *
 * These tests run the actual compiled CLI (packages/cli/dist/index.js) against
 * a temporary project directory and validate the real output. They require a
 * successful `pnpm build` before running — CI runs `pnpm build && pnpm test`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// E2E tests spawn real CLI processes — CI runners need more time
vi.setConfig({ testTimeout: 30_000 });
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the compiled CLI entry point
const CLI_BIN = join(__dirname, '..', 'dist', 'index.js');

// Temp dir created once per suite, cleaned up in afterAll
let tempDir: string;

// Minimal package.json for a temp project (Next.js/TS so stack detection works)
const MINIMAL_PACKAGE_JSON = JSON.stringify(
  {
    name: 'aegis-e2e-temp',
    version: '1.0.0',
    dependencies: {
      next: '^14.0.0',
      react: '^18.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
    },
  },
  null,
  2,
);

async function runCli(
  args: string,
  cwd?: string,
  timeoutMs = 60_000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(
      `node "${CLI_BIN}" ${args}`,
      { cwd: cwd ?? tempDir, timeout: timeoutMs },
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    // execAsync rejects on non-zero exit; capture output anyway
    const execErr = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execErr.stdout ?? '',
      stderr: execErr.stderr ?? '',
      exitCode: execErr.code ?? 1,
    };
  }
}

beforeAll(async () => {
  // Bail out early if the CLI hasn't been built yet
  if (!existsSync(CLI_BIN)) {
    throw new Error(
      `CLI binary not found at ${CLI_BIN}. Run \`pnpm build\` first.`,
    );
  }

  // Create temp project with a package.json
  tempDir = await mkdtemp('/tmp/aegis-e2e-');
  await writeFile(join(tempDir, 'package.json'), MINIMAL_PACKAGE_JSON, 'utf8');
});

afterAll(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------

describe('CLI E2E — scan --format json', () => {
  it('produces valid JSON output', async () => {
    const { stdout, exitCode } = await runCli(
      `scan "${tempDir}" --format json --no-color`,
    );

    // Exit code 0 means not blocked; 1 means blocked but still valid output
    expect([0, 1]).toContain(exitCode);

    let parsed: Record<string, unknown>;
    expect(() => {
      parsed = JSON.parse(stdout) as Record<string, unknown>;
    }, 'stdout must be valid JSON').not.toThrow();

    // After parse — assert top-level shape
    expect(typeof parsed!.score).toBe('number');
    expect(parsed!.score).toBeGreaterThanOrEqual(0);
    expect(parsed!.score).toBeLessThanOrEqual(1000);

    expect(typeof parsed!.grade).toBe('string');
    expect(['S', 'A', 'B', 'C', 'D', 'F']).toContain(parsed!.grade as string);

    expect(Array.isArray(parsed!.findings)).toBe(true);
    expect(typeof parsed!.timestamp).toBe('string');
    expect(typeof parsed!.duration).toBe('number');
  });
});

// ---------------------------------------------------------------------------

describe('CLI E2E — scan --format sarif', () => {
  it('produces valid SARIF 2.1.0 output', async () => {
    const { stdout, exitCode } = await runCli(
      `scan "${tempDir}" --format sarif --no-color`,
    );

    expect([0, 1]).toContain(exitCode);

    let sarif: Record<string, unknown>;
    expect(() => {
      sarif = JSON.parse(stdout) as Record<string, unknown>;
    }, 'stdout must be valid JSON').not.toThrow();

    expect(sarif!.version).toBe('2.1.0');
    expect(typeof sarif!.$schema).toBe('string');
    expect((sarif!.$schema as string)).toContain('sarif-schema-2.1.0.json');

    const runs = sarif!.runs as Array<Record<string, unknown>>;
    expect(Array.isArray(runs)).toBe(true);
    expect(runs.length).toBeGreaterThan(0);

    const driver = (runs[0].tool as Record<string, unknown>).driver as Record<string, unknown>;
    expect(driver.name).toBe('AEGIS');
  });
});

// ---------------------------------------------------------------------------

describe('CLI E2E — scan --format markdown', () => {
  it('produces Markdown output starting with a H1 heading', async () => {
    const { stdout, exitCode } = await runCli(
      `scan "${tempDir}" --format markdown --no-color`,
    );

    expect([0, 1]).toContain(exitCode);
    expect(stdout.trimStart()).toMatch(/^# AEGIS Security Audit Report/);
    expect(stdout).toContain('## Executive Summary');
    expect(stdout).toContain('## Scanner Results');
  });
});

// ---------------------------------------------------------------------------

describe('CLI E2E — init', () => {
  let initDir: string;

  beforeAll(async () => {
    initDir = await mkdtemp('/tmp/aegis-e2e-init-');
    // Put a package.json so detectStack has something to read
    await writeFile(join(initDir, 'package.json'), MINIMAL_PACKAGE_JSON, 'utf8');
  });

  afterAll(() => {
    if (initDir && existsSync(initDir)) {
      rmSync(initDir, { recursive: true, force: true });
    }
  });

  it('creates aegis.config.json in the target directory', async () => {
    const { exitCode } = await runCli(`init "${initDir}"`, initDir);

    expect(exitCode).toBe(0);

    const configPath = join(initDir, 'aegis.config.json');
    expect(existsSync(configPath)).toBe(true);

    const raw = await readFile(configPath, 'utf8');
    const config = JSON.parse(raw) as Record<string, unknown>;

    expect(typeof config.stack).toBe('object');
    expect(config.stack).not.toBeNull();
    expect(Array.isArray(config.ignore)).toBe(true);
  });
});
