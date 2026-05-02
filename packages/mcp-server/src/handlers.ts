import { loadConfig, Orchestrator } from '@aegis-scan/core';
import { getAllScanners } from '@aegis-scan/scanners';
import type { AuditResult, Finding, ScanCategory } from '@aegis-scan/core';
import * as path from 'node:path';
import * as os from 'node:os';
import { existsSync, realpathSync } from 'node:fs';

const SYSTEM_BLOCKED_RAW = [
  '/etc', '/private/etc',
  '/root', '/private/root',
  '/usr', '/bin', '/sbin', '/sys', '/proc',
  '/var/log', '/private/var/log',
  '/var/db', '/private/var/db',
  '/var/root', '/private/var/root',
  '/var/spool', '/private/var/spool',
  '/var/audit', '/private/var/audit',
  '/tmp', '/private/tmp',
  '/var/tmp', '/private/var/tmp',
  '/Volumes',
  'C:\\Windows', 'C:\\Program Files', 'C:\\ProgramData', 'C:\\Users\\Default',
];

const USER_SECRET_DIRS = ['.ssh', '.aws', '.gnupg', '.config', '.docker', '.kube', '.azure', '.gcloud'];

function buildCanonicalBlocklist(): string[] {
  const home = os.homedir();
  const userSecrets = USER_SECRET_DIRS.map((d) => path.join(home, d));
  const all = [...SYSTEM_BLOCKED_RAW, ...userSecrets];
  // realpath canonicalizes through symlinks so /etc and /private/etc both normalize to the same form
  return all.map((p) => {
    try { return realpathSync(p); } catch { return p; }
  });
}

const CANONICAL_BLOCKLIST = buildCanonicalBlocklist();

/** Validate that a path is safe to scan (no traversal, no system/user-secret directories, must exist) */
export function validatePath(inputPath: string): string {
  // Null-byte check first — on some OS the null byte truncates the path before downstream checks see it
  if (inputPath.includes('\0')) {
    throw new Error(`Null byte in path: ${inputPath}`);
  }
  if (inputPath.includes('..')) {
    throw new Error(`Path traversal detected: ${inputPath}`);
  }
  const resolved = path.resolve(inputPath);

  // Canonicalize via realpath when path exists — catches symlink-escape (user-link → /etc) and macOS aliasing (/etc ↔ /private/etc)
  let canonical = resolved;
  try {
    canonical = realpathSync(resolved);
  } catch {
    // path doesn't exist; existsSync below will reject
  }

  // Exact-match OR <prefix>/<sep> to avoid /etcetera-style false-positives that the previous startsWith allowed
  const isBlocked = (p: string): boolean =>
    CANONICAL_BLOCKLIST.some((b) => p === b || p.startsWith(b + path.sep));

  if (isBlocked(resolved) || isBlocked(canonical)) {
    throw new Error(`Blocked system or user-secret path: ${resolved}`);
  }

  if (!existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }

  return resolved;
}

/** Categories used for the fast "scan" mode (mirrors CLI scan.ts). */
const FAST_CATEGORIES: ScanCategory[] = [
  'security',
  'dependencies',
  'quality',
  'compliance',
  'i18n',
];

/** Compliance framework → scanner name mapping. */
const COMPLIANCE_SCANNER_MAP: Record<string, string> = {
  gdpr: 'gdpr-engine',
  soc2: 'soc2',
  iso27001: 'iso27001',
  'pci-dss': 'pci-dss',
};

/** In-memory store for the most recent scan result. */
let lastResult: AuditResult | null = null;

export function getLastResult(): AuditResult | null {
  return lastResult;
}

export function setLastResult(result: AuditResult): void {
  lastResult = result;
}

// ---------------------------------------------------------------------------
// Tool: aegis_scan
// ---------------------------------------------------------------------------

export interface ScanInput {
  path: string;
  mode?: 'scan' | 'audit';
}

export interface ScanOutput {
  score: number;
  grade: string;
  badge: string;
  confidence: string;
  blocked: boolean;
  blockerReason?: string;
  findingCount: number;
  topFindings: Array<{
    id: string;
    severity: string;
    title: string;
    file?: string;
    line?: number;
    scanner: string;
    fix?: string;
  }>;
  duration: number;
  timestamp: string;
}

const SEVERITY_ORDER: Record<string, number> = {
  blocker: 0,
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
  info: 5,
};

function sortBySeverity(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99),
  );
}

export async function handleScan(input: ScanInput): Promise<ScanOutput> {
  const resolvedPath = validatePath(input.path || process.cwd());
  const mode = input.mode ?? 'scan';

  const config = await loadConfig(resolvedPath, mode);

  const orchestrator = new Orchestrator();
  const allScanners = getAllScanners();

  if (mode === 'scan') {
    for (const scanner of allScanners.filter((s) => FAST_CATEGORIES.includes(s.category))) {
      orchestrator.register(scanner);
    }
  } else {
    for (const scanner of allScanners) {
      orchestrator.register(scanner);
    }
  }

  const result = await orchestrator.run(config);
  setLastResult(result);

  const sorted = sortBySeverity(result.findings);

  return {
    score: result.score,
    grade: result.grade,
    badge: result.badge,
    confidence: result.confidence,
    blocked: result.blocked,
    blockerReason: result.blockerReason,
    findingCount: result.findings.length,
    topFindings: sorted.slice(0, 20).map((f) => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      file: f.file ?? undefined,
      line: f.line,
      scanner: f.scanner,
      fix: typeof f.fix === 'string' ? f.fix : f.fix?.description,
    })),
    duration: result.duration,
    timestamp: result.timestamp,
  };
}

