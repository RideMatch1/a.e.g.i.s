import { exec, commandExists } from '@aegis-scan/core';
import type { Scanner, ScanResult, Finding, AegisConfig } from '@aegis-scan/core';

interface CheckovCheck {
  check_id: string;
  check_type: string;
  check_result: { result: 'failed' | 'passed' | 'skipped' };
  resource: string;
  file_path?: string;
  file_line_range?: [number, number];
  check_class?: string;
  // check_type is reused for IaC type; name lives in the check metadata
}

interface CheckovResult {
  check_type?: string;
  results?: {
    failed_checks?: CheckovCheck[];
    passed_checks?: CheckovCheck[];
  };
  // Checkov sometimes returns an array of result blocks (one per IaC type)
}

type CheckovOutput = CheckovResult | CheckovResult[];

function mapSeverity(checkId: string): Finding['severity'] {
  const id = checkId.toUpperCase();
  // Checkov does not embed severity in standard output — infer from known high-risk IDs
  if (
    id.includes('CKV_AWS_1') ||   // IAM root account
    id.includes('CKV_DOCKER_2') || // privileged container
    id.includes('CKV_K8S_16')      // privileged pod
  ) {
    return 'critical';
  }
  if (
    id.includes('CKV_AWS_') ||
    id.includes('CKV_GCP_') ||
    id.includes('CKV_AZURE_') ||
    id.includes('CKV_K8S_')
  ) {
    return 'high';
  }
  if (id.includes('CKV_DOCKER_') || id.includes('CKV_TF_')) {
    return 'medium';
  }
  return 'low';
}

function collectFailedChecks(output: CheckovOutput): CheckovCheck[] {
  const blocks = Array.isArray(output) ? output : [output];
  const failed: CheckovCheck[] = [];
  for (const block of blocks) {
    for (const check of block.results?.failed_checks ?? []) {
      failed.push(check);
    }
  }
  return failed;
}

export const checkovScanner: Scanner = {
  name: 'checkov',
  description: 'Infrastructure-as-Code security scanner with 1000+ policies via Checkov',
  category: 'infrastructure',

  async isAvailable(_projectPath: string): Promise<boolean> {
    return commandExists('checkov');
  },

  async scan(projectPath: string, _config: AegisConfig): Promise<ScanResult> {
    const start = Date.now();

    const result = await exec('checkov', ['-d', projectPath, '--output', 'json', '--quiet']);

    let parsed: CheckovOutput;
    try {
      // Checkov exits non-zero when findings exist; stdout contains JSON
      const raw = result.stdout.trim() || result.stderr.trim();
      parsed = JSON.parse(raw) as CheckovOutput;
    } catch {
      return {
        scanner: 'checkov',
        category: 'infrastructure',
        findings: [],
        duration: Date.now() - start,
        available: true,
        error: `Failed to parse checkov JSON output: ${(result.stdout + result.stderr).slice(0, 200)}`,
      };
    }

    const failedChecks = collectFailedChecks(parsed);
    let idCounter = 1;

    const findings: Finding[] = failedChecks.map((check) => ({
      id: `CHECKOV-${String(idCounter++).padStart(3, '0')}`,
      scanner: 'checkov',
      severity: mapSeverity(check.check_id),
      title: `${check.check_id}: ${check.resource}`,
      description: `IaC policy check ${check.check_id} failed for resource ${check.resource}${check.check_type ? ` (${check.check_type})` : ''}.`,
      file: check.file_path,
      line: check.file_line_range?.[0],
      category: 'infrastructure' as const,
    }));

    return {
      scanner: 'checkov',
      category: 'infrastructure',
      findings,
      duration: Date.now() - start,
      available: true,
    };
  },
};
