import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@aegis-scan/core', () => {
  const { readdirSync, readFileSync, statSync } = require('fs');
  const { join } = require('path');

  function walkFilesSync(dir: string, ignore: string[], exts: string[]): string[] {
    const results: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (ignore.includes(entry)) continue;
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...walkFilesSync(full, ignore, exts));
        } else {
          const ext = entry.split('.').pop() ?? '';
          if (exts.includes(ext)) results.push(full);
        }
      } catch {
        // skip
      }
    }
    return results;
  }

  return {
    walkFiles: (dir: string, ignore: string[], exts: string[]) =>
      walkFilesSync(dir, ignore, exts),
    readFileSafe: (path: string) => {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        return null;
      }
    },
    commandExists: async () => true,
    exec: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
  };
});

import { rscDataCheckerScanner } from '../../src/quality/rsc-data-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-rsc-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const parts = relPath.split('/');
  const dir = join(projectPath, ...parts.slice(0, -1));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('rscDataCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await rscDataCheckerScanner.isAvailable('')).toBe(true);
  });

  it('returns no findings for empty project', async () => {
    const result = await rscDataCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('rsc-data-checker');
    expect(result.findings).toHaveLength(0);
  });

  it('flags page.tsx with select(*) passed to JSX as MEDIUM', async () => {
    createFile(
      projectPath,
      'app/users/page.tsx',
      `
export default async function UsersPage() {
  const { data } = await supabase.from('users').select('*');
  return <UserList data={data} />;
}
`,
    );

    const result = await rscDataCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.severity).toBe('medium');
    expect(finding.id).toMatch(/^RSC-/);
    expect(finding.owasp).toBe('A01:2021');
    expect(finding.cwe).toBe(200);
    expect(finding.title).toContain('Server Component');
  });

  it('does NOT flag page.tsx with specific field selection', async () => {
    createFile(
      projectPath,
      'app/users/page.tsx',
      `
export default async function UsersPage() {
  const { data } = await supabase.from('users').select('id, name, email');
  return <UserList data={data} />;
}
`,
    );

    const result = await rscDataCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('does NOT flag non-page/layout files', async () => {
    createFile(
      projectPath,
      'components/UserWidget.tsx',
      `
export default async function UserWidget() {
  const { data } = await supabase.from('users').select('*');
  return <div data={data} />;
}
`,
    );

    const result = await rscDataCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('flags layout.tsx with select(*) and spread data', async () => {
    createFile(
      projectPath,
      'app/layout.tsx',
      `
export default async function RootLayout() {
  const { data } = await supabase.from('settings').select('*');
  return <AppShell {...data} />;
}
`,
    );

    const result = await rscDataCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('does NOT flag select(*) without data passed to JSX', async () => {
    createFile(
      projectPath,
      'app/users/page.tsx',
      `
export default async function UsersPage() {
  const { data } = await supabase.from('users').select('*');
  const names = data.map((u: any) => u.name);
  return <UserList names={names} />;
}
`,
    );

    const result = await rscDataCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('skips test files', async () => {
    createFile(
      projectPath,
      'app/__tests__/page.tsx',
      `
const { data } = await supabase.from('users').select('*');
return <UserList data={data} />;
`,
    );

    const result = await rscDataCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('includes duration and available fields', async () => {
    const result = await rscDataCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });

  // v0.10 Z6 — Prisma full-record RSC leak regression pin.
  it('v0.10 Z6: flags Prisma findUnique passing full record into JSX prop', async () => {
    function createPage(projectPath: string, subPath: string, content: string): void {
      const pageDir = join(projectPath, 'src', 'app', subPath);
      mkdirSync(pageDir, { recursive: true });
      writeFileSync(join(pageDir, 'page.tsx'), content);
    }
    createPage(projectPath, 'profile', `
import { prisma } from '@/lib/prisma';

export default async function ProfilePage({ searchParams }) {
  const user = await prisma.user.findUnique({ where: { id: searchParams.id } });
  if (!user) return <div>not found</div>;
  return <UserCard user={user} />;
}
`);
    const result = await rscDataCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const prismaFindings = result.findings.filter((f) =>
      f.title.includes('Prisma full-record'),
    );
    expect(prismaFindings.length).toBeGreaterThan(0);
    expect(prismaFindings[0].cwe).toBe(200);
  });
});