// ---------------------------------------------------------------------------
// Tool: aegis_findings
// ---------------------------------------------------------------------------

export interface FindingsInput {
  severity?: string;
  scanner?: string;
  limit?: number;
}

export interface FindingsOutput {
  findings: Finding[];
  total: number;
  filtered: number;
}

export function handleFindings(input: FindingsInput): FindingsOutput {
  const result = lastResult;
  if (!result) {
    return { findings: [], total: 0, filtered: 0 };
  }

  let findings = result.findings;
  const total = findings.length;

  if (input.severity) {
    findings = findings.filter((f) => f.severity === input.severity);
  }
  if (input.scanner) {
    findings = findings.filter((f) => f.scanner === input.scanner);
  }

  const sorted = sortBySeverity(findings);
  const limit = input.limit ?? 100;
  const limited = sorted.slice(0, limit);

  return {
    findings: limited,
    total,
    filtered: limited.length,
  };
}

// ---------------------------------------------------------------------------
// Tool: aegis_score
// ---------------------------------------------------------------------------

export interface ScoreInput {
  path: string;
}

export interface ScoreOutput {
  score: number;
  grade: string;
  badge: string;
  confidence: string;
  breakdown: Record<string, { score: number; maxScore: number; findings: number }>;
  blocked: boolean;
  blockerReason?: string;
}

export async function handleScore(input: ScoreInput): Promise<ScoreOutput> {
  const resolvedPath = validatePath(input.path || process.cwd());
  const config = await loadConfig(resolvedPath, 'scan');

  const orchestrator = new Orchestrator();
  const allScanners = getAllScanners();

  // Quick scan — fast categories only
  for (const scanner of allScanners.filter((s) => FAST_CATEGORIES.includes(s.category))) {
    orchestrator.register(scanner);
  }

  const result = await orchestrator.run(config);
  setLastResult(result);

  return {
    score: result.score,
    grade: result.grade,
    badge: result.badge,
    confidence: result.confidence,
    breakdown: result.breakdown,
    blocked: result.blocked,
    blockerReason: result.blockerReason,
  };
}

// ---------------------------------------------------------------------------
// Tool: aegis_compliance
// ---------------------------------------------------------------------------

export interface ComplianceInput {
  path: string;
  framework: 'gdpr' | 'soc2' | 'iso27001' | 'pci-dss';
}

export interface ComplianceOutput {
  framework: string;
  findings: Finding[];
  findingCount: number;
  score: number;
  grade: string;
  passed: boolean;
}

export async function handleCompliance(input: ComplianceInput): Promise<ComplianceOutput> {
  const resolvedPath = validatePath(input.path || process.cwd());
  const config = await loadConfig(resolvedPath, 'audit');

  // Inject the compliance target so scanners can use it
  config.compliance = [input.framework];

  const orchestrator = new Orchestrator();
  const allScanners = getAllScanners();

  for (const scanner of allScanners) {
    orchestrator.register(scanner);
  }

  const result = await orchestrator.run(config);
  setLastResult(result);

  // Filter to compliance-category findings + the framework-specific scanner
  const scannerName = COMPLIANCE_SCANNER_MAP[input.framework];
  const complianceFindings = result.findings.filter(
    (f) => f.category === 'compliance' || f.scanner === scannerName,
  );

  const sorted = sortBySeverity(complianceFindings);
  const categoryBreakdown = result.breakdown['compliance'];

  return {
    framework: input.framework,
    findings: sorted,
    findingCount: sorted.length,
    score: categoryBreakdown?.score ?? result.score,
    grade: result.grade,
    passed: !result.blocked && complianceFindings.filter((f) => f.severity === 'blocker' || f.severity === 'critical').length === 0,
  };
}

// ---------------------------------------------------------------------------
// Tool: aegis_fix_suggestion
// ---------------------------------------------------------------------------

export interface FixSuggestionInput {
  findingId: string;
  file?: string;
}

export interface FixSuggestionOutput {
  findingId: string;
  title: string;
  description: string;
  severity: string;
  file?: string;
  line?: number;
  fix?: string;
  owasp?: string;
  cwe?: number;
  reference?: string;
  found: boolean;
}

export function handleFixSuggestion(input: FixSuggestionInput): FixSuggestionOutput {
  const result = lastResult;

  if (!result) {
    return {
      findingId: input.findingId,
      title: '',
      description: 'No scan results available. Run aegis_scan first.',
      severity: 'info',
      found: false,
    };
  }

  // Match by ID, optionally also by file
  let finding = result.findings.find((f) => f.id === input.findingId);
  if (!finding && input.file) {
    finding = result.findings.find((f) => f.file === input.file && f.id === input.findingId);
  }

  if (!finding) {
    return {
      findingId: input.findingId,
      title: '',
      description: `Finding with ID "${input.findingId}" not found in last scan result.`,
      severity: 'info',
      found: false,
    };
  }

  return {
    findingId: finding.id,
    title: finding.title,
    description: finding.description,
    severity: finding.severity,
    file: finding.file ?? undefined,
    line: finding.line,
    fix: (typeof finding.fix === 'string' ? finding.fix : finding.fix?.description) ?? 'No automated fix suggestion available for this finding.',
    owasp: finding.owasp,
    cwe: finding.cwe,
    reference: finding.reference,
    found: true,
  };
}
