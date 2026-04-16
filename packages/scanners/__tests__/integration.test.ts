/**
 * End-to-end integration test — NO MOCKS.
 *
 * Spins up a realistic temp project and runs REAL scanners against it
 * to prove the full pipeline works from walkFiles through to findings.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Orchestrator, loadConfig } from '@aegis-scan/core';
import { authEnforcerScanner } from '../src/quality/auth-enforcer.js';
import { cryptoAuditorScanner } from '../src/quality/crypto-auditor.js';
import { headerCheckerScanner } from '../src/quality/header-checker.js';
import { zodEnforcerScanner } from '../src/quality/zod-enforcer.js';
import { rateLimitCheckerScanner } from '../src/quality/rate-limit-checker.js';

function makeTempProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aegis-integration-'));

  // package.json — triggers detectStack to find nextjs + supabase
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        next: '16.0.0',
        '@supabase/supabase-js': '2.0.0',
      },
    }),
  );

  // next.config.ts — empty, no security headers configured
  writeFileSync(join(dir, 'next.config.ts'), 'export default {};\n');

  // --- API routes ---

  // admin/users — POST handler WITHOUT Zod, WITHOUT auth guard
  const usersRouteDir = join(dir, 'src', 'app', 'api', 'admin', 'users');
  mkdirSync(usersRouteDir, { recursive: true });
  writeFileSync(
    join(usersRouteDir, 'route.ts'),
    `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  // No auth guard, no Zod validation
  return NextResponse.json({ created: true, data: body });
}
`,
  );

  // admin/payments — POST handler WITHOUT rate-limit
  const paymentsRouteDir = join(dir, 'src', 'app', 'api', 'admin', 'payments');
  mkdirSync(paymentsRouteDir, { recursive: true });
  writeFileSync(
    join(paymentsRouteDir, 'route.ts'),
    `import { NextResponse } from 'next/server';
import { secureApiRouteWithTenant } from '@/lib/api/tenant-guard';
import { requireRole } from '@/lib/api/require-role';

export async function POST(request: Request) {
  const { context } = await secureApiRouteWithTenant(request, { requireAuth: true });
  requireRole(context, ['admin']);
  // No rate limiting on a payment endpoint!
  const body = await request.json();
  return NextResponse.json({ charged: true });
}
`,
  );

  // public/health — GET handler (should NOT be flagged by auth-enforcer)
  const healthRouteDir = join(dir, 'src', 'app', 'api', 'public', 'health');
  mkdirSync(healthRouteDir, { recursive: true });
  writeFileSync(
    join(healthRouteDir, 'route.ts'),
    `import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
`,
  );

  // --- Weak crypto file ---
  const utilsDir = join(dir, 'src', 'lib', 'utils');
  mkdirSync(utilsDir, { recursive: true });
  writeFileSync(
    join(utilsDir, 'tokens.ts'),
    `export function generateToken(): string {
  return Math.random().toString(36).slice(2);
}
`,
  );

  return dir;
}

describe('Integration — real scanners, no mocks', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  afterEach(() => {
    rmSync(projectPath, { recursive: true, force: true });
  });

  it('auth-enforcer finds admin/users (missing auth) but NOT public/health', async () => {
    const config = await loadConfig(projectPath, 'scan');
    const result = await authEnforcerScanner.scan(projectPath, config);

    // Should flag admin/users (no auth guard at all)
    const usersFindings = result.findings.filter((f) =>
      f.file?.includes('admin/users'),
    );
    expect(usersFindings.length).toBeGreaterThan(0);
    expect(usersFindings[0].severity).toBe('high');

    // Should NOT flag public/health (public route)
    const healthFindings = result.findings.filter((f) =>
      f.file?.includes('public/health'),
    );
    expect(healthFindings).toHaveLength(0);
  });

  it('crypto-auditor finds Math.random() in tokens.ts', async () => {
    const config = await loadConfig(projectPath, 'scan');
    const result = await cryptoAuditorScanner.scan(projectPath, config);

    const randomFindings = result.findings.filter(
      (f) => f.title.includes('Math.random') || f.title.includes('Weak RNG'),
    );
    expect(randomFindings.length).toBeGreaterThan(0);
    expect(randomFindings[0].file).toContain('tokens.ts');
  });

  it('header-checker finds missing security headers', async () => {
    const config = await loadConfig(projectPath, 'scan');
    const result = await headerCheckerScanner.scan(projectPath, config);

    // Empty next.config.ts means ALL 7 security headers are missing
    expect(result.findings.length).toBeGreaterThanOrEqual(7);
    const titles = result.findings.map((f) => f.title);
    expect(titles.some((t) => t.includes('Strict-Transport-Security'))).toBe(true);
    expect(titles.some((t) => t.includes('Content-Security-Policy'))).toBe(true);
  });

  it('zod-enforcer finds admin/users POST without Zod', async () => {
    const config = await loadConfig(projectPath, 'scan');
    const result = await zodEnforcerScanner.scan(projectPath, config);

    const zodFindings = result.findings.filter((f) =>
      f.file?.includes('admin/users'),
    );
    expect(zodFindings.length).toBeGreaterThan(0);
    expect(zodFindings[0].title).toContain('Zod');
  });

  it('rate-limit-checker finds admin/payments without rate limit', async () => {
    const config = await loadConfig(projectPath, 'scan');
    const result = await rateLimitCheckerScanner.scan(projectPath, config);

    const rateFindings = result.findings.filter((f) =>
      f.file?.includes('admin/payments'),
    );
    expect(rateFindings.length).toBeGreaterThan(0);
    expect(rateFindings[0].title).toContain('rate limit');
  });

  it('full orchestrator pipeline produces findings and score < 1000', async () => {
    const config = await loadConfig(projectPath, 'scan');
    const orchestrator = new Orchestrator();

    orchestrator.register(authEnforcerScanner);
    orchestrator.register(cryptoAuditorScanner);
    orchestrator.register(headerCheckerScanner);
    orchestrator.register(zodEnforcerScanner);
    orchestrator.register(rateLimitCheckerScanner);

    const result = await orchestrator.run(config);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1000);
    expect(typeof result.grade).toBe('string');
    expect(typeof result.badge).toBe('string');
    expect(result.duration).toBeGreaterThan(0);
    expect(result.scanResults).toHaveLength(5);
    expect(result.scanResults.every((r) => r.available)).toBe(true);
  });
});
