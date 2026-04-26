import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

/**
 * Strix Adapter — DAST + LLM-Agent-driven Security Testing
 *
 * Strix runs multi-agent autonomous security testing combining HTTP-proxy,
 * browser-automation, terminal-shells, and Python-runtime to validate findings
 * with real proof-of-concepts (not static-only false-positives).
 *
 * Coverage: IDOR, privilege-escalation, SQLi/NoSQLi, command-injection, SSRF,
 * XXE, deserialization, XSS, prototype-pollution, race-conditions, business-
 * logic-flaws, auth-vulnerabilities, infrastructure-misconfigurations.
 *
 * Repository: https://github.com/usestrix/strix (Apache 2.0, 24.6k+ stars)
 * Install: `curl -sSL https://strix.ai/install | bash` + Docker required.
 * API key: STRIX_LLM + LLM_API_KEY env vars (OpenAI/Anthropic/Google).
 *
 * Cost-warning: Strix consumes LLM-API-tokens. Run only against owned/permitted
 * targets, in --pentest mode, and budget-cap your API key.
 */

interface StrixFinding {
  id?: string;
  severity?: string;
  title?: string;
  name?: string;
  description?: string;
  cwe?: number | string;
  cvss?: number;
  vulnerability?: string;
  evidence?: string;
}

interface StrixReport {
  findings?: StrixFinding[];
  vulnerabilities?: StrixFinding[];
  results?: StrixFinding[];
}

function mapSeverity(raw: string | undefined): Finding['severity'] {
  if (!raw) return 'info';
  switch (raw.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
    case 'mid':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'info';
  }
}

export const strixScanner: Scanner = {
  name: 'strix',
  description: 'DAST + LLM-agent autonomous security testing (Strix, Apache 2.0)',
  category: 'dast',
  isExternal: true,

  async isAvailable(_projectPath: string): Promise<boolean> {
    if (!(await commandExists('strix'))) return false;
    // Require LLM API key — strix is non-functional without one
    return Boolean(process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
  },

  async scan(_projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const target = config.target;
    if (!target) {
      return {
        scanner: 'strix',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'strix requires --target URL or directory path',
      };
    }

    // Strix supports headless mode for CI; pentest-only because it consumes LLM tokens
    if (config.mode !== 'pentest') {
      return {
        scanner: 'strix',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'strix requires --mode pentest (consumes LLM API tokens; opt-in only)',
      };
    }

    // -n = non-interactive (CI/headless), --output json
    // Default timeout 15min — strix can take 5-30min per target depending on scope
    const result = await exec(
      'strix',
      ['--target', target, '-n', '--output', 'json'],
      { timeout: 15 * 60_000 },
    );

    if (result.exitCode > 1) {
      return {
        scanner: 'strix',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `strix exited ${result.exitCode}: ${result.stderr.slice(0, 200)}`,
      };
    }

    let report: StrixReport;
    try {
      // Strix emits JSON on stdout; some lines may be progress/log noise
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          scanner: 'strix',
          category: 'dast',
          findings: [],
          duration: Date.now() - start,
          available: true,
          error: 'strix produced no JSON report',
        };
      }
      report = JSON.parse(jsonMatch[0]) as StrixReport;
    } catch (err) {
      return {
        scanner: 'strix',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `strix JSON-parse failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const items = report.findings ?? report.vulnerabilities ?? report.results ?? [];
    const findings: Finding[] = [];
    let idCounter = 1;

    for (const item of items) {
      const finding: Finding = {
        id: item.id ?? `STRIX-${String(idCounter++).padStart(3, '0')}`,
        scanner: 'strix',
        severity: mapSeverity(item.severity),
        title: item.title ?? item.name ?? item.vulnerability ?? 'Strix-detected vulnerability',
        description: item.description ?? item.evidence ?? 'See Strix report for proof-of-concept details',
        category: 'dast',
      };
      if (item.cwe) {
        const cweNum = typeof item.cwe === 'number' ? item.cwe : parseInt(String(item.cwe), 10);
        if (!isNaN(cweNum)) finding.cwe = cweNum;
      }
      findings.push(finding);
    }

    return {
      scanner: 'strix',
      category: 'dast',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
