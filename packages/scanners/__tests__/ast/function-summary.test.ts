/**
 * Tests for packages/scanners/src/ast/function-summary.ts.
 *
 * Scope boundary (v0.7 Phase 1): these tests cover the SUMMARY MACHINERY —
 * the cache, cycle detection, depth guard, and the per-function summary
 * shape. Cross-module taint-propagation tests (closure-capture across
 * imports, re-export chains, conditional-import unions) live in the
 * Phase 2 taint-tracker tests since they require the summary-CONSUMER
 * logic to meaningfully exercise. Phase 1 ships the foundation that
 * Phase 2 plugs into.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import ts from 'typescript';
import {
  buildSummary,
  SummaryCache,
  hashFile,
  conservativeSummary,
  isSummarizable,
  MAX_SUMMARY_RECURSION_DEPTH,
  type FunctionSummary,
  type SummarizableFn,
} from '../../src/ast/function-summary.js';
import {
  writeFixtures as _writeFixtures,
  buildProgramFor as _buildProgramFor,
  cleanup as _cleanup,
} from '../__helpers__/multi-file-fixtures.js';

// Namespace per test file prevents parallel-worker fixture collisions.
const NS = 'function-summary';
const writeFixtures = (files: Record<string, string>): string[] =>
  _writeFixtures(files, NS);
const buildProgramFor = (files: Record<string, string>) => _buildProgramFor(files, NS);
const cleanup = (): void => _cleanup(NS);

afterEach(cleanup);

/**
 * Find the first summarizable function by a string match against its
 * source text. Used in every test to pluck the subject function out of
 * a fixture file deterministically.
 */
function findFn(sf: ts.SourceFile, idToken: string): SummarizableFn {
  let match: SummarizableFn | undefined;
  const visit = (node: ts.Node): void => {
    if (match !== undefined) return;
    if (isSummarizable(node) && node.getText(sf).includes(idToken)) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (match === undefined) {
    throw new Error(`findFn: no function matching '${idToken}' in ${sf.fileName}`);
  }
  return match;
}

describe('function-summary — SummaryCache machinery', () => {
  it('get / set round-trips a summary by (fileHash, fnName)', () => {
    const cache = new SummaryCache();
    const summary: FunctionSummary = {
      paramCount: 1,
      params: [{ paramIndex: 0, returnsTainted: true, sinkCwes: [] }],
      sanitizesCwes: [],
      returnsFunctionThatCallsSink: false,
      originFile: '/tmp/x.ts',
      originHash: 'abc',
    };
    cache.set('abc', 'foo', summary);
    expect(cache.get('abc', 'foo')).toEqual(summary);
    expect(cache.get('abc', 'bar')).toBeUndefined();
    expect(cache.get('xyz', 'foo')).toBeUndefined();
    expect(cache.size).toBe(1);
  });

  it('in-progress marker is separate from absent', () => {
    const cache = new SummaryCache();
    expect(cache.isInProgress('h', 'f')).toBe(false);
    cache.markInProgress('h', 'f');
    expect(cache.isInProgress('h', 'f')).toBe(true);
    // get() should NOT expose in-progress as a concrete summary.
    expect(cache.get('h', 'f')).toBeUndefined();
  });

  it('enterFrame / exitFrame track depth and bail at MAX', () => {
    const cache = new SummaryCache();
    for (let i = 0; i < MAX_SUMMARY_RECURSION_DEPTH; i++) {
      expect(cache.enterFrame()).toBe(true);
    }
    expect(cache.recursionDepth).toBe(MAX_SUMMARY_RECURSION_DEPTH);
    // One more push returns false without incrementing.
    expect(cache.enterFrame()).toBe(false);
    expect(cache.recursionDepth).toBe(MAX_SUMMARY_RECURSION_DEPTH);
    cache.exitFrame();
    expect(cache.recursionDepth).toBe(MAX_SUMMARY_RECURSION_DEPTH - 1);
  });

  it('clear() resets store AND depth', () => {
    const cache = new SummaryCache();
    cache.markInProgress('h', 'f');
    cache.enterFrame();
    expect(cache.size).toBe(1);
    expect(cache.recursionDepth).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.recursionDepth).toBe(0);
  });
});

