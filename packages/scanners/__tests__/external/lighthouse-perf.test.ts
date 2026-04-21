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

import { lighthousePerformanceScanner } from '../../src/performance/lighthouse.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

const BASE_AUDITS = {
  'first-contentful-paint': { id: 'first-contentful-paint', title: 'First Contentful Paint', score: 0.9, displayValue: '0.8 s' },
  'largest-contentful-paint': { id: 'largest-contentful-paint', title: 'Largest Contentful Paint', score: 0.9, displayValue: '1.2 s' },
  'total-blocking-time': { id: 'total-blocking-time', title: 'Total Blocking Time', score: 0.9, displayValue: '50 ms' },
  'cumulative-layout-shift': { id: 'cumulative-layout-shift', title: 'Cumulative Layout Shift', score: 0.9, displayValue: '0' },
  'speed-index': { id: 'speed-index', title: 'Speed Index', score: 0.9, displayValue: '1.1 s' },
  'interactive': { id: 'interactive', title: 'Time to Interactive', score: 0.9, displayValue: '1.5 s' },
  'server-response-time': { id: 'server-response-time', title: 'Initial server response time was short', score: 1 },
} as const;

type AuditKey = keyof typeof BASE_AUDITS;

const makePerfReport = (
  perfScore: number | null,
  auditOverrides: Partial<Record<AuditKey, { score: number | null; displayValue?: string; scoreDisplayMode?: string }>> = {},
) => {
  const audits = { ...BASE_AUDITS } as Record<string, { id: string; title: string; score: number | null; displayValue?: string; scoreDisplayMode?: string }>;
  for (const [key, override] of Object.entries(auditOverrides) as [AuditKey, { score: number | null; displayValue?: string; scoreDisplayMode?: string }][]) {
    audits[key] = { ...BASE_AUDITS[key], ...override };
  }
  return {
    categories: {
      performance: { score: perfScore, title: 'Performance' },
    },
    audits,
  };
};

describe('lighthousePerformanceScanner', () => {
  it('is available when lighthouse command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await lighthousePerformanceScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when lighthouse command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await lighthousePerformanceScanner.isAvailable()).toBe(false);
  });

  it('returns error when config.target is not set', async () => {
    const config = {} as AegisConfig;
    const result = await lighthousePerformanceScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toContain('config.target');
  });

  it('returns no findings when performance score >= 0.70 and all CWV pass', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makePerfReport(0.85)),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await lighthousePerformanceScanner.scan('/tmp/project', config);
    expect(result.scanner).toBe('lighthouse-performance');
    expect(result.category).toBe('performance');
    expect(result.findings).toHaveLength(0);
    expect(result.available).toBe(true);
  });

  it('emits HIGH finding when performance score < 0.50', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makePerfReport(0.35)),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await lighthousePerformanceScanner.scan('/tmp/project', config);
    const scoreFinding = result.findings.find((f) => f.title.includes('performance score'));
    expect(scoreFinding).toBeDefined();
    expect(scoreFinding!.id).toBe('PERF-001');
    expect(scoreFinding!.severity).toBe('high');
    expect(scoreFinding!.title).toContain('35/100');
    expect(scoreFinding!.category).toBe('performance');
  });

  it('emits MEDIUM finding when performance score is between 0.50 and 0.70', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makePerfReport(0.62)),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await lighthousePerformanceScanner.scan('/tmp/project', config);
    const scoreFinding = result.findings.find((f) => f.title.includes('performance score'));
    expect(scoreFinding).toBeDefined();
    expect(scoreFinding!.severity).toBe('medium');
    expect(scoreFinding!.title).toContain('62/100');
  });

  it('emits no score finding when performance score is exactly 0.70', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makePerfReport(0.7)),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await lighthousePerformanceScanner.scan('/tmp/project', config);
    const scoreFinding = result.findings.find((f) => f.title.includes('performance score'));
    expect(scoreFinding).toBeUndefined();
  });

  it('emits CWV findings for poor individual audits', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makePerfReport(0.75, {
        'largest-contentful-paint': { score: 0.2, displayValue: '6.8 s' },
        'total-blocking-time': { score: 0.55, displayValue: '350 ms' },
      })),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await lighthousePerformanceScanner.scan('/tmp/project', config);

    const lcpFinding = result.findings.find((f) => f.title.includes('Largest Contentful Paint'));
    expect(lcpFinding).toBeDefined();
    expect(lcpFinding!.severity).toBe('high'); // score 0.2 < 0.5
    expect(lcpFinding!.description).toContain('6.8 s');
    expect(lcpFinding!.category).toBe('performance');

    const tbtFinding = result.findings.find((f) => f.title.includes('Total Blocking Time'));
    expect(tbtFinding).toBeDefined();
    expect(tbtFinding!.severity).toBe('medium'); // 0.5 <= score < 0.7
  });

  it('uses sequential PERF-NNN IDs across all findings', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makePerfReport(0.4, {
        'largest-contentful-paint': { score: 0.1, displayValue: '9 s' },
        'cumulative-layout-shift': { score: 0.3, displayValue: '0.8' },
      })),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await lighthousePerformanceScanner.scan('/tmp/project', config);

    const ids = result.findings.map((f) => f.id);
    expect(ids[0]).toBe('PERF-001');
    // all IDs should be unique and sequential
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^PERF-\d{3}$/));
  });

  it('returns error when output is not valid JSON', async () => {
    mockExec.mockResolvedValue({ stdout: 'not json', stderr: '', exitCode: 2 });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await lighthousePerformanceScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toBeDefined();
  });

  it('includes duration and available in result', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makePerfReport(0.9)),
      stderr: '',
      exitCode: 0,
    });
    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await lighthousePerformanceScanner.scan('/tmp/project', config);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
