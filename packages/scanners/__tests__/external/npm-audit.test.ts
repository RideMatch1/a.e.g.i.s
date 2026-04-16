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
}));

import { npmAuditScanner } from '../../src/dependencies/npm-audit.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('npmAuditScanner', () => {
  it('is available when npm command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await npmAuditScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when npm does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await npmAuditScanner.isAvailable()).toBe(false);
  });

  it('returns empty findings when no vulnerabilities', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }),
      stderr: '',
      exitCode: 0,
    });

    const result = await npmAuditScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('maps high/critical vulnerabilities to findings (v7 format)', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {
          lodash: {
            name: 'lodash',
            severity: 'critical',
            via: [{ title: 'Prototype Pollution', url: 'https://example.com/vuln', severity: 'critical' }],
            effects: [],
            range: '<4.17.21',
            nodes: ['node_modules/lodash'],
            fixAvailable: { name: 'lodash', version: '4.17.21' },
          },
          express: {
            name: 'express',
            severity: 'high',
            via: ['Open Redirect'],
            effects: [],
            range: '<4.19.2',
            nodes: ['node_modules/express'],
            fixAvailable: true,
          },
          moment: {
            name: 'moment',
            severity: 'moderate',
            via: ['Path Traversal'],
            effects: [],
            range: '<2.29.4',
            nodes: ['node_modules/moment'],
            fixAvailable: false,
          },
        },
      }),
      stderr: '',
      exitCode: 1,
    });

    const result = await npmAuditScanner.scan('/tmp/project', MOCK_CONFIG);
    // Only high and critical should be reported
    expect(result.findings).toHaveLength(2);

    const critical = result.findings.find((f) => f.severity === 'critical');
    expect(critical).toBeDefined();
    expect(critical!.title).toContain('lodash');
    expect(critical!.id).toBe('NPM-001');
    expect(critical!.category).toBe('dependencies');

    const high = result.findings.find((f) => f.severity === 'high');
    expect(high).toBeDefined();
    expect(high!.title).toContain('express');
  });

  it('skips moderate and low vulnerabilities', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {
          dep1: { name: 'dep1', severity: 'moderate', via: ['test'], effects: [], range: '*', nodes: [], fixAvailable: false },
          dep2: { name: 'dep2', severity: 'low', via: ['test'], effects: [], range: '*', nodes: [], fixAvailable: false },
        },
      }),
      stderr: '',
      exitCode: 0,
    });

    const result = await npmAuditScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('returns error when output is not valid JSON', async () => {
    mockExec.mockResolvedValue({ stdout: 'not json', stderr: '', exitCode: 1 });

    const result = await npmAuditScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toBeDefined();
  });
});
