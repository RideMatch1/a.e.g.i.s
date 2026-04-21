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
          if (exts.length === 0 || exts.includes(ext)) results.push(full);
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
    isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),

  };
});

import { configAuditorScanner } from '../../src/quality/config-auditor.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-config-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const fullPath = join(projectPath, relPath);
  const parts = relPath.split('/');
  const dir = parts.slice(0, -1).join('/');
  if (dir) mkdirSync(join(projectPath, dir), { recursive: true });
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('configAuditorScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await configAuditorScanner.isAvailable(projectPath)).toBe(true);
  });

  it('returns empty findings for clean project', async () => {
    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
    expect(result.scanner).toBe('config-auditor');
    expect(result.category).toBe('security');
  });
});

describe('configAuditorScanner — Docker checks', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags FROM :latest as HIGH', async () => {
    createFile(projectPath, 'Dockerfile', 'FROM node:latest\nRUN npm install\n');

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Unpinned Docker'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('does NOT flag pinned Docker image', async () => {
    createFile(projectPath, 'Dockerfile', 'FROM node:20.11-alpine\nRUN npm install\n');

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Unpinned Docker'));
    expect(finding).toBeUndefined();
  });

  it('flags ADD with remote URL as HIGH', async () => {
    createFile(projectPath, 'Dockerfile', 'FROM node:20\nADD https://example.com/setup.sh /app/\n');

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('ADD with remote URL'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('flags ENV with SECRET as CRITICAL', async () => {
    createFile(projectPath, 'Dockerfile', 'FROM node:20\nENV DATABASE_PASSWORD=mypass123\n');

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Secrets in Dockerfile'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('flags privileged in docker-compose as CRITICAL', async () => {
    createFile(
      projectPath,
      'docker-compose.yml',
      'services:\n  app:\n    image: myapp\n    privileged: true\n',
    );

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Privileged container'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });
});

describe('configAuditorScanner — Next.js checks', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags wildcard image domains as HIGH', async () => {
    createFile(
      projectPath,
      'next.config.js',
      `module.exports = {
        images: { domains: ['*'] },
        poweredByHeader: false,
      };`,
    );

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Wildcard image'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('flags poweredByHeader: true as MEDIUM', async () => {
    createFile(
      projectPath,
      'next.config.js',
      `module.exports = { poweredByHeader: true };`,
    );

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('X-Powered-By header exposes'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('flags missing poweredByHeader setting as MEDIUM', async () => {
    createFile(
      projectPath,
      'next.config.js',
      `module.exports = { reactStrictMode: true };`,
    );

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('X-Powered-By header not disabled'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('flags large bodySizeLimit as MEDIUM', async () => {
    createFile(
      projectPath,
      'next.config.mjs',
      `export default {
        experimental: { serverActions: { bodySizeLimit: '50mb' } },
        poweredByHeader: false,
      };`,
    );

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('body limit'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('medium');
  });

  it('does NOT flag bodySizeLimit under 10mb', async () => {
    createFile(
      projectPath,
      'next.config.js',
      `module.exports = {
        experimental: { serverActions: { bodySizeLimit: '5mb' } },
        poweredByHeader: false,
      };`,
    );

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('body limit'));
    expect(finding).toBeUndefined();
  });
});

describe('configAuditorScanner — Firebase checks', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags public Firestore rules as CRITICAL', async () => {
    createFile(
      projectPath,
      'firestore.rules',
      `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`,
    );

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Firestore rules'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('flags public Realtime Database writes as CRITICAL', async () => {
    createFile(
      projectPath,
      'database.rules.json',
      `{ "rules": { ".read": true, ".write": true } }`,
    );

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Realtime Database'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });
});

describe('configAuditorScanner — Environment file checks', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('flags .env not in .gitignore as CRITICAL', async () => {
    createFile(projectPath, '.env', 'SECRET_KEY=abc123');
    createFile(projectPath, '.gitignore', 'node_modules\ndist\n');

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Environment files'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('does NOT flag .env when in .gitignore', async () => {
    createFile(projectPath, '.env', 'SECRET_KEY=abc123');
    createFile(projectPath, '.gitignore', 'node_modules\n.env\ndist\n');

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('Environment files'));
    expect(finding).toBeUndefined();
  });

  it('flags .env.production not covered by .gitignore as HIGH', async () => {
    createFile(projectPath, '.env.production', 'DB_URL=postgres://...');
    createFile(projectPath, '.gitignore', 'node_modules\n.env\n');

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    const finding = result.findings.find((f) => f.title.includes('.env.production'));
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('high');
  });

  it('all finding IDs are CONFIG-0xx format', async () => {
    createFile(projectPath, 'Dockerfile', 'FROM node:latest\nENV SECRET=x\n');

    const result = await configAuditorScanner.scan(projectPath, MOCK_CONFIG);
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^CONFIG-\d{3}$/);
    }
  });
});
