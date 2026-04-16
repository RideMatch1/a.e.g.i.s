import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCommandExists, mockExec, mockReadFileSafe } = vi.hoisted(() => ({
  mockCommandExists: vi.fn(),
  mockExec: vi.fn(),
  mockReadFileSafe: vi.fn(),
}));

vi.mock('@aegis-scan/core', () => ({
  commandExists: mockCommandExists,
  exec: mockExec,
  walkFiles: () => [],
  readFileSafe: mockReadFileSafe,
}));

import { reactDoctorScanner } from '../../src/react/react-doctor.js';
import type { AegisConfig } from '@aegis-scan/core';

const MOCK_CONFIG = {} as AegisConfig;

describe('reactDoctorScanner', () => {
  beforeEach(() => {
    mockCommandExists.mockResolvedValue(true);
    mockReadFileSafe.mockReturnValue(
      JSON.stringify({ dependencies: { react: '^19.0.0' } }),
    );
  });

  it('is available when npx exists and project has react dependency', async () => {
    expect(await reactDoctorScanner.isAvailable('/tmp/project')).toBe(true);
  });

  it('is unavailable when npx does not exist', async () => {
    mockCommandExists.mockResolvedValue(false);
    expect(await reactDoctorScanner.isAvailable('/tmp/project')).toBe(false);
  });

  it('is available as long as npx exists (React check moved to scan)', async () => {
    mockCommandExists.mockResolvedValue(true);
    mockReadFileSafe.mockReturnValue(JSON.stringify({ dependencies: { next: '^16.0.0' } }));
    // isAvailable now only checks npx, React dep check happens in scan()
    expect(await reactDoctorScanner.isAvailable('')).toBe(true);
  });

  it('returns no findings when score is 93 or above', async () => {
    mockExec.mockResolvedValue({
      stdout: 'React Doctor Analysis Complete\nScore: 96/100\nAll checks passed.',
      stderr: '',
      exitCode: 0,
    });

    const result = await reactDoctorScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('returns HIGH finding when score is between 80 and 92', async () => {
    mockExec.mockResolvedValue({
      stdout: 'Score: 85/100',
      stderr: '',
      exitCode: 0,
    });

    const result = await reactDoctorScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('high');
    expect(result.findings[0].title).toContain('85/100');
    expect(result.findings[0].id).toBe('REACT-001');
    expect(result.findings[0].category).toBe('quality');
  });

  it('returns CRITICAL finding when score is below 80', async () => {
    mockExec.mockResolvedValue({
      stdout: 'react-doctor results: 72/100',
      stderr: '',
      exitCode: 1,
    });

    const result = await reactDoctorScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].title).toContain('72/100');
  });

  it('returns INFO finding when score cannot be parsed', async () => {
    mockExec.mockResolvedValue({
      stdout: 'react-doctor: completed without score output',
      stderr: '',
      exitCode: 0,
    });

    const result = await reactDoctorScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('info');
    expect(result.findings[0].title).toContain('could not parse');
  });

  it('returns no finding at exactly score 93', async () => {
    mockExec.mockResolvedValue({
      stdout: 'Score: 93/100',
      stderr: '',
      exitCode: 0,
    });

    const result = await reactDoctorScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });

  it('returns no finding at score 100', async () => {
    mockExec.mockResolvedValue({
      stdout: '100/100',
      stderr: '',
      exitCode: 0,
    });

    const result = await reactDoctorScanner.scan('/tmp/project', MOCK_CONFIG);
    expect(result.findings).toHaveLength(0);
  });
});
