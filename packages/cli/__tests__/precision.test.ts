import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runPrecisionAnnotate, runPrecisionReport } from '../src/commands/precision.js';

let tmpProj: string;
let stdoutCapture: string[] = [];
let stderrCapture: string[] = [];
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpProj = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-prec-'));
  stdoutCapture = [];
  stderrCapture = [];
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stdoutCapture.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
    return true;
  });
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    stderrCapture.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
    return true;
  });
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdoutCapture.push(args.map(String).join(' ') + '\n');
  });
  consoleErrSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    stderrCapture.push(args.map(String).join(' ') + '\n');
  });
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    stderrCapture.push(args.map(String).join(' ') + '\n');
  });
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  consoleLogSpy.mockRestore();
  consoleErrSpy.mockRestore();
  consoleWarnSpy.mockRestore();
  fs.rmSync(tmpProj, { recursive: true, force: true });
});

function writeScanJson(findings: Array<Record<string, unknown>>): string {
  const file = path.join(tmpProj, 'scan.json');
  fs.writeFileSync(file, JSON.stringify({
    findings,
    timestamp: '2026-04-16T12:00:00.000Z',
  }));
  return file;
}

function readAnnotations(corpus = path.basename(tmpProj)): Annotation[] {
  const file = path.join(tmpProj, 'aegis-precision', `${corpus}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf-8')).annotations;
}

interface Annotation {
  id: string;
  scanner: string;
  file?: string;
  line?: number;
  title: string;
  verdict: 'TP' | 'FP' | 'skip';
}

const stdoutText = (): string => stdoutCapture.join('');
const stderrText = (): string => stderrCapture.join('');

describe('runPrecisionAnnotate — --init from existing scan', () => {
  it('writes template with all verdicts as skip', async () => {
    const scanFile = writeScanJson([
      { id: 'F1', scanner: 'taint-analyzer', file: 'a.ts', line: 1, title: 'T1', severity: 'high' },
      { id: 'F2', scanner: 'auth-enforcer', file: 'b.ts', line: 5, title: 'T2', severity: 'low' },
    ]);
    const exit = await runPrecisionAnnotate(tmpProj, { init: true, from: scanFile });
    expect(exit).toBe(0);
    const annotations = readAnnotations();
    expect(annotations).toHaveLength(2);
    expect(annotations.every((a) => a.verdict === 'skip')).toBe(true);
  });

  it('preserves existing TP/FP verdicts on re-init', async () => {
    const scanFile = writeScanJson([
      { id: 'F1', scanner: 'taint-analyzer', file: 'a.ts', line: 1, title: 'T1', severity: 'high' },
      { id: 'F2', scanner: 'auth-enforcer', file: 'b.ts', line: 5, title: 'T2', severity: 'low' },
    ]);
    await runPrecisionAnnotate(tmpProj, { init: true, from: scanFile });
    // User edits the file
    const corpusName = path.basename(tmpProj);
    const annotFile = path.join(tmpProj, 'aegis-precision', `${corpusName}.json`);
    const data = JSON.parse(fs.readFileSync(annotFile, 'utf-8'));
    data.annotations[0].verdict = 'TP';
    data.annotations[1].verdict = 'FP';
    fs.writeFileSync(annotFile, JSON.stringify(data));
    // Re-init with same scan
    await runPrecisionAnnotate(tmpProj, { init: true, from: scanFile });
    const annotations = readAnnotations();
    expect(annotations[0].verdict).toBe('TP');
    expect(annotations[1].verdict).toBe('FP');
  });

  it('preserves verdicts even when finding ID changes (matches by content)', async () => {
    const scan1 = writeScanJson([
      { id: 'F1', scanner: 'taint-analyzer', file: 'a.ts', line: 1, title: 'T1' },
    ]);
    await runPrecisionAnnotate(tmpProj, { init: true, from: scan1 });
    const corpusName = path.basename(tmpProj);
    const annotFile = path.join(tmpProj, 'aegis-precision', `${corpusName}.json`);
    const data = JSON.parse(fs.readFileSync(annotFile, 'utf-8'));
    data.annotations[0].verdict = 'TP';
    fs.writeFileSync(annotFile, JSON.stringify(data));
    // Same finding but different ID (e.g. id-counter reset)
    const scan2 = writeScanJson([
      { id: 'TAINT-999', scanner: 'taint-analyzer', file: 'a.ts', line: 1, title: 'T1' },
    ]);
    await runPrecisionAnnotate(tmpProj, { init: true, from: scan2 });
    const annotations = readAnnotations();
    expect(annotations[0].verdict).toBe('TP');
  });

  it('refuses without --init flag', async () => {
    const exit = await runPrecisionAnnotate(tmpProj, {});
    expect(exit).toBe(1);
    expect(stderrText()).toContain('--init');
  });

  it('errors when --from file does not exist', async () => {
    const exit = await runPrecisionAnnotate(tmpProj, {
      init: true,
      from: '/nonexistent/scan.json',
    });
    expect(exit).toBe(1);
    expect(stderrText()).toMatch(/not found|ENOENT/);
  });

  it('uses custom corpus name when provided', async () => {
    const scanFile = writeScanJson([
      { id: 'F1', scanner: 'auth-enforcer', file: 'a.ts', line: 1, title: 'T' },
    ]);
    await runPrecisionAnnotate(tmpProj, { init: true, from: scanFile, corpus: 'my-corpus' });
    expect(fs.existsSync(path.join(tmpProj, 'aegis-precision', 'my-corpus.json'))).toBe(true);
  });

  it('accepts a bare findings array (not wrapped in {findings})', async () => {
    const file = path.join(tmpProj, 'bare.json');
    fs.writeFileSync(file, JSON.stringify([
      { id: 'F1', scanner: 'taint-analyzer', file: 'a.ts', line: 1, title: 'T' },
    ]));
    const exit = await runPrecisionAnnotate(tmpProj, { init: true, from: file });
    expect(exit).toBe(0);
    expect(readAnnotations()).toHaveLength(1);
  });
});

describe('runPrecisionAnnotate — source-context fingerprint stability', () => {
  // The validator-flagged risk: line in the identity-hash means inserting
  // unrelated lines above a finding loses its annotation. These tests prove
  // the fingerprint is stable across that exact scenario.

  function setupFile(rel: string, content: string): string {
    const full = path.join(tmpProj, rel);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content);
    return full;
  }

  it('preserves TP verdict after inserting blank lines ABOVE the finding', async () => {
    // Initial file: vulnerable code at line 3
    const filePath = setupFile('src/route.ts', [
      "import { exec } from 'child_process';",
      'export async function POST(req) {',
      '  exec(req.body.cmd);', // line 3 — the finding
      '}',
    ].join('\n'));

    const scan1 = path.join(tmpProj, 'scan1.json');
    fs.writeFileSync(scan1, JSON.stringify({
      findings: [
        {
          id: 'TAINT-001',
          scanner: 'taint-analyzer',
          file: filePath,
          line: 3,
          title: 'Command Injection — req.body.cmd flows to exec()',
        },
      ],
    }));

    // First annotate + mark TP
    await runPrecisionAnnotate(tmpProj, { init: true, from: scan1, corpus: 'drift' });
    const annotFile = path.join(tmpProj, 'aegis-precision', 'drift.json');
    const data = JSON.parse(fs.readFileSync(annotFile, 'utf-8'));
    data.annotations[0].verdict = 'TP';
    fs.writeFileSync(annotFile, JSON.stringify(data));

    // INSERT 3 blank lines at the top — finding now at line 6
    const newContent = '\n\n\n' + fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(filePath, newContent);

    // Re-scan reports finding at line 6 (same code, different line)
    const scan2 = path.join(tmpProj, 'scan2.json');
    fs.writeFileSync(scan2, JSON.stringify({
      findings: [
        {
          id: 'TAINT-042', // ID drifted too
          scanner: 'taint-analyzer',
          file: filePath,
          line: 6, // line drifted by +3
          title: 'Command Injection — req.body.cmd flows to exec()',
        },
      ],
    }));

    await runPrecisionAnnotate(tmpProj, { init: true, from: scan2, corpus: 'drift' });
    const newAnnotations = JSON.parse(fs.readFileSync(annotFile, 'utf-8')).annotations;
    expect(newAnnotations).toHaveLength(1);
    // The verdict MUST survive line-number drift
    expect(newAnnotations[0].verdict).toBe('TP');
    expect(newAnnotations[0].line).toBe(6); // line is updated to current
  });

  it('does NOT preserve verdict when the finding code itself changes', async () => {
    // If the user actually edits the vulnerable line, the fingerprint changes
    // — that's correct behavior, the new code may need fresh review.
    const filePath = setupFile('src/route.ts', [
      'export async function POST(req) {',
      '  exec(req.body.cmd);',
      '}',
    ].join('\n'));

    const scan1 = path.join(tmpProj, 'scan1.json');
    fs.writeFileSync(scan1, JSON.stringify({
      findings: [
        { id: 'F', scanner: 'taint-analyzer', file: filePath, line: 2, title: 'CmdInj' },
      ],
    }));
    await runPrecisionAnnotate(tmpProj, { init: true, from: scan1, corpus: 'edit' });
    const annotFile = path.join(tmpProj, 'aegis-precision', 'edit.json');
    const data = JSON.parse(fs.readFileSync(annotFile, 'utf-8'));
    data.annotations[0].verdict = 'TP';
    fs.writeFileSync(annotFile, JSON.stringify(data));

    // Edit the vulnerable line — wrap in DOMPurify, fundamentally different code
    fs.writeFileSync(filePath, [
      'export async function POST(req) {',
      '  exec(DOMPurify.sanitize(req.body.cmd));', // changed!
      '}',
    ].join('\n'));

    const scan2 = path.join(tmpProj, 'scan2.json');
    fs.writeFileSync(scan2, JSON.stringify({
      findings: [
        { id: 'F', scanner: 'taint-analyzer', file: filePath, line: 2, title: 'CmdInj' },
      ],
    }));
    await runPrecisionAnnotate(tmpProj, { init: true, from: scan2, corpus: 'edit' });
    const newAnnot = JSON.parse(fs.readFileSync(annotFile, 'utf-8')).annotations[0];
    // The code changed → fingerprint differs → verdict resets to skip for review
    expect(newAnnot.verdict).toBe('skip');
  });

  it('preserves verdicts from legacy annotations without fingerprint field (backwards-compat)', async () => {
    // Simulate v0.6f-format annotation (line-based key, no fingerprint)
    const filePath = setupFile('src/x.ts', 'const x = 1;\nexec(x);\n');

    const annotFile = path.join(tmpProj, 'aegis-precision', 'legacy.json');
    fs.mkdirSync(path.dirname(annotFile), { recursive: true });
    fs.writeFileSync(annotFile, JSON.stringify({
      corpus: 'legacy',
      scanRunAt: '2026-04-15T00:00:00Z',
      aegisVersion: '0.5.0',
      annotations: [
        {
          id: 'F', scanner: 'taint-analyzer', file: filePath, line: 2,
          title: 'CmdInj', verdict: 'TP',
          // no `fingerprint` field — old format
        },
      ],
    }));

    // Re-init with same code (no drift, no edits)
    const scan = path.join(tmpProj, 'scan.json');
    fs.writeFileSync(scan, JSON.stringify({
      findings: [
        { id: 'NEW-ID', scanner: 'taint-analyzer', file: filePath, line: 2, title: 'CmdInj' },
      ],
    }));
    await runPrecisionAnnotate(tmpProj, { init: true, from: scan, corpus: 'legacy' });
    const newAnnotations = JSON.parse(fs.readFileSync(annotFile, 'utf-8')).annotations;
    expect(newAnnotations[0].verdict).toBe('TP'); // legacy key fallback worked
    expect(newAnnotations[0].fingerprint).toBeDefined(); // upgraded to new format
  });

  it('falls back gracefully when the source file no longer exists', async () => {
    // File deleted between scans — fingerprint can't read context
    const scan1 = path.join(tmpProj, 'scan1.json');
    fs.writeFileSync(scan1, JSON.stringify({
      findings: [
        { id: 'F', scanner: 'taint-analyzer', file: '/now/deleted/file.ts', line: 5, title: 'T' },
      ],
    }));
    const exit = await runPrecisionAnnotate(tmpProj, { init: true, from: scan1, corpus: 'gone' });
    expect(exit).toBe(0); // doesn't crash
    const annotations = readAnnotations('gone');
    expect(annotations[0].fingerprint).toBeDefined(); // some fingerprint produced
  });
});

describe('runPrecisionAnnotate — file-level fingerprint (v0.6.1 Bug 2 fix)', () => {
  function setupFile(rel: string, content: string): string {
    const full = path.join(tmpProj, rel);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(full, content);
    return full;
  }

  it('preserves TP verdict on file-level finding after lines inserted above (the Bug 2 regression scenario)', async () => {
    // Setup: auth-enforcer-style file-level finding at line=1
    const filePath = setupFile('src/api/admin/route.ts', [
      "export async function POST(req) {",
      "  return Response.json({ ok: true });",
      "}",
    ].join('\n'));

    const scan1 = path.join(tmpProj, 'scan1.json');
    fs.writeFileSync(scan1, JSON.stringify({
      findings: [
        {
          id: 'AUTH-001',
          scanner: 'auth-enforcer',
          file: filePath,
          line: 1,
          fileLevel: true,
          title: 'Route missing authentication guard',
        },
      ],
    }));

    await runPrecisionAnnotate(tmpProj, { init: true, from: scan1, corpus: 'flvl' });
    const annotFile = path.join(tmpProj, 'aegis-precision', 'flvl.json');
    const data = JSON.parse(fs.readFileSync(annotFile, 'utf-8'));
    data.annotations[0].verdict = 'TP';
    fs.writeFileSync(annotFile, JSON.stringify(data));

    // Insert 5 lines at the top — the exact v0.6 bug scenario.
    // Pre-v0.6.1 the fingerprint depended on the first 2 non-empty lines of
    // the file, so the hash would change and the TP verdict would reset.
    fs.writeFileSync(
      filePath,
      '// Added header comment\n// Another new line\n// And another\n\n\n' +
        fs.readFileSync(filePath, 'utf-8'),
    );

    // Scanner still reports line:1 fileLevel:true — file-level intent unchanged
    const scan2 = path.join(tmpProj, 'scan2.json');
    fs.writeFileSync(scan2, JSON.stringify({
      findings: [
        {
          id: 'AUTH-042', // ID may drift
          scanner: 'auth-enforcer',
          file: filePath,
          line: 1,
          fileLevel: true,
          title: 'Route missing authentication guard',
        },
      ],
    }));

    await runPrecisionAnnotate(tmpProj, { init: true, from: scan2, corpus: 'flvl' });
    const newAnnotations = JSON.parse(fs.readFileSync(annotFile, 'utf-8')).annotations;
    expect(newAnnotations).toHaveLength(1);
    // The whole point of v0.6.1: verdict survives file-head edits
    expect(newAnnotations[0].verdict).toBe('TP');
  });

  it('generates distinct fingerprints for the same file-level finding on different files', async () => {
    // Uniqueness: scanner|file|file-level|title — the file path is part of
    // identity so two files with the same finding still resolve distinctly.
    const fileA = setupFile('src/routeA.ts', 'export {};\n');
    const fileB = setupFile('src/routeB.ts', 'export {};\n');

    const scan = path.join(tmpProj, 'scan.json');
    fs.writeFileSync(scan, JSON.stringify({
      findings: [
        {
          id: 'A',
          scanner: 'auth-enforcer',
          file: fileA,
          line: 1,
          fileLevel: true,
          title: 'Route missing authentication guard',
        },
        {
          id: 'B',
          scanner: 'auth-enforcer',
          file: fileB,
          line: 1,
          fileLevel: true,
          title: 'Route missing authentication guard',
        },
      ],
    }));
    await runPrecisionAnnotate(tmpProj, { init: true, from: scan, corpus: 'uniq' });
    const annots = JSON.parse(
      fs.readFileSync(path.join(tmpProj, 'aegis-precision', 'uniq.json'), 'utf-8'),
    ).annotations;
    expect(annots).toHaveLength(2);
    expect(annots[0].fingerprint).not.toBe(annots[1].fingerprint);
    // And both must encode "file-level" so they're stable on their own terms
    expect(annots[0].fingerprint).toContain('file-level');
    expect(annots[1].fingerprint).toContain('file-level');
  });

  it('leaves per-line finding behavior unchanged when fileLevel is not set', async () => {
    // Regression guard — the Bug 2 fix is a short-circuit ADDED before the
    // context-hash path. Per-line findings (no fileLevel) must still use
    // the context-hash path and still be stable across unrelated line-drift.
    // We reuse the existing drift scenario but assert the fingerprint does
    // NOT contain "file-level" for a per-line finding.
    const filePath = setupFile('src/x.ts', [
      "import { exec } from 'child_process';",
      "exec(req.body.cmd);", // line 2, per-line taint finding
    ].join('\n'));

    const scan = path.join(tmpProj, 'scan.json');
    fs.writeFileSync(scan, JSON.stringify({
      findings: [
        {
          id: 'T',
          scanner: 'taint-analyzer',
          file: filePath,
          line: 2,
          title: 'CmdInj',
          // no fileLevel — per-line finding
        },
      ],
    }));

    await runPrecisionAnnotate(tmpProj, { init: true, from: scan, corpus: 'perline' });
    const annots = JSON.parse(
      fs.readFileSync(path.join(tmpProj, 'aegis-precision', 'perline.json'), 'utf-8'),
    ).annotations;
    expect(annots[0].fingerprint).toBeDefined();
    // Per-line fingerprint does NOT use the file-level marker
    expect(annots[0].fingerprint).not.toContain('file-level');
  });
});

describe('runPrecisionReport', () => {
  function writeAnnotations(corpus: string, annotations: Annotation[]): void {
    const dir = path.join(tmpProj, 'aegis-precision');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${corpus}.json`),
      JSON.stringify({
        corpus,
        scanRunAt: '2026-04-16T12:00:00Z',
        aegisVersion: '0.5.0',
        annotations,
      }),
    );
  }

  it('reports PASS when precision meets the gate', async () => {
    // taint-analyzer gate is 0.70 — 7/3 = 70%
    writeAnnotations('test', [
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `F${i}`, scanner: 'taint-analyzer', title: `T${i}`,
        verdict: 'TP' as const,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `F${i + 7}`, scanner: 'taint-analyzer', title: `T${i + 7}`,
        verdict: 'FP' as const,
      })),
    ]);
    const exit = await runPrecisionReport(tmpProj, { corpus: ['test'] });
    expect(exit).toBe(0);
    expect(stdoutText()).toContain('taint-analyzer');
    expect(stdoutText()).toContain('70%');
    expect(stdoutText()).toMatch(/taint-analyzer.+PASS/);
  });

  it('reports FAIL when precision is below gate but above quarantine', async () => {
    // taint-analyzer gate 70%, quarantine 60%. 6 TP / 4 FP = 60% → between
    writeAnnotations('test', [
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `F${i}`, scanner: 'taint-analyzer', title: `T${i}`,
        verdict: 'TP' as const,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `F${i + 6}`, scanner: 'taint-analyzer', title: `T${i + 6}`,
        verdict: 'FP' as const,
      })),
    ]);
    await runPrecisionReport(tmpProj, { corpus: ['test'] });
    expect(stdoutText()).toMatch(/taint-analyzer.+FAIL/);
  });

  it('reports QUARANTINE when precision below 60%', async () => {
    // 4 TP / 6 FP = 40%
    writeAnnotations('test', [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `F${i}`, scanner: 'taint-analyzer', title: `T${i}`,
        verdict: 'TP' as const,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `F${i + 4}`, scanner: 'taint-analyzer', title: `T${i + 4}`,
        verdict: 'FP' as const,
      })),
    ]);
    await runPrecisionReport(tmpProj, { corpus: ['test'] });
    expect(stdoutText()).toMatch(/taint-analyzer.+QUARANTINE/);
  });

  it('reports UNCLASSIFIED for external scanners (no tier in mapping)', async () => {
    writeAnnotations('test', [
      { id: 'F1', scanner: 'semgrep', title: 'T', verdict: 'TP' },
      { id: 'F2', scanner: 'semgrep', title: 'T', verdict: 'FP' },
    ]);
    await runPrecisionReport(tmpProj, { corpus: ['test'] });
    expect(stdoutText()).toMatch(/semgrep.+UNCLASSIFIED/);
  });

  it('reports NO DATA when all verdicts are skip', async () => {
    writeAnnotations('test', [
      { id: 'F1', scanner: 'taint-analyzer', title: 'T1', verdict: 'skip' },
      { id: 'F2', scanner: 'taint-analyzer', title: 'T2', verdict: 'skip' },
    ]);
    await runPrecisionReport(tmpProj, { corpus: ['test'] });
    expect(stdoutText()).toMatch(/taint-analyzer.+NO DATA/);
  });

  it('discovers corpora from aegis-precision/ when --corpus omitted', async () => {
    writeAnnotations('alpha', [{ id: 'F1', scanner: 'taint-analyzer', title: 'T', verdict: 'TP' }]);
    writeAnnotations('beta', [{ id: 'F2', scanner: 'taint-analyzer', title: 'T', verdict: 'TP' }]);
    await runPrecisionReport(tmpProj, {});
    expect(stdoutText()).toContain('alpha');
    expect(stdoutText()).toContain('beta');
  });

  it('errors when no annotations exist and no --corpus given', async () => {
    const exit = await runPrecisionReport(tmpProj, {});
    expect(exit).toBe(1);
    expect(stderrText()).toMatch(/no annotation files/i);
  });

  it('aggregates findings across multiple corpora into per-scanner stats', async () => {
    writeAnnotations('a', [
      { id: 'F1', scanner: 'taint-analyzer', title: 'T1', verdict: 'TP' },
      { id: 'F2', scanner: 'taint-analyzer', title: 'T2', verdict: 'TP' },
    ]);
    writeAnnotations('b', [
      { id: 'F3', scanner: 'taint-analyzer', title: 'T3', verdict: 'FP' },
    ]);
    await runPrecisionReport(tmpProj, { corpus: ['a', 'b'] });
    // 2 TP across both corpora, 1 FP → 2/3 = 67% → FAIL (gate 70%)
    expect(stdoutText()).toMatch(/taint-analyzer.+2\/1.+67%.+FAIL/);
  });

  it('prints summary line with PASS/FAIL/QUARANTINE counts', async () => {
    writeAnnotations('test', [
      { id: 'F1', scanner: 'taint-analyzer', title: 'T1', verdict: 'TP' },
      { id: 'F2', scanner: 'taint-analyzer', title: 'T2', verdict: 'TP' },
      { id: 'F3', scanner: 'taint-analyzer', title: 'T3', verdict: 'TP' },
      { id: 'F4', scanner: 'taint-analyzer', title: 'T4', verdict: 'TP' },
      { id: 'F5', scanner: 'taint-analyzer', title: 'T5', verdict: 'TP' },
      { id: 'F6', scanner: 'taint-analyzer', title: 'T6', verdict: 'TP' },
      { id: 'F7', scanner: 'taint-analyzer', title: 'T7', verdict: 'TP' },
      { id: 'F8', scanner: 'auth-enforcer', title: 'T8', verdict: 'FP' },
    ]);
    await runPrecisionReport(tmpProj, { corpus: ['test'] });
    expect(stdoutText()).toMatch(/PASS/);
  });
});