describe('function-summary — hashFile', () => {
  it('returns a stable short hex hash for identical content', () => {
    const [file] = writeFixtures({ 'hash-a.ts': 'export const x = 1;' });
    const h1 = hashFile(file);
    const h2 = hashFile(file);
    expect(h1).not.toBeNull();
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
  });

  it('returns null for an unreadable file', () => {
    expect(hashFile('/nonexistent/path/does/not/exist.ts')).toBeNull();
  });

  it('changes when content changes (after normalization)', () => {
    const [file] = writeFixtures({ 'h.ts': 'export const x = 1;' });
    const h1 = hashFile(file);
    fs.writeFileSync(file, 'export const y = 2;');
    const h2 = hashFile(file);
    expect(h1).not.toBe(h2);
  });

  it('is whitespace-insensitive for pure whitespace-run changes', () => {
    // hashFile normalizes runs of whitespace to single spaces and trims.
    // Two sources that differ ONLY in how much whitespace sits between
    // identical token boundaries must hash identically. Changes that
    // introduce NEW whitespace at token edges (e.g., `1;` → `1 ;`) are
    // treated as a real difference — that's a weak but honest guarantee.
    const [file] = writeFixtures({ 'h.ts': 'export const x = 1;' });
    const h1 = hashFile(file);
    // Same tokens, bigger gaps where whitespace was already present.
    fs.writeFileSync(file, 'export   const  x  =  1;\n\n\n');
    const h2 = hashFile(file);
    expect(h1).toBe(h2);
  });
});

