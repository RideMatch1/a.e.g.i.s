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

  // F-DISCLAIMER-2 — authorization-form enumeration regression-guard.
  // The five canonical authorization-forms must appear in both modes when
  // --confirm is missing. If any form drops out, operators lose the
  // explicit guidance that distinguishes "I have authorization" from
  // "I might have authorization".
  it.each(['siege', 'pentest'] as const)(
    'disclaimer enumerates ROE / SOW / bug-bounty / change-management / written authorization (%s)',
    (mode) => {
      evaluateActiveModeAuthorization({
        mode,
        target: 'https://localhost:3000',
        confirm: false,
      });
      const all = stderrCapture.join('\n');
      expect(all).toMatch(/Rules of Engagement|ROE/i);
      expect(all).toMatch(/Statement of Work|SOW/i);
      expect(all).toMatch(/Bug-bounty programme/i);
      expect(all).toMatch(/change-management/i);
      expect(all).toMatch(/written authorization/i);
    },
  );

  // F-DISCLAIMER-2 — refusal-negative-list regression-guard. The five
  // refusal-clauses are the safety floor advertised to operators and
  // downstream LLM-agent integrators. Removing any silently weakens the
  // tool's posture.
  it.each(['siege', 'pentest'] as const)(
    'disclaimer states the refusal-negative-list (no destroy / no offline / no lateral / no bypass / no privesc) (%s)',
    (mode) => {
      evaluateActiveModeAuthorization({
        mode,
        target: 'https://localhost:3000',
        confirm: false,
      });
      const all = stderrCapture.join('\n');
      expect(all).toMatch(/will NOT/i);
      expect(all).toMatch(/destroy.*modify.*exfiltrate|exfiltrate target data/i);
      expect(all).toMatch(/take systems offline|disrupt production/i);
      expect(all).toMatch(/move laterally outside/i);
      expect(all).toMatch(/bypass authentication/i);
      expect(all).toMatch(/silently elevate|silent privesc|persist on the target/i);
    },
  );

  // F-DISCLAIMER-2 — third-party LLM data-flow advisory. Strix / PTAI /
  // Pentest-Swarm-AI run in BOTH pentest and siege (post v0.17.8 mode-
  // gate); the advisory must appear in both modes.
  it.each(['siege', 'pentest'] as const)(
    'disclaimer warns about third-party LLM data-flow (Strix / PTAI / Pentest-Swarm-AI) (%s)',
    (mode) => {
      evaluateActiveModeAuthorization({
        mode,
        target: 'https://localhost:3000',
        confirm: false,
      });
      const all = stderrCapture.join('\n');
      expect(all).toMatch(/LLM data-flow advisory|LLM-agent frameworks/i);
      expect(all).toMatch(/Strix/);
      expect(all).toMatch(/PTAI/);
      expect(all).toMatch(/Pentest-Swarm-AI|Pentest.Swarm/i);
      expect(all).toMatch(/transmitted to third-party LLM providers|third-party LLM/i);
      expect(all).toMatch(/local-model endpoints|redact target-identifying/i);
    },
  );

  // F-DISCLAIMER-2 — confirm-mode does NOT spam the long advisory blocks.
  // The confirmed-path is the brief acknowledgement banner; new sections
  // belong only on the unconfirmed-path. Regression-guard against the
  // copy-paste mistake of leaking advisory output past --confirm.
  it.each(['siege', 'pentest'] as const)(
    'confirm-mode banner does NOT print the new advisory blocks (%s)',
    (mode) => {
      evaluateActiveModeAuthorization({
        mode,
        target: 'https://localhost:3000',
        confirm: true,
      });
      const all = stderrCapture.join('\n');
      expect(all).not.toMatch(/Rules of Engagement|will NOT|LLM data-flow advisory/i);
    },
  );
});
