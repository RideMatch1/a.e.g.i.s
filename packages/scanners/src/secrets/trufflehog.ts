import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface TruffleHogResult {
  SourceMetadata?: {
    Data?: {
      Git?: {
        file?: string;
        line?: number;
        commit?: string;
      };
    };
  };
  DetectorName?: string;
  Verified?: boolean;
  Raw?: string;
}

export const trufflehogScanner: Scanner = {
  name: 'trufflehog',
  description: 'Secret detection via TruffleHog — scans git history for verified and unverified credentials',
  category: 'security',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('trufflehog');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    // No --only-verified: scan ALL secrets in git history (verified AND unverified)
    // Verified = still active (BLOCKER), Unverified = rotated or expired (CRITICAL)
    const result = await exec('trufflehog', [
      'git', `file://${projectPath}`,
      '--json',
    ], { timeout: 120_000 });

    const rawOutput = result.stdout || result.stderr;
    const findings: Finding[] = [];
    let idCounter = 1;

    // TruffleHog outputs one JSON object per line (JSONL)
    const lines = rawOutput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      try {
        const r = JSON.parse(line) as TruffleHogResult;

        const git = r.SourceMetadata?.Data?.Git;
        const detector = r.DetectorName ?? 'Unknown';
        const verified = r.Verified === true;

        const severity: Finding['severity'] = verified ? 'blocker' : 'critical';
        const verifiedLabel = verified ? ' (VERIFIED - ACTIVE)' : '';

        const file = git?.file;
        const fileLine = git?.line;
        const commit = git?.commit;

        const locationParts: string[] = [];
        if (file) locationParts.push(`file: ${file}`);
        if (fileLine) locationParts.push(`line: ${fileLine}`);
        if (commit) locationParts.push(`commit: ${commit.slice(0, 8)}`);
        const location = locationParts.length > 0 ? ` (${locationParts.join(', ')})` : '';

        // NEVER include the secret value (Raw) in the description
        findings.push({
          id: `TRUFFLEHOG-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'trufflehog',
          severity,
          title: `Secret detected: ${detector}${verifiedLabel}`,
          description: `${detector} credential found${location}. Remove this secret and rotate the credential immediately.`,
          file,
          line: fileLine,
          category: 'security',
          owasp: 'A07:2021',
          cwe: 798,
        });
      } catch {
        // Skip non-JSON lines
      }
    }

    return {
      scanner: 'trufflehog',
      category: 'security',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