describe('function-summary — buildSummary produces correct shapes', () => {
  it('identity function → param 0 reaches return (returnsTainted: true)', () => {
    const { program, paths } = buildProgramFor({
      'identity.ts': 'export function identity(x: unknown) { return x; }',
    });
    expect(program).not.toBeNull();
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'identity');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'identity', program, null, cache);
    expect(summary).not.toBeNull();
    expect(summary!.paramCount).toBe(1);
    expect(summary!.params[0].returnsTainted).toBe(true);
    expect(summary!.params[0].sinkCwes).toEqual([]);
    expect(summary!.sanitizesCwes).toEqual([]);
    expect(summary!.conservative).toBeUndefined();
  });

  it('sink-caller (exec) → param 0 has CWE-78 in sinkCwes', () => {
    const { program, paths } = buildProgramFor({
      'cmdi.ts':
        "import { exec } from 'child_process';\n" +
        'export function runCmd(cmd: string) { exec(cmd); }\n',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'runCmd');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'runCmd', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(78);
    expect(summary.params[0].returnsTainted).toBe(false);
  });

  it('sanitizer (parseInt) → sanitizesCwes includes SQLi + CmdInj', () => {
    const { program, paths } = buildProgramFor({
      'sani.ts':
        'export function toInt(x: string) { return parseInt(x, 10); }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'toInt');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'toInt', program, null, cache)!;
    expect(summary.sanitizesCwes).toContain(89); // SQLi
    expect(summary.sanitizesCwes).toContain(78); // CmdInj
    expect(summary.sanitizesCwes).toContain(22); // PathTraversal
  });

  it('sanitizer (DOMPurify) → sanitizesCwes includes XSS (79)', () => {
    const { program, paths } = buildProgramFor({
      'purify.ts':
        'declare const DOMPurify: { sanitize: (s: string) => string };\n' +
        'export function clean(html: string) { return DOMPurify.sanitize(html); }\n',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'clean');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'clean', program, null, cache)!;
    expect(summary.sanitizesCwes).toContain(79);
  });

  it('HOC / curry → returnsFunctionThatCallsSink: true (policy §9)', () => {
    const { program, paths } = buildProgramFor({
      'hoc.ts':
        'export function withLogger(fn: (...a: unknown[]) => unknown) {\n' +
        '  return (...args: unknown[]) => { console.log(args); return fn(...args); };\n' +
        '}\n',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'withLogger');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'withLogger', program, null, cache)!;
    expect(summary.returnsFunctionThatCallsSink).toBe(true);
  });

  it('generic pass-through → returnsTainted: true (policy §2)', () => {
    const { program, paths } = buildProgramFor({
      'gen.ts': 'export function query<T>(q: T): T { return q; }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'query');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'query', program, null, cache)!;
    expect(summary.paramCount).toBe(1);
    expect(summary.params[0].returnsTainted).toBe(true);
  });

  it('default-export function gets summarized (policy §7)', () => {
    const { program, paths } = buildProgramFor({
      'def.ts': 'export default function (req: { body: string }) { return req.body; }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'req.body');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'default', program, null, cache)!;
    expect(summary.paramCount).toBe(1);
    // Function returns req.body which references the parameter `req` — that
    // means param 0 reaches the return.
    expect(summary.params[0].returnsTainted).toBe(true);
  });
});

describe('function-summary — buildSummary null-return paths', () => {
  it('returns null when program is null (PROGRAM_MODE_MAX_FILES preflight)', () => {
    const { program, paths } = buildProgramFor({
      'x.ts': 'export function x(a: number) { return a; }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function x');
    const cache = new SummaryCache();
    // Call with program=null — simulates preflight bail.
    const summary = buildSummary(fn, 'x', null, null, cache);
    expect(summary).toBeNull();
  });

  it('returns null when source file is unreadable', () => {
    // Build a program, then delete the underlying file before summarizing.
    const { program, paths } = buildProgramFor({
      'gone.ts': 'export function g(x: number) { return x; }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function g');
    fs.rmSync(paths[0]);
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'g', program, null, cache);
    expect(summary).toBeNull();
  });
});

describe('function-summary — caching semantics', () => {
  it('cache hit on identical (hash, name) returns the same object', () => {
    const { program, paths } = buildProgramFor({
      'cached.ts': 'export function c(x: string) { return x; }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function c');
    const cache = new SummaryCache();
    const s1 = buildSummary(fn, 'c', program, null, cache)!;
    const s2 = buildSummary(fn, 'c', program, null, cache)!;
    expect(s2).toBe(s1); // identity, not just equality
    expect(cache.size).toBe(1);
  });

  it('cache miss on modified file (different content hash)', () => {
    const { program, paths } = buildProgramFor({
      'mod.ts': 'export function m(x: string) { return x; }',
    });
    const sf1 = program!.getSourceFile(paths[0])!;
    const fn1 = findFn(sf1, 'function m');
    const cache = new SummaryCache();
    const s1 = buildSummary(fn1, 'm', program, null, cache)!;
    expect(s1.originHash).toMatch(/^[0-9a-f]{16}$/);

    // Rewrite the underlying file with different semantic content.
    fs.writeFileSync(paths[0], 'export function m(x: string) { exec(x); return ""; }');
    // Re-parse and re-summarize: build a fresh program so the SourceFile
    // reflects the rewritten content (programs are immutable snapshots).
    const { program: program2, paths: paths2 } = buildProgramFor({
      'mod.ts': 'export function m(x: string) { exec(x); return ""; }',
    });
    const sf2 = program2!.getSourceFile(paths2[0])!;
    const fn2 = findFn(sf2, 'function m');
    const s2 = buildSummary(fn2, 'm', program2, null, cache)!;

    expect(s2.originHash).not.toBe(s1.originHash);
    expect(cache.size).toBe(2);
  });
});

describe('function-summary — sink registry coverage (validator-audit fixes)', () => {
  // Pre-v0.7-phase1-fix: function-summary.ts had a hand-curated 5-CWE regex
  // list and silently missed ~15 real sinks that taint-tracker knew about
  // via sinks.ts. These tests pin the unified-registry behavior so any
  // future registry addition (new sink in sinks.ts) automatically flows
  // here without code changes.

  it('flags CWE-94 (eval) as code-injection sink', () => {
    const { program, paths } = buildProgramFor({
      'eval.ts': 'export function run(code: string) { eval(code); }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function run');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'run', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(94);
  });

  it('flags CWE-601 (res.redirect) as open-redirect sink', () => {
    const { program, paths } = buildProgramFor({
      'redir.ts':
        'declare const res: { redirect: (url: string) => void };\n' +
        'export function go(url: string) { res.redirect(url); }\n',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function go');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'go', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(601);
  });

  it('flags CWE-1321 (Object.assign / lodash.merge) as proto-pollution sinks', () => {
    const { program, paths } = buildProgramFor({
      'proto.ts':
        'declare const _: { merge: (dst: object, src: object) => object };\n' +
        'export function combine(src: object) { return _.merge({}, src); }\n',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function combine');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'combine', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(1321);
  });

  it('flags CWE-79 via Response constructor (XSS)', () => {
    const { program, paths } = buildProgramFor({
      'resp.ts':
        'export function ship(body: string) { return new Response(body); }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function ship');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'ship', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(79);
  });

  it('flags CWE-89 via db.query (not just .rpc/.execute/.raw)', () => {
    const { program, paths } = buildProgramFor({
      'query.ts':
        'declare const db: { query: (sql: string) => Promise<unknown> };\n' +
        'export function runQuery(sql: string) { return db.query(sql); }\n',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function runQuery');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'runQuery', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(89);
  });

  it('flags property-assignment sink (elem.innerHTML = tainted)', () => {
    const { program, paths } = buildProgramFor({
      'inner.ts':
        'export function paint(html: string) {\n' +
        '  const el = document.createElement("div");\n' +
        '  el.innerHTML = html;\n' +
        '}\n',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function paint');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'paint', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(79);
  });

  // v0.9.1 regex-guard cross-file: when the fn body guards an SSRF
  // sink with `<regex>.test(param)` (either a positive if-then wrap or
  // a negated-early-exit), CWE_SSRF is dropped from the summary. The
  // cal-com isValidCalURL pattern is the canonical case.
  it('regex-guard cross-file: `if (!regex.test(param)) return; fetch(param)` → sinkCwes excludes 918', () => {
    const { program, paths } = buildProgramFor({
      'safe-fetch.ts':
        'export async function isValidCalURL(url: string) {\n' +
        '  const regex = /^https:\\/\\/api\\.example\\.com\\//;\n' +
        '  if (!regex.test(url)) return null;\n' +
        '  return fetch(url);\n' +
        '}',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'isValidCalURL');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'isValidCalURL', program, null, cache)!;
    expect(summary.params[0].sinkCwes).not.toContain(918);
  });

  it('regex-guard cross-file: positive if-then wrap `if (regex.test(p)) fetch(p)` also drops 918', () => {
    const { program, paths } = buildProgramFor({
      'positive-guard.ts':
        'export async function positivelyGuarded(url: string) {\n' +
        '  const ALLOW = /^https:/;\n' +
        '  if (ALLOW.test(url)) {\n' +
        '    return fetch(url);\n' +
        '  }\n' +
        '  return null;\n' +
        '}',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'positivelyGuarded');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'positivelyGuarded', program, null, cache)!;
    expect(summary.params[0].sinkCwes).not.toContain(918);
  });

  it('regex-guard cross-file: unguarded SSRF sink still reports CWE-918', () => {
    const { program, paths } = buildProgramFor({
      'unguarded.ts':
        'export async function unguarded(url: string) {\n' +
        '  return fetch(url);\n' +
        '}',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'unguarded');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'unguarded', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(918);
  });

  // v0.9.1 URL-position filter: CWE-918 requires the tainted value to
  // reach the URL arg of fetch/axios. A param that only flows into the
  // options-object (headers, body, method) is not an SSRF flow.
  // Canonical case: dub bitly rate-limit where bitlyApiKey flowed into
  // `Authorization: Bearer ${apiKey}` but the fetch URL was a literal.
  it('URL-position filter: tainted param in Authorization header only → drops CWE-918', () => {
    const { program, paths } = buildProgramFor({
      'auth-only.ts':
        'export async function checkRateLimit(apiKey: string) {\n' +
        '  return fetch(\n' +
        '    "https://api.example.com/v4/limits",\n' +
        '    { headers: { Authorization: `Bearer ${apiKey}` } },\n' +
        '  );\n' +
        '}',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'checkRateLimit');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'checkRateLimit', program, null, cache)!;
    expect(summary.params[0].sinkCwes).not.toContain(918);
  });

  it('URL-position filter: tainted param in URL template literal → keeps CWE-918', () => {
    const { program, paths } = buildProgramFor({
      'url-tainted.ts':
        'export async function realSsrf(host: string) {\n' +
        '  return fetch(`https://${host}/api/v1/data`);\n' +
        '}',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'realSsrf');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'realSsrf', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(918);
  });

  it('URL-position filter: tainted param in URL + options → keeps CWE-918 (URL position wins)', () => {
    const { program, paths } = buildProgramFor({
      'both-positions.ts':
        'export async function bothPositions(path: string) {\n' +
        '  return fetch(\n' +
        '    `https://api.example.com/${path}`,\n' +
        '    { headers: { "X-Path": path } },\n' +
        '  );\n' +
        '}',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'bothPositions');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'bothPositions', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(918);
  });

  it('regex-guard cross-file: mixed guarded + unguarded → unguarded defeats, CWE-918 kept', () => {
    const { program, paths } = buildProgramFor({
      'mixed.ts':
        'export async function mixed(url: string) {\n' +
        '  const ALLOW = /^https:/;\n' +
        '  if (ALLOW.test(url)) { await fetch(url); }\n' +
        '  return fetch(url);\n' +     // this one is unguarded
        '}',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'mixed');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'mixed', program, null, cache)!;
    expect(summary.params[0].sinkCwes).toContain(918);
  });

  it('conservativeSummary includes every CWE in the sink registry', () => {
    // Guardrail: if a new sink class is added to sinks.ts but the
    // conservative-summary constant is hardcoded elsewhere, this test
    // catches the divergence.
    const { program, paths } = buildProgramFor({
      'x.ts': 'export function z(a: string) { return a; }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function z');
    const cs = conservativeSummary(fn, sf.fileName, 'h', 'cycle-detected');
    // Expect at least these CWEs: 22, 78, 79, 89, 94, 601, 918, 1321.
    expect(cs.params[0].sinkCwes).toEqual(
      expect.arrayContaining([22, 78, 79, 89, 94, 601, 918, 1321]),
    );
  });
});

describe('function-summary — sanitizer registry (validator-audit fix #2)', () => {
  it('does NOT credit JSON.parse as a sanitizer (PARSE_NOT_SANITIZER)', () => {
    // Pre-fix: every `.parse(x)` match was credited as a full-spectrum
    // sanitizer. Phase 2 would have suppressed real findings that crossed
    // a function wrapping JSON.parse. PARSE_NOT_SANITIZER exists precisely
    // to prevent this regression.
    const { program, paths } = buildProgramFor({
      'jp.ts':
        'export function fromJson(x: string) { return JSON.parse(x); }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function fromJson');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'fromJson', program, null, cache)!;
    expect(summary.sanitizesCwes).toEqual([]);
  });

  it('does NOT credit deserializers in PARSE_NOT_SANITIZER (qs / URL / cookie / path / JSON5)', () => {
    // These five are all in sanitizers.ts:PARSE_NOT_SANITIZER. They are
    // parsers (deserialize a string to a structure) not validators, so
    // taint survives the call.
    // NOTE: Date.parse is NOT yet in PARSE_NOT_SANITIZER; adding it is a
    // separate sanitizers.ts concern — out of Phase-1-function-summary
    // scope. Filed as a noted gap for v0.8 polish.
    //
    // Perf: one ts.Program + one TypeChecker build is amortized across all
    // 5 assertions, well under vitest's 5s default. Per-qualifier programs
    // (pre-5bb1a5c) timed out on Linux CI despite passing on macOS local.
    const qualifiers = ['qs', 'URL', 'cookie', 'path', 'JSON5'];
    const files: Record<string, string> = {};
    for (const q of qualifiers) {
      files[`d-${q}.ts`] =
        `declare const ${q}: { parse: (x: string) => unknown };\n` +
        `export function deser(x: string) { return ${q}.parse(x); }\n`;
    }
    const { program, paths } = buildProgramFor(files);
    for (let i = 0; i < qualifiers.length; i++) {
      const q = qualifiers[i];
      const sf = program!.getSourceFile(paths[i])!;
      const fn = findFn(sf, 'function deser');
      const cache = new SummaryCache();
      const summary = buildSummary(fn, 'deser', program, null, cache)!;
      expect(summary.sanitizesCwes, `${q}.parse should not sanitize`).toEqual([]);
    }
  });

  it('DOES credit a Zod-style schema.parse as full-spectrum sanitizer', () => {
    // The legitimate case — a schema validator's .parse returns a validated
    // shape and neutralizes every CWE class.
    const { program, paths } = buildProgramFor({
      'zod.ts':
        'declare const schema: { parse: (x: unknown) => string };\n' +
        'export function validate(x: unknown) { return schema.parse(x); }\n',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function validate');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'validate', program, null, cache)!;
    // ALL_CWES per sanitizers.ts — covers every tracked class.
    expect(summary.sanitizesCwes.length).toBeGreaterThanOrEqual(5);
  });

  it('DOES credit safeParse as full-spectrum sanitizer', () => {
    const { program, paths } = buildProgramFor({
      'sp.ts':
        'declare const schema: { safeParse: (x: unknown) => unknown };\n' +
        'export function v(x: unknown) { return schema.safeParse(x); }\n',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function v');
    const cache = new SummaryCache();
    const summary = buildSummary(fn, 'v', program, null, cache)!;
    expect(summary.sanitizesCwes.length).toBeGreaterThanOrEqual(5);
  });
});

describe('function-summary — cycle + depth fallback', () => {
  it('re-entry for an in-progress key returns a conservative cycle-detected summary', () => {
    const { program, paths } = buildProgramFor({
      'rec.ts': 'export function r(x: string) { return x; }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function r');
    const cache = new SummaryCache();

    // Simulate an ongoing build by flipping the in-progress flag FIRST.
    const fileHash = hashFile(paths[0])!;
    cache.markInProgress(fileHash, 'r');

    const summary = buildSummary(fn, 'r', program, null, cache);
    expect(summary).not.toBeNull();
    expect(summary!.conservative).toBe('cycle-detected');
    // Fail-open: every param taints the return.
    expect(summary!.params.every((p) => p.returnsTainted)).toBe(true);
    // Every param also reaches every known sink CWE.
    expect(summary!.params[0].sinkCwes.length).toBeGreaterThan(0);
  });

  it('max-depth hit returns conservative max-depth summary', () => {
    const { program, paths } = buildProgramFor({
      'md.ts': 'export function d(x: string) { return x; }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function d');
    const cache = new SummaryCache();

    // Push depth to the limit.
    for (let i = 0; i < MAX_SUMMARY_RECURSION_DEPTH; i++) cache.enterFrame();

    const summary = buildSummary(fn, 'd', program, null, cache);
    expect(summary).not.toBeNull();
    expect(summary!.conservative).toBe('max-depth');
  });

  it('conservativeSummary helper produces a well-formed summary directly', () => {
    const { program, paths } = buildProgramFor({
      'c.ts': 'export function three(a: number, b: number, c: number) { return a + b + c; }',
    });
    const sf = program!.getSourceFile(paths[0])!;
    const fn = findFn(sf, 'function three');
    const cs = conservativeSummary(fn, sf.fileName, 'hashX', 'cycle-detected');
    expect(cs.paramCount).toBe(3);
    expect(cs.params).toHaveLength(3);
    expect(cs.params.every((p) => p.returnsTainted && p.sinkCwes.length > 0)).toBe(true);
    expect(cs.conservative).toBe('cycle-detected');
    expect(cs.sanitizesCwes).toEqual([]);
  });
});
