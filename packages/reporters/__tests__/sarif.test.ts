import { describe, it, expect } from 'vitest';
import type { AuditResult } from '@aegis-scan/core';
import { sarifReporter } from '../src/sarif.js';

interface SarifDocument {
  $schema: string;
  version: string;
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        rules: Array<{ id: string; name: string; shortDescription: { text: string } }>;
      };
    };
    results: Array<{
      ruleId: string;
      level: string;
      message: { text: string };
      locations?: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region?: { startLine: number };
        };
        message?: { text: string };
      }>;
      relatedLocations?: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region?: { startLine: number };
        };
        message?: { text: string };
      }>;
    }>;
  }>;
}

function makeResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    score: 65,
    grade: 'C',
    badge: 'FAIR',
    blocked: false,
    confidence: 'high',
    breakdown: {},
    findings: [],
    scanResults: [],
    stack: { framework: 'Rails', database: 'PostgreSQL', language: 'Ruby' },
    duration: 500,
    timestamp: '2025-09-01T08:00:00.000Z',
    ...overrides,
  } as AuditResult;
}

function parseSarif(result: AuditResult): SarifDocument {
  return JSON.parse(sarifReporter.format(result)) as SarifDocument;
}

describe('sarifReporter', () => {
  it('has the correct name', () => {
    expect(sarifReporter.name).toBe('sarif');
  });

  it('produces valid JSON', () => {
    const output = sarifReporter.format(makeResult());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('outputs SARIF version 2.1.0', () => {
    const sarif = parseSarif(makeResult());
    expect(sarif.version).toBe('2.1.0');
  });

  it('includes the correct $schema URL', () => {
    const sarif = parseSarif(makeResult());
    expect(sarif.$schema).toContain('sarif-schema-2.1.0.json');
  });

  it('has tool name AEGIS', () => {
    const sarif = parseSarif(makeResult());
    expect(sarif.runs[0].tool.driver.name).toBe('AEGIS');
  });

  it('has tool version matching package.json', () => {
    const sarif = parseSarif(makeResult());
    // Don't hardcode the version — read it from the CLI package so this test
    // doesn't drift on each release bump.
    expect(sarif.runs[0].tool.driver.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('maps blocker severity to error level', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-BLOCKER',
          scanner: 'core',
          category: 'Auth',
          severity: 'blocker',
          title: 'Auth bypass',
          description: 'Authentication can be bypassed entirely',
        },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].results[0].level).toBe('error');
  });

  it('maps critical severity to error level', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-CRIT',
          scanner: 'injection',
          category: 'Injection',
          severity: 'critical',
          title: 'RCE via deserialization',
          description: 'Remote code execution possible',
        },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].results[0].level).toBe('error');
  });

  it('maps high severity to error level', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-HIGH',
          scanner: 'xss',
          category: 'XSS',
          severity: 'high',
          title: 'Stored XSS',
          description: 'User input rendered without escaping',
        },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].results[0].level).toBe('error');
  });

  it('maps medium severity to warning level', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-MED',
          scanner: 'headers',
          category: 'Headers',
          severity: 'medium',
          title: 'Missing CSP header',
          description: 'No Content-Security-Policy header set',
        },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].results[0].level).toBe('warning');
  });

  it('maps low severity to note level', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-LOW',
          scanner: 'info-disclosure',
          category: 'Info',
          severity: 'low',
          title: 'Server version disclosure',
          description: 'Server header reveals version',
        },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].results[0].level).toBe('note');
  });

  it('maps info severity to note level', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-INFO',
          scanner: 'deps',
          category: 'Dependencies',
          severity: 'info',
          title: 'Outdated dependency',
          description: 'Library has newer version available',
        },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].results[0].level).toBe('note');
  });

  it('includes file location when finding has file', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-FILE',
          scanner: 'static',
          category: 'Auth',
          severity: 'high',
          title: 'Hardcoded secret',
          description: 'API key hardcoded in source',
          file: 'src/config/secrets.ts',
          line: 7,
        },
      ],
    });
    const sarif = parseSarif(result);
    const loc = sarif.runs[0].results[0].locations?.[0];
    expect(loc?.physicalLocation.artifactLocation.uri).toBe('src/config/secrets.ts');
    expect(loc?.physicalLocation.region?.startLine).toBe(7);
  });

  it('omits locations when finding has no file', () => {
    const result = makeResult({
      findings: [
        {
          id: 'SEC-NOFILE',
          scanner: 'config',
          category: 'Config',
          severity: 'medium',
          title: 'Weak TLS config',
          description: 'TLS 1.0 still supported',
        },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].results[0].locations).toBeUndefined();
  });

  it('sets ruleId from finding id', () => {
    const result = makeResult({
      findings: [
        {
          id: 'AEGIS-AUTH-001',
          scanner: 'auth',
          category: 'Authentication',
          severity: 'high',
          title: 'Missing MFA',
          description: 'No multi-factor authentication',
        },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].results[0].ruleId).toBe('AEGIS-AUTH-001');
  });

  it('produces one rules entry per unique finding id', () => {
    const result = makeResult({
      findings: [
        {
          id: 'RULE-A',
          scanner: 's1',
          category: 'C1',
          severity: 'high',
          title: 'Finding A1',
          description: 'First instance of rule A',
        },
        {
          id: 'RULE-A',
          scanner: 's1',
          category: 'C1',
          severity: 'high',
          title: 'Finding A2',
          description: 'Second instance of rule A',
        },
        {
          id: 'RULE-B',
          scanner: 's2',
          category: 'C2',
          severity: 'medium',
          title: 'Finding B',
          description: 'Rule B',
        },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(2);
    expect(sarif.runs[0].results).toHaveLength(3);
  });

  it('returns a string', () => {
    expect(typeof sarifReporter.format(makeResult())).toBe('string');
  });
});

/**
 * SARIF 2.1.0 conformance tests — protects GitHub Code Scanning upload.
 *
 * These invariants are what the GitHub SARIF importer actually validates:
 *   - version exactly "2.1.0"
 *   - each result.level is one of the SARIF enum values
 *   - each result.ruleId appears in runs[].tool.driver.rules[]
 *   - message.text is non-empty
 *
 * Custom Rules (Phase 1b) produce findings with arbitrary user-provided IDs,
 * severities, and categories — these tests use such hand-crafted inputs to
 * guard against future changes that might produce non-conforming output.
 */
describe('sarifReporter — SARIF 2.1.0 conformance', () => {
  const SARIF_LEVELS = new Set(['none', 'note', 'warning', 'error']);
  const SARIF_SEVERITIES: Array<AuditResult['findings'][number]['severity']> = [
    'blocker', 'critical', 'high', 'medium', 'low', 'info',
  ];

  it('all level values are in the SARIF enum, for every supported severity', () => {
    for (const sev of SARIF_SEVERITIES) {
      const result = makeResult({
        findings: [
          { id: `SEV-${sev}`, scanner: 's', category: 'security', severity: sev, title: 't', description: 'd' },
        ],
      });
      const sarif = parseSarif(result);
      const level = sarif.runs[0].results[0].level;
      expect(SARIF_LEVELS.has(level)).toBe(true);
    }
  });

  it('every result.ruleId appears in tool.driver.rules (referential integrity)', () => {
    // Simulate Custom Rules producing findings with various IDs
    const result = makeResult({
      findings: [
        { id: 'CUSTOM-SQLI-01', scanner: 'taint-analyzer', category: 'security', severity: 'critical', title: 'Custom SQL sink flagged', description: 'x' },
        { id: 'CUSTOM-SQLI-01', scanner: 'taint-analyzer', category: 'security', severity: 'critical', title: 'Custom SQL sink flagged', description: 'x' }, // dup — same rule
        { id: 'CUSTOM-XSS-99', scanner: 'taint-analyzer', category: 'security', severity: 'high', title: 'Custom XSS sink flagged', description: 'y' },
        { id: 'TAINT-042', scanner: 'taint-analyzer', category: 'security', severity: 'high', title: 'Generic flow', description: 'z' },
      ],
    });
    const sarif = parseSarif(result);

    const ruleIds = new Set(sarif.runs[0].tool.driver.rules.map((r) => r.id));
    for (const r of sarif.runs[0].results) {
      expect(ruleIds.has(r.ruleId)).toBe(true);
    }
    // Unique rules
    expect(sarif.runs[0].tool.driver.rules.length).toBe(ruleIds.size);
  });

  it('message.text is non-empty for every result', () => {
    const result = makeResult({
      findings: [
        // Finding with description
        { id: 'F1', scanner: 's', category: 'security', severity: 'high', title: 'has desc', description: 'present' },
        // Finding without description — should still produce non-empty text from title
        { id: 'F2', scanner: 's', category: 'security', severity: 'high', title: 'no desc' },
      ],
    });
    const sarif = parseSarif(result);
    for (const r of sarif.runs[0].results) {
      expect(typeof r.message.text).toBe('string');
      expect(r.message.text.length).toBeGreaterThan(0);
    }
  });

  it('tool.driver.name is a non-empty string (GitHub-required)', () => {
    const sarif = parseSarif(makeResult());
    expect(typeof sarif.runs[0].tool.driver.name).toBe('string');
    expect(sarif.runs[0].tool.driver.name.length).toBeGreaterThan(0);
  });

  it('tool.driver.version is a non-empty string', () => {
    const sarif = parseSarif(makeResult());
    expect(typeof sarif.runs[0].tool.driver.version).toBe('string');
    expect(sarif.runs[0].tool.driver.version.length).toBeGreaterThan(0);
  });

  it('artifactLocation.uri is always a non-empty relative path when present', () => {
    const result = makeResult({
      findings: [
        { id: 'F1', scanner: 's', category: 'security', severity: 'high', title: 't1', description: 'd', file: '/tmp/fixture/src/app.ts', line: 10 },
        { id: 'F2', scanner: 's', category: 'security', severity: 'high', title: 't2', description: 'd', file: '/tmp/fixture/lib/util.ts', line: 5 },
      ],
    });
    const sarif = parseSarif(result);
    for (const r of sarif.runs[0].results) {
      const uri = r.locations?.[0]?.physicalLocation.artifactLocation.uri;
      expect(typeof uri).toBe('string');
      expect(uri!.length).toBeGreaterThan(0);
      // Common prefix stripped → relative path
      expect(uri!.startsWith('/')).toBe(false);
    }
  });

  it('produces valid JSON even with empty findings array', () => {
    const sarif = parseSarif(makeResult({ findings: [] }));
    expect(sarif.runs[0].results).toEqual([]);
    expect(sarif.runs[0].tool.driver.rules).toEqual([]);
  });

  it('Custom-Rules scenario: arbitrary rule id + long category + unicode description', () => {
    // Simulate a Custom Rule producing a realistic extreme finding
    const result = makeResult({
      findings: [
        {
          id: 'CUSTOM-MY_COMPANY.INTERNAL_SCANNER-001',
          scanner: 'taint-analyzer',
          category: 'security',
          severity: 'critical',
          title: 'Very-long-title with emoji 🛡️ and — em-dashes',
          description: 'Finding description with "quotes" and \\backslashes\\ and \n newlines\n — all must be JSON-safe.',
          file: 'src/lib/Überweisung/Zähler.ts',
          line: 42,
          cwe: 999999,
        },
      ],
    });
    const output = sarifReporter.format(result);
    // Must parse as valid JSON (tests escaping)
    const sarif: SarifDocument = JSON.parse(output);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results[0].ruleId).toBe('CUSTOM-MY_COMPANY.INTERNAL_SCANNER-001');
    // Unicode file path preserved
    expect(sarif.runs[0].results[0].locations?.[0].physicalLocation.artifactLocation.uri).toContain('Überweisung');
  });

  it('no duplicate rule ids in tool.driver.rules', () => {
    const result = makeResult({
      findings: [
        { id: 'X', scanner: 's', category: 'security', severity: 'high', title: 't', description: 'd' },
        { id: 'X', scanner: 's', category: 'security', severity: 'high', title: 't', description: 'd' },
        { id: 'X', scanner: 's', category: 'security', severity: 'high', title: 't', description: 'd' },
      ],
    });
    const sarif = parseSarif(result);
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(1);
  });

  // ── v0.7 Phase 2: cross-file finding SARIF round-trip ──────────────────
  // Plan-doc §7 D4 compliance: cross-file findings emit relatedLocations
  // pointing at the origin file. Non-cross-file findings MUST NOT emit
  // spurious relatedLocations (negative regression guard).

  it('emits relatedLocations for cross-file findings (v0.7)', () => {
    const result = makeResult({
      findings: [
        {
          id: 'TAINT-001',
          scanner: 'taint-analyzer',
          category: 'security',
          severity: 'high',
          title: 'Cross-file SSRF',
          description: 'Tainted input flows through imported wrapper to fetch()',
          file: '/repo/src/api/route.ts',
          line: 12,
          crossFile: true,
          crossFileOrigin: '/repo/src/lib/http.ts',
        },
      ],
    });
    const sarif = parseSarif(result);
    const [res] = sarif.runs[0].results;
    // Primary location is the caller-side finding site.
    expect(res.locations?.[0].physicalLocation.artifactLocation.uri).toContain('api/route.ts');
    expect(res.locations?.[0].physicalLocation.region?.startLine).toBe(12);
    // Related location points at the cross-module origin.
    expect(res.relatedLocations).toBeDefined();
    expect(res.relatedLocations).toHaveLength(1);
    expect(res.relatedLocations?.[0].physicalLocation.artifactLocation.uri).toContain('lib/http.ts');
    expect(res.relatedLocations?.[0].message?.text).toContain('Cross-module origin');
  });

  it('does NOT emit relatedLocations for non-cross-file findings (regression guard)', () => {
    // Same-file finding — must not get a spurious relatedLocations that
    // would confuse GitHub Code Scanning and Azure DevOps into showing
    // a phantom second location.
    const result = makeResult({
      findings: [
        {
          id: 'TAINT-002',
          scanner: 'taint-analyzer',
          category: 'security',
          severity: 'high',
          title: 'SQL Injection',
          description: 'Tainted input flows to db.query()',
          file: '/repo/src/api/route.ts',
          line: 8,
          // NOT cross-file — no crossFile or crossFileOrigin
        },
      ],
    });
    const sarif = parseSarif(result);
    const [res] = sarif.runs[0].results;
    expect(res.locations).toBeDefined();
    // The critical assertion: relatedLocations MUST be absent (undefined)
    // for non-cross-file findings.
    expect(res.relatedLocations).toBeUndefined();
  });
});
