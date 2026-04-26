import { exec, commandExists, readFileSafe } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * PTAI (pentest-ai) Adapter — 10-Agent LLM Pentest Framework + 200+ Tool-Wrappers
 *
 * pentest-ai chains recon → classification → exploitation → reporting via 10
 * specialized LLM-agents and an MCP-server that wraps 35+ external tools (nmap,
 * masscan, nuclei, ffuf, sqlmap, gobuster, wapiti, nikto, enum4linux,
 * bloodhound-python, impacket-suite, trufflehog, gitleaks, kube-hunter, trivy,
 * etc.). Maps findings to OWASP/CWE/CVE/CVSS-v3.1.
 *
 * Coverage: SQLi, XSS, CSRF, security-headers, AD (Kerberoasting/BloodHound),
 * cloud-IAM (AWS/Azure/GCP), K8s-RBAC, exploit-chaining, OWASP LLM Top-10.
 *
 * Repository: https://github.com/0xSteph/pentest-ai (MIT, 76+ stars)
 * Install: `pip install ptai`
 * API key: ANTHROPIC_API_KEY / OPENAI_API_KEY / Ollama-local.
 *
 * Output: SARIF 2.1.0 (parsed below) + Markdown/HTML/JUnit-XML.
 * Auth-flow: form_post + session-rotation supported via --auth-flow flag.
 */

interface SarifResult {
  ruleId?: string;
  level?: 'error' | 'warning' | 'note' | 'none';
  message?: { text?: string };
  properties?: { severity?: string; cwe?: number };
}

interface SarifRun {
  results?: SarifResult[];
  tool?: { driver?: { rules?: Array<{ id?: string; shortDescription?: { text?: string } }> } };
}

interface SarifReport {
  runs?: SarifRun[];
}

function mapSarifLevel(level: string | undefined, props?: { severity?: string }): Finding['severity'] {
  // properties.severity overrides level if present (ptai standard)
  if (props?.severity) {
    switch (props.severity.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
      case 'moderate':
        return 'medium';
      case 'low':
        return 'low';
    }
  }
  switch (level) {
    case 'error':
      return 'high';
    case 'warning':
      return 'medium';
    case 'note':
      return 'low';
    default:
      return 'info';
  }
}

export const ptaiScanner: Scanner = {
  name: 'ptai',
  description: 'LLM-agent pentest with 200+ tool-wrappers + SARIF output (pentest-ai, MIT)',
  category: 'dast',
  isExternal: true,

  async isAvailable(_projectPath: string): Promise<boolean> {
    if (!(await commandExists('ptai'))) return false;
    return Boolean(
      process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.OLLAMA_HOST,
    );
  },

  async scan(_projectPath: string, config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const target = config.target;
    if (!target) {
      return {
        scanner: 'ptai',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'ptai requires --target URL',
      };
    }

    if (config.mode !== 'pentest') {
      return {
        scanner: 'ptai',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'ptai requires --mode pentest (consumes LLM API tokens; opt-in only)',
      };
    }

    const reportDir = mkdtempSync(join(tmpdir(), 'aegis-ptai-'));
    const reportPath = join(reportDir, 'report.sarif');

    const result = await exec(
      'ptai',
      ['start', target, '--non-interactive', '--output', reportPath, '--format', 'sarif'],
      { timeout: 30 * 60_000 }, // ptai can run for 15-60min; cap at 30min
    );

    if (result.exitCode > 1) {
      rmSync(reportDir, { recursive: true, force: true });
      return {
        scanner: 'ptai',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `ptai exited ${result.exitCode}: ${result.stderr.slice(0, 200)}`,
      };
    }

    const reportContent = readFileSafe(reportPath);
    rmSync(reportDir, { recursive: true, force: true });

    if (!reportContent) {
      return {
        scanner: 'ptai',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: 'ptai SARIF report not generated',
      };
    }

    let report: SarifReport;
    try {
      report = JSON.parse(reportContent) as SarifReport;
    } catch (err) {
      return {
        scanner: 'ptai',
        category: 'dast',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `ptai SARIF-parse failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const findings: Finding[] = [];
    let idCounter = 1;

    for (const run of report.runs ?? []) {
      const ruleMap = new Map<string, string>();
      for (const rule of run.tool?.driver?.rules ?? []) {
        if (rule.id) ruleMap.set(rule.id, rule.shortDescription?.text ?? rule.id);
      }
      for (const r of run.results ?? []) {
        const finding: Finding = {
          id: `PTAI-${String(idCounter++).padStart(3, '0')}`,
          scanner: 'ptai',
          severity: mapSarifLevel(r.level, r.properties),
          title: ruleMap.get(r.ruleId ?? '') ?? r.ruleId ?? 'PTAI finding',
          description: r.message?.text ?? 'See ptai SARIF report for details',
          category: 'dast',
        };
        if (r.properties?.cwe) finding.cwe = r.properties.cwe;
        findings.push(finding);
      }
    }

    return {
      scanner: 'ptai',
      category: 'dast',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
