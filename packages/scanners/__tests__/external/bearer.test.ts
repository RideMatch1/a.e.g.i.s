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

import { bearerScanner } from '../../src/sast/bearer.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('bearerScanner', () => {
  it('is available when bearer command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await bearerScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when bearer command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await bearerScanner.isAvailable()).toBe(false);
  });

  it('returns empty findings when no risks', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ risks: [] }),
      stderr: '',
      exitCode: 0,
    });

    const result = await bearerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.scanner).toBe('bearer');
    expect(result.category).toBe('compliance');
    expect(result.findings).toHaveLength(0);
    expect(result.available).toBe(true);
  });

  it('maps bearer risks array to findings with correct fields', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        risks: [
          {
            id: 'ruby_rails_insecure_communication',
            title: 'Insecure communication channel',
            description: 'PII sent over unencrypted channel',
            severity: 'high',
            filename: '/tmp/project/app/controllers/users_controller.rb',
            line_number: 42,
            data_types: ['Email Address'],
          },
          {
            id: 'javascript_third_parties_facebook_pixel',
            title: 'Facebook Pixel detected',
            description: 'User data may be shared with Facebook',
            severity: 'medium',
          },
        ],
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await bearerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);

    const first = result.findings[0];
    expect(first.id).toBe('BEARER-001');
    expect(first.scanner).toBe('bearer');
    expect(first.severity).toBe('high');
    expect(first.title).toBe('Insecure communication channel');
    expect(first.description).toContain('PII');
    expect(first.file).toBe('/tmp/project/app/controllers/users_controller.rb');
    expect(first.line).toBe(42);
    expect(first.category).toBe('compliance');

    const second = result.findings[1];
    expect(second.id).toBe('BEARER-002');
    expect(second.severity).toBe('medium');
    expect(second.file).toBeUndefined();
  });

  it('handles Bearer severity-bucketed output format', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        critical: [
          {
            id: 'leak-credit-card',
            title: 'Credit card leak',
            description: 'Card number in logs',
            severity: 'critical',
            filename: '/tmp/project/src/billing.ts',
            line_number: 7,
          },
        ],
        low: [
          {
            id: 'debug-logging',
            title: 'Debug logging',
            description: 'Verbose logging in prod',
            filename: '/tmp/project/src/logger.ts',
            line_number: 15,
          },
        ],
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await bearerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(2);

    const crit = result.findings.find((f) => f.id === 'BEARER-001');
    expect(crit).toBeDefined();
    expect(crit!.severity).toBe('critical');

    const low = result.findings.find((f) => f.id === 'BEARER-002');
    expect(low).toBeDefined();
    expect(low!.severity).toBe('low');
  });

  it('returns error when output is not valid JSON', async () => {
    mockExec.mockResolvedValue({ stdout: 'not json', stderr: '', exitCode: 2 });

    const result = await bearerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toBeDefined();
  });

  it('reads JSON from stderr when stdout is empty', async () => {
    mockExec.mockResolvedValue({
      stdout: '',
      stderr: JSON.stringify({ risks: [
        { id: 'test-id', title: 'Test finding', severity: 'low' },
      ]}),
      exitCode: 0,
    });

    const result = await bearerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('low');
  });

  it('maps warning severity to info', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        risks: [{ id: 'some-warning', title: 'Warning finding', severity: 'warning' }],
      }),
      stderr: '',
      exitCode: 0,
    });

    const result = await bearerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings[0].severity).toBe('info');
  });

  it('includes duration and available in result', async () => {
    mockExec.mockResolvedValue({ stdout: JSON.stringify({ risks: [] }), stderr: '', exitCode: 0 });
    const result = await bearerScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
