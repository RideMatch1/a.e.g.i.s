import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { resolveSinkSymbol } from '../../src/ast/type-resolve.js';
import { buildProgram } from '../../src/ast/program.js';

// All integration tests write into vulnerable-app/src/__aegis_type_resolve__/
// (has @types/node + tsconfig installed) and clean up afterward.
const VULN_APP = path.resolve(
  import.meta.dirname,
  '../../../benchmark/vulnerable-app',
);
const FIXTURE_DIR = path.join(VULN_APP, 'src', '__aegis_type_resolve__');

function writeFixture(name: string, source: string): string {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const p = path.join(FIXTURE_DIR, name);
  fs.writeFileSync(p, source);
  return p;
}

function findCall(
  sf: ts.SourceFile,
  calleeName: string,
): ts.CallExpression | null {
  let result: ts.CallExpression | null = null;
  function visit(n: ts.Node): void {
    if (result) return;
    if (ts.isCallExpression(n)) {
      const name = ts.isIdentifier(n.expression)
        ? n.expression.text
        : ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.name)
          ? n.expression.name.text
          : null;
      if (name === calleeName) {
        result = n;
        return;
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  return result;
}

describe('resolveSinkSymbol', () => {
  afterEach(() => {
    try {
      fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('imported child_process.exec → { isSink: true }', () => {
    const file = writeFixture('import-exec.ts', [
      "import { exec } from 'child_process';",
      "exec('ls');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'exec')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('locally-shadowed exec → { isSink: false }', () => {
    const file = writeFixture('shadowed-exec.ts', [
      "function exec(cmd: string): string { return cmd; }",
      "exec('ls');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'exec')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: false });
  });

  it('imported execSync → { isSink: true }', () => {
    const file = writeFixture('import-execsync.ts', [
      "import { execSync } from 'child_process';",
      "execSync('ls');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'execSync')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('undefined identifier → null (fail-open to string-match)', () => {
    // `someMysterySink` is not declared anywhere; checker can't resolve it
    const file = writeFixture('undefined-id.ts', [
      "// @ts-ignore — deliberately undefined",
      "someMysterySink('x');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'someMysterySink')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    // Can't resolve → null means "don't override string-match behavior"
    expect(result).toBeNull();
  });

  it('namespace import: cp.exec → { isSink: true }', () => {
    const file = writeFixture('namespace-import.ts', [
      "import * as cp from 'child_process';",
      "cp.exec('ls');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'exec')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('property access on a local object: obj.exec → { isSink: false }', () => {
    // User-defined object with an exec method — shadows ambient sink semantically
    const file = writeFixture('local-object.ts', [
      "const obj = { exec: (cmd: string) => cmd };",
      "obj.exec('ls');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'exec')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    // Declaration is in the local file (ObjectLiteralExpression) → not a sink
    expect(result).toEqual({ isSink: false });
  });

  // ─────────────────────────────────────────────────────────────
  // v0.8 Phase 1: TYPED_SINK_MODULES extension beyond child_process
  // ─────────────────────────────────────────────────────────────

  it('imported fs.readFile → { isSink: true }', () => {
    const file = writeFixture('import-fs-readfile.ts', [
      "import { readFile } from 'fs';",
      "readFile('/etc/passwd', () => {});",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'readFile')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('imported fs.writeFile → { isSink: true }', () => {
    const file = writeFixture('import-fs-writefile.ts', [
      "import { writeFile } from 'fs';",
      "writeFile('/tmp/x', 'data', () => {});",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'writeFile')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('imported fs/promises readFile → { isSink: true }', () => {
    const file = writeFixture('import-fs-promises.ts', [
      "import { readFile } from 'fs/promises';",
      "readFile('/etc/passwd');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'readFile')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('namespace fs.unlink → { isSink: true }', () => {
    const file = writeFixture('namespace-fs-unlink.ts', [
      "import * as fs from 'fs';",
      "fs.unlink('/tmp/x', () => {});",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'unlink')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('imported path.join → { isSink: true }', () => {
    const file = writeFixture('import-path-join.ts', [
      "import { join } from 'path';",
      "join('a', 'b');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'join')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('namespace path.resolve → { isSink: true }', () => {
    const file = writeFixture('namespace-path-resolve.ts', [
      "import * as pathMod from 'path';",
      "pathMod.resolve('x');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'resolve')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('imported crypto.createSign → { isSink: true }', () => {
    const file = writeFixture('import-crypto-createsign.ts', [
      "import { createSign } from 'crypto';",
      "createSign('RSA-SHA256');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'createSign')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('imported http.request → { isSink: true }', () => {
    const file = writeFixture('import-http-request.ts', [
      "import { request } from 'http';",
      "request('http://example.com', () => {});",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'request')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('imported https.request → { isSink: true }', () => {
    const file = writeFixture('import-https-request.ts', [
      "import { request } from 'https';",
      "request('https://example.com', () => {});",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'request')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: true });
  });

  it('locally-shadowed readFile (same name as fs sink) → { isSink: false }', () => {
    // User defines their own readFile — must NOT be flagged
    const file = writeFixture('shadowed-readfile.ts', [
      "function readFile(p: string): string { return p; }",
      "readFile('/etc/passwd');",
    ].join('\n'));
    const program = buildProgram(VULN_APP, [file])!;
    const sf = program.getSourceFile(file)!;
    const call = findCall(sf, 'readFile')!;

    const result = resolveSinkSymbol(call, program.getTypeChecker());
    expect(result).toEqual({ isSink: false });
  });
});
