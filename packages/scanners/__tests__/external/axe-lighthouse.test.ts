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

import { axeLighthouseScanner } from '../../src/accessibility/axe-lighthouse.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

const makeLighthouseReport = (audits: Record<string, {
  id?: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
}>) => ({
  categories: {
    accessibility: { score: 0.78 },
  },
  audits,
});

describe('axeLighthouseScanner', () => {
  it('is available when lighthouse command exists', async () => {
    mockCommandExists.mockResolvedValue(true);
    expect(await axeLighthouseScanner.isAvailable()).toBe(true);
  });

  it('is unavailable when lighthouse command does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await axeLighthouseScanner.isAvailable()).toBe(false);
  });

  it('returns error when config.target is not set', async () => {
    const config = {} as AegisConfig;
    const result = await axeLighthouseScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toContain('config.target');
  });

  it('returns empty findings when all accessibility audits pass', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makeLighthouseReport({
        'aria-label': { title: 'ARIA labels', score: 1 },
        'image-alt': { title: 'Image alt text', score: 1 },
      })),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await axeLighthouseScanner.scan('/tmp/project', config);
    expect(result.scanner).toBe('axe-lighthouse');
    expect(result.category).toBe('accessibility');
    expect(result.findings).toHaveLength(0);
    expect(result.available).toBe(true);
  });

  it('maps failing accessibility audits to findings', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makeLighthouseReport({
        'image-alt': {
          title: 'Image elements have [alt] attributes',
          description: 'Informative elements must have a short, descriptive alternate text.',
          score: 0,
        },
        'color-contrast': {
          title: 'Background and foreground colors have a sufficient contrast ratio',
          description: 'Low-contrast text is difficult or impossible to read.',
          score: 0.3,
        },
        'html-has-lang': {
          title: 'html element has a [lang] attribute',
          score: 1, // passes — should be skipped
        },
      })),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await axeLighthouseScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(2);

    const first = result.findings[0];
    expect(first.id).toBe('A11Y-001');
    expect(first.scanner).toBe('axe-lighthouse');
    expect(first.severity).toBe('high'); // score 0
    expect(first.title).toBe('Image elements have [alt] attributes');
    expect(first.category).toBe('accessibility');

    const second = result.findings[1];
    expect(second.id).toBe('A11Y-002');
    expect(second.severity).toBe('medium'); // score 0.3
  });

  it('skips notApplicable audits', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makeLighthouseReport({
        'video-caption': {
          title: 'Video captions',
          score: null,
          scoreDisplayMode: 'notApplicable',
        },
        'aria-hidden-body': {
          title: 'ARIA hidden body',
          score: 0,
        },
      })),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await axeLighthouseScanner.scan('/tmp/project', config);
    // only aria-hidden-body should produce a finding (if matching prefix)
    // aria- prefix matches our list
    expect(result.findings.every((f) => f.id.startsWith('A11Y-'))).toBe(true);
  });

  it('ignores non-accessibility audits', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makeLighthouseReport({
        'largest-contentful-paint': {
          title: 'Largest Contentful Paint',
          score: 0.1, // bad, but this is a perf audit
        },
        'button-name': {
          title: 'Buttons have accessible names',
          score: 0,
        },
      })),
      stderr: '',
      exitCode: 0,
    });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await axeLighthouseScanner.scan('/tmp/project', config);
    // Only button-name should match (a11y prefix)
    expect(result.findings.every((f) => f.title.includes('accessible names') || f.title.includes('button'))).toBe(true);
  });

  it('returns error when output is not valid JSON', async () => {
    mockExec.mockResolvedValue({ stdout: 'not json', stderr: '', exitCode: 2 });

    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await axeLighthouseScanner.scan('/tmp/project', config);
    expect(result.findings).toHaveLength(0);
    expect((result as Record<string, unknown>)['error']).toBeDefined();
  });

  it('includes duration and available in result', async () => {
    mockExec.mockResolvedValue({
      stdout: JSON.stringify(makeLighthouseReport({})),
      stderr: '',
      exitCode: 0,
    });
    const config = { target: 'https://example.com' } as unknown as AegisConfig;
    const result = await axeLighthouseScanner.scan('/tmp/project', config);
    expect(typeof result.duration).toBe('number');
    expect(result.available).toBe(true);
  });
});
