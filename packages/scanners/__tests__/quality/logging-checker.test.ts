import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

import { loggingCheckerScanner } from '../../src/quality/logging-checker.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-logging-test-'));
}

function createFile(projectPath: string, relPath: string, content: string): string {
  const dir = join(projectPath, relPath.split('/').slice(0, -1).join('/'));
  mkdirSync(dir, { recursive: true });
  const fullPath = join(projectPath, relPath);
  writeFileSync(fullPath, content);
  return fullPath;
}

describe('loggingCheckerScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
  });

  it('is always available', async () => {
    expect(await loggingCheckerScanner.isAvailable(projectPath)).toBe(true);
  });

  it('flags missing centralized logger when no logger package or file exists', async () => {
    // No package.json, no logger file, no imports
    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.scanner).toBe('logging-checker');

    const loggerFindings = result.findings.filter((f) => f.title.includes('No centralized logging'));
    expect(loggerFindings.length).toBeGreaterThan(0);
    expect(loggerFindings[0].severity).toBe('medium');
    expect(loggerFindings[0].category).toBe('quality');
    expect(loggerFindings[0].owasp).toBe('A09:2021');
    expect(loggerFindings[0].cwe).toBe(778);
  });

  it('does NOT flag logger when winston is in package.json', async () => {
    createFile(projectPath, 'package.json', JSON.stringify({
      dependencies: { 'winston': '^3.0.0' },
    }));

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const loggerFindings = result.findings.filter((f) => f.title.includes('No centralized logging'));
    expect(loggerFindings).toHaveLength(0);
  });

  it('does NOT flag logger when pino is in package.json', async () => {
    createFile(projectPath, 'package.json', JSON.stringify({
      dependencies: { 'pino': '^8.0.0' },
    }));

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const loggerFindings = result.findings.filter((f) => f.title.includes('No centralized logging'));
    expect(loggerFindings).toHaveLength(0);
  });

  it('does NOT flag logger when custom logger file exists', async () => {
    createFile(projectPath, 'lib/logger.ts', `
      import winston from 'winston';
      export const logger = winston.createLogger({ level: 'info' });
    `);

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const loggerFindings = result.findings.filter((f) => f.title.includes('No centralized logging'));
    expect(loggerFindings).toHaveLength(0);
  });

  it('flags mutation route without audit logging', async () => {
    createFile(projectPath, 'package.json', JSON.stringify({
      dependencies: { 'winston': '^3.0.0' },
    }));
    // Create many mutation routes without logging to trigger the >50% threshold
    for (let i = 0; i < 5; i++) {
      createFile(projectPath, `src/app/api/bookings${i}/route.ts`, `
        import { NextResponse } from 'next/server';
        export async function POST(request: Request) {
          const body = await request.json();
          // No logging here
          return NextResponse.json({ ok: true });
        }
        export async function DELETE(request: Request) {
          return NextResponse.json({ ok: true });
        }
      `);
    }

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    const auditFindings = result.findings.filter((f) => f.title.includes('mutation route'));
    expect(auditFindings.length).toBeGreaterThan(0);
    expect(auditFindings[0].severity).toBe('medium');
  });

  it('does NOT flag mutation route that has logging', async () => {
    createFile(projectPath, 'package.json', JSON.stringify({
      dependencies: { 'winston': '^3.0.0' },
    }));
    createFile(projectPath, 'src/app/api/bookings/route.ts', `
      import { logger } from '@/lib/logger';
      export async function POST(request: Request) {
        const body = await request.json();
        logger.info({ action: 'create-booking', userId: 'user-123' });
        return Response.json({ ok: true });
      }
    `);

    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    // With only 1 route and it has logging, no audit finding
    const highAuditFindings = result.findings.filter(
      (f) => f.title.includes('mutation route') && f.severity === 'medium',
    );
    expect(highAuditFindings).toHaveLength(0);
  });

  it('uses LOG- prefix for finding IDs', async () => {
    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    for (const finding of result.findings) {
      expect(finding.id).toMatch(/^LOG-\d{3}$/);
    }
  });

  it('includes duration and available fields in result', async () => {
    const result = await loggingCheckerScanner.scan(projectPath, MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
