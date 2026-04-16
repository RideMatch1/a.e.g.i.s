/**
 * `aegis precision` — measure per-scanner precision against an annotated corpus.
 *
 * Two subcommands:
 *
 *   aegis precision annotate --init [--from=scan.json] --corpus=<name>
 *     Generate or refresh an annotation-template file. New findings get
 *     verdict='skip'. Existing verdicts (TP/FP) are preserved across
 *     refresh — same finding identity (scanner|file|line|title) keeps
 *     its previous verdict so re-running scan after fixes doesn't lose work.
 *
 *   aegis precision report [--corpus=<name>...]
 *     Read annotation file(s), compute precision per scanner, print
 *     a tier-aware status table. Scanners below their tier-gate fail.
 *     Unclassified scanners (external tools, probes, compliance meta-aggregators)
 *     are skipped — they have their own precision sources.
 *
 * Storage: <projectPath>/aegis-precision/<corpus>.json — project-local,
 * optionally git-committable so precision evolves with the codebase.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  loadConfig,
  Orchestrator,
  tierOf,
  gateFor,
  getVersion,
  type Finding,
  type PrecisionTier,
} from '@aegis-scan/core';
import { getAllScanners } from '@aegis-scan/scanners';

const ANNOTATIONS_DIR = 'aegis-precision';

type Verdict = 'TP' | 'FP' | 'skip';

interface Annotation {
  id: string;
  scanner: string;
  file?: string;
  line?: number;
  title: string;
  verdict: Verdict;
  /**
   * Source-context fingerprint — stable across line-number drift caused by
   * unrelated edits above the finding. Format: short hash of the normalized
   * 3-line window around the finding location. Optional for backwards-compat
   * with annotations created before this field existed.
   */
  fingerprint?: string;
}

interface AnnotationFile {
  corpus: string;
  scanRunAt: string;
  aegisVersion: string;
  annotations: Annotation[];
}

interface ScannerStats {
  scanner: string;
  tier?: PrecisionTier;
  gate?: number;
  tp: number;
  fp: number;
  skipped: number;
}

/**
 * Cheap deterministic hash. Not cryptographic — just stable + short for
 * use as a map key.
 */
function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  // Convert to unsigned 32-bit, base36 for compactness
  return (h >>> 0).toString(36);
}

/**
 * Compute a source-context fingerprint that is stable across line-number drift
 * caused by edits above the finding. Reads a 3-line window around the
 * reported line, normalizes whitespace, hashes the content.
 *
 * Falls back to a line-less identity when the file or line is missing, or
 * the file can no longer be read (deleted, moved, etc.).
 *
 * File-level findings (`fileLevel: true` on the Finding, set by scanners that
 * emit "this file lacks X" claims — auth-enforcer, header-checker,
 * crypto-auditor, rate-limit-checker, i18n-quality) skip the context hash
 * entirely. Those findings are semantically about the file as a whole;
 * hashing lines near the emission point would couple fingerprint stability
 * to unrelated edits at the top of the file. The scanner|file|title tuple
 * is the correct identity.
 */
function findingFingerprint(
  f: { scanner: string; file?: string; line?: number; title: string; fileLevel?: boolean },
  projectPath: string,
): string {
  if (!f.file) return `${f.scanner}|noFile|${f.title}`;

  // File-level findings: stable tuple, no context hash. This matches scanner
  // intent — the finding is about the file's absence/presence of a guard,
  // not a specific line. Survives arbitrary line-drift above the reported line.
  if (f.fileLevel === true) {
    return `${f.scanner}|${f.file}|file-level|${f.title}`;
  }

  // Resolve to an absolute path. If the scan emitted an absolute path we use it
  // directly (typical for in-tree scans). Otherwise resolve against projectPath.
  const fullPath = path.isAbsolute(f.file) ? f.file : path.join(projectPath, f.file);

  if (f.line === undefined) {
    return `${f.scanner}|${f.file}|noLine|${f.title}`;
  }

  let context = '';
  if (fs.existsSync(fullPath)) {
    try {
      const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
      const startIdx = Math.max(0, f.line - 2); // 1 line before (1-indexed)
      const endIdx = Math.min(lines.length, f.line + 1); // 1 line after
      context = lines.slice(startIdx, endIdx)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join('\n');
    } catch {
      // fall through with empty context
    }
  }

  // Normalize: collapse whitespace runs, trim
  const normalized = context.replace(/\s+/g, ' ').trim();
  const ctxHash = normalized.length > 0 ? shortHash(normalized) : `line${f.line}`;
  return `${f.scanner}|${f.file}|${ctxHash}|${f.title}`;
}

/**
 * Stable identity for a finding within a single annotation file.
 * Old format (no fingerprint) used `scanner|file|line|title` — that key is
 * still recognized as a fallback so v0.6f-format annotations don't lose
 * verdicts after upgrading.
 */
function legacyFindingKey(f: { scanner: string; file?: string; line?: number; title: string }): string {
  return `${f.scanner}|${f.file ?? ''}|${f.line ?? ''}|${f.title}`;
}

