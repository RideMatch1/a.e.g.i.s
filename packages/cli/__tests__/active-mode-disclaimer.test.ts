import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('chalk', () => ({
  default: {
    red: Object.assign(
      (s: string) => s,
      { bold: (s: string) => s },
    ),
    yellow: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import { evaluateActiveModeAuthorization } from '../src/active-mode-disclaimer.js';

describe('evaluateActiveModeAuthorization', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stderrCapture: string[] = [];

  beforeEach(() => {
    stderrCapture = [];
    stderrSpy = vi.spyOn(console, 'error').mockImplementation((msg: unknown) => {
      stderrCapture.push(typeof msg === 'string' ? msg : String(msg));
    });
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('returns confirmed=false when --confirm is not passed (siege)', () => {
    const result = evaluateActiveModeAuthorization({
      mode: 'siege',
      target: 'https://localhost:3000',
      confirm: false,
    });
    expect(result.confirmed).toBe(false);
  });

  it('returns confirmed=true when --confirm is passed (siege)', () => {
    const result = evaluateActiveModeAuthorization({
      mode: 'siege',
      target: 'https://localhost:3000',
      confirm: true,
    });
    expect(result.confirmed).toBe(true);
  });

  it('returns confirmed=false when --confirm is not passed (pentest)', () => {
    const result = evaluateActiveModeAuthorization({
      mode: 'pentest',
      target: 'https://example.test',
      confirm: false,
    });
    expect(result.confirmed).toBe(false);
  });

  it('returns confirmed=true when --confirm is passed (pentest)', () => {
    const result = evaluateActiveModeAuthorization({
      mode: 'pentest',
      target: 'https://example.test',
      confirm: true,
    });
    expect(result.confirmed).toBe(true);
  });

  it('disclaimer mentions CFAA, StGB, and Computer Misuse Act when confirm is missing', () => {
    evaluateActiveModeAuthorization({
      mode: 'siege',
      target: 'https://localhost:3000',
      confirm: false,
    });
    const all = stderrCapture.join('\n');
    expect(all).toMatch(/CFAA/i);
    expect(all).toMatch(/StGB/i);
    expect(all).toMatch(/Computer Misuse Act/i);
  });

  it('disclaimer differentiates siege probes vs pentest DAST scanners', () => {
    evaluateActiveModeAuthorization({
      mode: 'siege',
      target: 'https://localhost:3000',
      confirm: false,
    });
    const siegeText = stderrCapture.join('\n');
    expect(siegeText).toMatch(/fake-JWT|race probes|header-tampering/i);

    stderrCapture = [];
    evaluateActiveModeAuthorization({
      mode: 'pentest',
      target: 'https://localhost:3000',
      confirm: false,
    });
    const pentestText = stderrCapture.join('\n');
    expect(pentestText).toMatch(/DAST|ZAP|Nuclei/i);
  });

  it('confirmed acknowledgement banner includes timestamp and target', () => {
    evaluateActiveModeAuthorization({
      mode: 'pentest',
      target: 'https://specific-target.example',
      confirm: true,
    });
    const all = stderrCapture.join('\n');
    expect(all).toMatch(/--confirm acknowledged/);
    expect(all).toContain('https://specific-target.example');
    // ISO 8601 timestamp pattern
    expect(all).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
