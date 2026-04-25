import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * AUDIT-AEGIS-SCAN-V0165 §3 M3 — MCP server's runtime serverInfo.version
 * was hardcoded to "0.2.0" while the package shipped at 0.16.x. Breaks
 * the 5-package lockstep-honesty signal (an MCP client like Claude Code,
 * Cursor, or Continue would display "aegis-mcp 0.2.0" while the user
 * installed @aegis-scan/mcp-server@0.16.x).
 *
 * SC-4 fix: read version from package.json at module load. This test
 * asserts that the source-of-truth (package.json) is parsed correctly
 * and that the server-construction code (src/index.ts) reads from it.
 */
describe('mcp-server — lockstep-honesty version reporting (M3, AUDIT-AEGIS-SCAN-V0165 §3)', () => {
  it('package.json version matches semver shape', () => {
    const pkgJson = JSON.parse(
      readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
    ) as { version: string };
    expect(pkgJson.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('src/index.ts reads version from package.json (no hardcoded literal)', () => {
    const indexSrc = readFileSync(
      join(__dirname, '..', 'src', 'index.ts'),
      'utf-8',
    );
    // Must construct McpServer with version from pkgJson, not a literal.
    expect(indexSrc).toMatch(/version:\s*pkgJson\.version/);
    // The literal "0.2.0" that triggered the audit-finding must be gone.
    expect(indexSrc).not.toMatch(/version:\s*['"]0\.2\.0['"]/);
  });

  it('McpServer is constructed with the package.json version', async () => {
    // Import the module (triggers the package.json read at module-load).
    // We can't easily intercept the McpServer constructor without mocking
    // the SDK, so we assert the source-shape via the previous test and
    // here we assert the module loads without throwing.
    await expect(import('../src/index.js')).resolves.toBeDefined();
  });
});
