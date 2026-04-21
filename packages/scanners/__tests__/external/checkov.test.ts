import { describe, it, expect, vi } from 'vitest';

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

import { checkovScanner } from '../../src/infrastructure/checkov.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

const makeFailedCheck = (overrides: Partial<{
  check_id: string;
  check_type: string;
  resource: string;
  file_path: string;
  file_line_range: [number, number];
}> = {}) => ({
  check_id: 'CKV_AWS_18',
  check_type: 'terraform',
  check_result: { result: 'failed' as const },
  resource: 'aws_s3_bucket.example',
  file_path: '/tmp/project/main.tf',
  file_line_range: [1, 5] as [number, number],
  ...overrides,
});

describe('checkovScanner', () => {
  it('is available when checkov command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await checkovScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when checkov command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await checkovScanner.isAvailable()).toBe(false);
  });

  it('returns empty findings when no failed checks', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ results: { failed_checks: [], passed_checks: [] } }),
      stderr: '',
      exitCode: 0,
    });

    const result = await checkovScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.scanner).toBe('checkov');
    expect(result.category).toBe('infrastructure');
    expect(result.findings).toHaveLength(0);
    expect(result.available).toBe(true);
  });

  it('maps failed checks to findings with correct fields', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        results: {
          failed_checks: [
            makeFailedCheck({
              check_id: 'CKV_AWS_18',
              resource: 'aws_s3_bucket.logs',
              file_path: '/tmp/project/s3.tf',
              file_line_range: [10, 25],
            }),
            makeFailedCheck({
              check_id: 'CKV_DOCKER_2',
              resource: 'container.app',
              file_path: '/tmp/project/Dockerfile',
              file_line_range: [3, 3],
            }),
          ],
          passed_checks: [],
        },
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await checkovScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);

    const first = result.findings[0];
    expect(first.id).toBe('CHECKOV-001');
    expect(first.scanner).toBe('checkov');
    expect(first.title).toContain('CKV_AWS_18');
    expect(first.title).toContain('aws_s3_bucket.logs');
    expect(first.file).toBe('/tmp/project/s3.tf');
    expect(first.line).toBe(10);
    expect(first.category).toBe('infrastructure');

    const second = result.findings[1];
    expect(second.id).toBe('CHECKOV-002');
    expect(second.severity).toBe('critical'); // CKV_DOCKER_2 -> critical
  });

  it('handles array output format (multiple IaC types)', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify([
        {
          check_type: 'terraform',
          results: {
            failed_checks: [makeFailedCheck({ check_id: 'CKV_AWS_1' })],
            passed_checks: [],
          },
        },
        {
          check_type: 'kubernetes',
          results: {
            failed_checks: [makeFailedCheck({ check_id: 'CKV_K8S_16', resource: 'Pod/nginx' })],
            passed_checks: [],
          },
        },
      ]),
      stderr: '',
      exitCode: 1,
    });

    const result = await checkovScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].id).toBe('CHECKOV-001');
    expect(result.findings[1].id).toBe('CHECKOV-002');
  });

  it('assigns high severity to AWS check IDs', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        results: {
          failed_checks: [makeFailedCheck({ check_id: 'CKV_AWS_99', resource: 'aws_lambda.fn' })],
          passed_checks: [],
        },
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await checkovScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings[0].severity).toBe('high');
  });

  it('assigns medium severity to Docker check IDs', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        results: {
          failed_checks: [makeFailedCheck({ check_id: 'CKV_DOCKER_5', resource: 'container.x' })],
          passed_checks: [],
        },
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await checkovScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings[0].severity).toBe('medium');
  });

  it('returns error when output is not valid JSON', async () => {
    mockExec.mockResolvedValue({ stdout: 'checkov error', stderr: '', exitCode: 2 });

    const result = await checkovScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toBeDefined();
  });

  it('includes duration and available in result', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ results: { failed_checks: [] } }),
      stderr: '',
      exitCode: 0,
    });
    const result = await checkovScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
