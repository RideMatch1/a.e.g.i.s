import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const { mockCommandExists, mockExec } = vi.hoisted(() => ({
  mockCommandExists: vi.fn(),
  mockExec: vi.fn(),
}));

vi.mock('@aegis-scan/core', () => ({
  commandExists: mockCommandExists,
  exec: mockExec,
  walkFiles: () => [],
  readFileSafe: () => null,
  isTestFile: (filePath) => /\.(test|spec|e2e)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /[\/\\]__tests__[\/\\]/.test(filePath) || /[\/\\]__mocks__[\/\\]/.test(filePath) || /[\/\\](playwright|cypress|e2e)[\/\\]/.test(filePath),
}));

import { hadolintScanner } from '../../src/infrastructure/hadolint.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

function makeTempProject(): string {
  return mkdtempSync(join(tmpdir(), 'aegis-hadolint-test-'));
}

describe('hadolintScanner', () => {
  let projectPath: string;

  beforeEach(() => {
    projectPath = makeTempProject();
    mockCommandExists.mockResolvedValue(true);
  });

  it('is available when hadolint command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await hadolintScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when hadolint does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await hadolintScanner.isAvailable()).toBe(false);
  });

  it('returns error when no Dockerfile in project path', async () => {
    mockExec.mockResolvedValue({ stdout: '[]', stderr: '', exitCode: 0 });
    const result = await hadolintScanner.scan(projectPath, MOCK_CONFIG);
    // projectPath is empty temp dir, no Dockerfile
    expect((result as Record<string, unknown>)['error']).toBeDefined();
    expect(result.findings).toHaveLength(0);
  });

  it('maps hadolint findings to findings with correct severity', async () => {
    writeFileSync(join(projectPath, 'Dockerfile'), 'FROM ubuntu:latest\nRUN apt-get install vim');

    mockExec.mockResolvedValue({
      stdout: JSON.stringify([
        {
          line: 1,
          code: 'DL3007',
          message: 'Using latest is best avoided if reproducibility is important',
          column: 1,
          file: join(projectPath, 'Dockerfile'),
          level: 'warning',
        },
        {
          line: 2,
          code: 'DL3008',
          message: 'Pin versions in apt get install',
          column: 1,
          file: join(projectPath, 'Dockerfile'),
          level: 'warning',
        },
      ]),
      stderr: '',
      exitCode: 1,
    });

    const result = await hadolintScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].id).toBe('HADOLINT-001');
    expect(result.findings[0].severity).toBe('medium'); // warning -> medium
    expect(result.findings[0].title).toContain('DL3007');
    expect(result.findings[0].category).toBe('infrastructure');
    expect(result.findings[0].line).toBe(1);
  });

  it('maps error-level findings to HIGH severity', async () => {
    writeFileSync(join(projectPath, 'Dockerfile'), 'FROM ubuntu');

    mockExec.mockResolvedValue({
      stdout: JSON.stringify([{
        line: 1,
        code: 'DL1000',
        message: 'Critical dockerfile error',
        column: 1,
        file: join(projectPath, 'Dockerfile'),
        level: 'error',
      }]),
      stderr: '',
      exitCode: 1,
    });

    const result = await hadolintScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings[0].severity).toBe('high');
  });

  it('handles non-JSON output gracefully', async () => {
    writeFileSync(join(projectPath, 'Dockerfile'), 'FROM ubuntu');

    mockExec.mockResolvedValue({ stdout: 'not json', stderr: '', exitCode: 2 });

    const result = await hadolintScanner.scan(projectPath, MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });
});