export interface AnnotateOptions {
  init?: boolean;
  from?: string;
  corpus?: string;
}

export async function runPrecisionAnnotate(
  projectPath: string,
  options: AnnotateOptions,
): Promise<number> {
  if (!options.init) {
    console.error(
      "error: 'aegis precision annotate' requires --init in v0.6.\n" +
        "Usage: aegis precision annotate --init [--from=scan.json] [--corpus=<name>]",
    );
    return 1;
  }

  const resolved = path.resolve(projectPath);
  const corpus = options.corpus ?? path.basename(resolved);
  const outDir = path.join(resolved, ANNOTATIONS_DIR);
  const outFile = path.join(outDir, `${corpus}.json`);

  // Load findings from --from JSON or by running a fresh scan
  let findings: Finding[];
  let scanRunAt: string;

  if (options.from) {
    if (!fs.existsSync(options.from)) {
      console.error(`error: --from file not found: ${options.from}`);
      return 1;
    }
    const raw = fs.readFileSync(options.from, 'utf-8');
    let parsed: { findings?: Finding[]; timestamp?: string } | Finding[];
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error(`error: --from file is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return 1;
    }
    if (Array.isArray(parsed)) {
      findings = parsed;
      scanRunAt = new Date().toISOString();
    } else {
      findings = parsed.findings ?? [];
      scanRunAt = parsed.timestamp ?? new Date().toISOString();
    }
  } else {
    console.log(`Running scan on ${resolved}...`);
    const config = await loadConfig(resolved, 'scan');
    const orchestrator = new Orchestrator();
    for (const s of getAllScanners()) orchestrator.register(s);
    const result = await orchestrator.run(config);
    findings = result.findings;
    scanRunAt = result.timestamp;
  }

  // Preserve existing verdicts across re-init.
  // - New-format annotations (have fingerprint): looked up by fingerprint only.
  //   This intentionally LOSES the verdict when code changes — fingerprint
  //   reflects current source context, so a different fingerprint means the
  //   underlying code is genuinely different and warrants fresh review.
  // - Legacy-format annotations (no fingerprint): looked up by legacy key.
  //   Only used as a backwards-compat path for files created before this field.
  const byFingerprint = new Map<string, Verdict>();
  const byLegacyKey = new Map<string, Verdict>();
  if (fs.existsSync(outFile)) {
    try {
      const prev: AnnotationFile = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
      for (const a of prev.annotations) {
        if (a.fingerprint) {
          byFingerprint.set(a.fingerprint, a.verdict);
        } else {
          byLegacyKey.set(legacyFindingKey(a), a.verdict);
        }
      }
    } catch {
      // Ignore corrupt file — treat as fresh
    }
  }

  let preservedTP = 0;
  let preservedFP = 0;
  const annotations: Annotation[] = findings.map((f) => {
    const fingerprint = findingFingerprint(f, resolved);
    // Prefer fingerprint match (stable across line drift). Fall back to legacy
    // key for annotations created before fingerprints existed.
    let verdict: Verdict | undefined = byFingerprint.get(fingerprint);
    if (verdict === undefined) verdict = byLegacyKey.get(legacyFindingKey(f));
    verdict ??= 'skip';

    if (verdict === 'TP') preservedTP++;
    if (verdict === 'FP') preservedFP++;
    return {
      id: f.id,
      scanner: f.scanner,
      file: f.file,
      line: f.line,
      title: f.title,
      verdict,
      fingerprint,
    };
  });

  fs.mkdirSync(outDir, { recursive: true });
  const file: AnnotationFile = {
    corpus,
    scanRunAt,
    aegisVersion: getVersion(),
    annotations,
  };
  fs.writeFileSync(outFile, JSON.stringify(file, null, 2) + '\n');

  const newSkips = annotations.length - preservedTP - preservedFP;
  console.log(`\nWrote ${annotations.length} findings to ${outFile}`);
  console.log(`  ${preservedTP} TP preserved`);
  console.log(`  ${preservedFP} FP preserved`);
  console.log(`  ${newSkips} new findings (verdict='skip')`);
  console.log("\nEdit the file and set verdict to 'TP' or 'FP' for each finding.");
  console.log("Then run: aegis precision report --corpus=" + corpus);
  return 0;
}

export interface ReportOptions {
  corpus?: string[];
}

export async function runPrecisionReport(
  projectPath: string,
  options: ReportOptions,
): Promise<number> {
  const resolved = path.resolve(projectPath);
  const annotDir = path.join(resolved, ANNOTATIONS_DIR);

  let corpora: string[];
  if (options.corpus && options.corpus.length > 0) {
    corpora = options.corpus;
  } else {
    if (!fs.existsSync(annotDir)) {
      console.error(
        `error: no annotation files found.\n` +
          `Run 'aegis precision annotate --init' first to create one.`,
      );
      return 1;
    }
    corpora = fs.readdirSync(annotDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
    if (corpora.length === 0) {
      console.error(`error: ${annotDir} is empty. Run 'aegis precision annotate --init' first.`);
      return 1;
    }
  }

  const allAnnotations: Annotation[] = [];
  const loadedCorpora: string[] = [];
  for (const corpus of corpora) {
    const file = path.join(annotDir, `${corpus}.json`);
    if (!fs.existsSync(file)) {
      console.warn(`warning: corpus '${corpus}' has no annotations file (${file})`);
      continue;
    }
    try {
      const data: AnnotationFile = JSON.parse(fs.readFileSync(file, 'utf-8'));
      allAnnotations.push(...data.annotations);
      loadedCorpora.push(corpus);
    } catch (e) {
      console.error(`error: cannot parse ${file}: ${e instanceof Error ? e.message : String(e)}`);
      return 1;
    }
  }

  if (loadedCorpora.length === 0) {
    console.error('error: no valid annotation files loaded');
    return 1;
  }

  const byScanner = new Map<string, ScannerStats>();
  for (const a of allAnnotations) {
    if (!byScanner.has(a.scanner)) {
      byScanner.set(a.scanner, {
        scanner: a.scanner,
        tier: tierOf(a.scanner),
        gate: gateFor(a.scanner),
        tp: 0,
        fp: 0,
        skipped: 0,
      });
    }
    const s = byScanner.get(a.scanner)!;
    if (a.verdict === 'TP') s.tp++;
    else if (a.verdict === 'FP') s.fp++;
    else s.skipped++;
  }

  printReport(loadedCorpora, [...byScanner.values()]);
  return 0;
}

interface ReportRow {
  scanner: string;
  tier: string;
  tpFp: string;
  skip: string;
  precision: string;
  gate: string;
  status: 'PASS' | 'FAIL' | 'QUARANTINE' | 'UNCLASSIFIED' | 'NO DATA';
}

function buildRow(s: ScannerStats): ReportRow {
  const total = s.tp + s.fp;
  const precision = total > 0 ? s.tp / total : null;
  const tier = s.tier ?? '—';
  const gate = s.gate !== undefined ? `${(s.gate * 100).toFixed(0)}%` : '—';
  const precisionStr = precision !== null ? `${(precision * 100).toFixed(0)}%` : '—';

  let status: ReportRow['status'];
  if (s.gate === undefined) {
    status = 'UNCLASSIFIED';
  } else if (precision === null) {
    status = 'NO DATA';
  } else if (precision >= s.gate) {
    status = 'PASS';
  } else if (precision < 0.6) {
    status = 'QUARANTINE';
  } else {
    status = 'FAIL';
  }

  return {
    scanner: s.scanner,
    tier,
    tpFp: `${s.tp}/${s.fp}`,
    skip: String(s.skipped),
    precision: precisionStr,
    gate,
    status,
  };
}

function printReport(corpora: string[], stats: ScannerStats[]): void {
  process.stdout.write('\nAEGIS Precision Report\n');
  process.stdout.write(`Corpus: [${corpora.join(', ')}]\n`);
  process.stdout.write('─'.repeat(78) + '\n');

  stats.sort((a, b) => a.scanner.localeCompare(b.scanner));
  const rows = stats.map(buildRow);

  const headers = {
    scanner: 'Scanner',
    tier: 'Tier',
    tpFp: 'TP/FP',
    skip: 'Skip',
    precision: 'Precision',
    gate: 'Gate',
    status: 'Status',
  };
  const allRows = [headers, ...rows];

  const widths = {
    scanner: Math.max(...allRows.map((r) => r.scanner.length)),
    tier: Math.max(...allRows.map((r) => r.tier.length)),
    tpFp: Math.max(...allRows.map((r) => r.tpFp.length)),
    skip: Math.max(...allRows.map((r) => r.skip.length)),
    precision: Math.max(...allRows.map((r) => r.precision.length)),
    gate: Math.max(...allRows.map((r) => r.gate.length)),
    status: Math.max(...allRows.map((r) => r.status.length)),
  };

  for (const row of allRows) {
    process.stdout.write(
      [
        row.scanner.padEnd(widths.scanner),
        row.tier.padEnd(widths.tier),
        row.tpFp.padEnd(widths.tpFp),
        row.skip.padEnd(widths.skip),
        row.precision.padStart(widths.precision),
        row.gate.padStart(widths.gate),
        row.status.padEnd(widths.status),
      ].join('  ') + '\n',
    );
  }

  // Summary
  const passed = rows.filter((r) => r.status === 'PASS').length;
  const failed = rows.filter((r) => r.status === 'FAIL').length;
  const quarantined = rows.filter((r) => r.status === 'QUARANTINE').length;
  const noData = rows.filter((r) => r.status === 'NO DATA').length;
  const unclassified = rows.filter((r) => r.status === 'UNCLASSIFIED').length;

  process.stdout.write('─'.repeat(78) + '\n');
  process.stdout.write(
    `${rows.length} scanners total · ${passed} PASS · ${failed} FAIL · ${quarantined} QUARANTINE · ${noData} NO DATA · ${unclassified} UNCLASSIFIED\n`,
  );
}
