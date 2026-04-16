import { describe, it, expect, afterEach } from 'vitest';
import {
  trackTaint,
  trackTaintInProgramWithGraph,
  type TaintFinding,
} from '../../src/ast/taint-tracker.js';
import { ModuleGraph } from '../../src/ast/module-graph.js';
import { SummaryCache } from '../../src/ast/function-summary.js';
import {
  buildProgramFor as _buildProgramFor,
  cleanup as _cleanup,
} from '../__helpers__/multi-file-fixtures.js';

// Phase 2 multi-file tests use the shared fixture helper with a per-file
// namespace to avoid parallel-worker collisions with module-graph.test.ts
// and function-summary.test.ts.
const NS = 'taint-tracker-cross-file';
const buildProgramFor = (files: Record<string, string>) => _buildProgramFor(files, NS);
const cleanup = () => _cleanup(NS);

function analyze(code: string): TaintFinding[] {
  return trackTaint('test.ts', code);
}

/**
 * Run cross-file taint analysis on the given multi-file fixture. Returns
 * findings aggregated across every source file in the Program. The first
 * returned file is the "driver" (typically api/…), remaining files are the
 * library modules under test.
 */
function analyzeCrossFile(files: Record<string, string>): TaintFinding[] {
  const { program, paths } = buildProgramFor(files);
  if (program === null) {
    throw new Error('buildProgram returned null for a small fixture — unexpected');
  }
  const moduleGraph = new ModuleGraph(program);
  const summaries = new SummaryCache();
  const all: TaintFinding[] = [];
  for (const p of paths) {
    const sf = program.getSourceFile(p);
    if (sf === undefined) continue;
    all.push(...trackTaintInProgramWithGraph(sf, program, moduleGraph, summaries));
  }
  return all;
}

describe('taint-tracker — source detection', () => {
  it('detects req.body as taint source', () => {
    const findings = analyze(`
      const id = req.body.id;
      exec(id);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].sinkName).toContain('exec');
  });

  it('detects destructured req.body', () => {
    const findings = analyze(`
      const { url } = req.body;
      fetch(url);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(918);
  });

  it('detects searchParams.get', () => {
    const findings = analyze(`
      const name = searchParams.get('name');
      res.send(name);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(79);
  });

  it('detects request.json()', () => {
    const findings = analyze(`
      const body = request.json();
      exec(body.cmd);
    `);
    expect(findings.length).toBe(1);
  });
});

describe('taint-tracker — propagation', () => {
  it('tracks taint through variable assignment', () => {
    const findings = analyze(`
      const id = req.body.id;
      const userId = id;
      exec(userId);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through template literals', () => {
    const findings = analyze(`
      const id = req.body.id;
      const query = \`SELECT * FROM users WHERE id = \${id}\`;
      client.query(query);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(89);
  });

  it('tracks taint through string concatenation', () => {
    const findings = analyze(`
      const id = req.body.id;
      const query = "SELECT * FROM users WHERE id = " + id;
      client.query(query);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through reassignment', () => {
    const findings = analyze(`
      let x = req.body.id;
      x = x.trim();
      exec(x);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through NonNullExpression (expr!)', () => {
    const findings = analyze(`
      const data = req.body;
      exec(data!);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through variable with NonNullExpression', () => {
    const findings = analyze(`
      const filePath = request.nextUrl.searchParams.get('file');
      fs.readFileSync(filePath!);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(22);
  });

  it('tracks taint through TypeAssertion (expr as Type)', () => {
    const findings = analyze(`
      const data = req.body;
      exec(data as string);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(78);
  });

  it('tracks taint through variable assigned via TypeAssertion', () => {
    const findings = analyze(`
      const raw = req.body as any;
      const cmd = raw.command;
      exec(cmd);
    `);
    expect(findings.length).toBe(1);
  });
});

describe('taint-tracker — block scoping', () => {
  it('does NOT leak taint from if-block to outer scope', () => {
    const findings = analyze(`
      function handler() {
        if (true) {
          const data = req.body;
        }
        const data = 'safe';
        exec(data);
      }
    `);
    expect(findings.length).toBe(0);
  });
});

describe('taint-tracker — promise chain taint', () => {
  it('tracks taint through .then() callback parameter', () => {
    const findings = analyze(`
      const promise = fetch(req.body.url);
      promise.then((response) => {
        exec(response);
      });
    `);
    // promise is tainted (fetch with tainted arg), .then() callback param inherits taint
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('tracks taint through .then() on tainted variable', () => {
    const findings = analyze(`
      const tainted = req.body;
      tainted.then((data) => {
        exec(data);
      });
    `);
    expect(findings.length).toBe(1);
  });
});

describe('taint-tracker — sanitizers', () => {
  it('removes taint after parseInt', () => {
    const findings = analyze(`
      const id = parseInt(req.body.id);
      client.query(\`SELECT * FROM users WHERE id = \${id}\`);
    `);
    expect(findings.length).toBe(0);
  });

  it('removes taint after Number()', () => {
    const findings = analyze(`
      const id = Number(req.body.id);
      exec(\`echo \${id}\`);
    `);
    expect(findings.length).toBe(0);
  });

  it('removes taint after encodeURIComponent', () => {
    const findings = analyze(`
      const name = encodeURIComponent(req.query.name);
      res.send(name);
    `);
    expect(findings.length).toBe(0);
  });

  it('removes taint after Zod .safeParse()', () => {
    const findings = analyze(`
      const data = schema.safeParse(req.body);
      client.query(\`SELECT * FROM users WHERE id = \${data.id}\`);
    `);
    expect(findings.length).toBe(0);
  });

  it('removes taint after Zod schema.parse()', () => {
    const findings = analyze(`
      const data = schema.parse(req.body);
      client.query(\`SELECT * FROM users WHERE id = \${data.id}\`);
    `);
    expect(findings.length).toBe(0);
  });

  it('does NOT remove taint after URL.parse()', () => {
    const findings = analyze(`
      const parsed = URL.parse(req.body.url);
      fetch(parsed);
    `);
    expect(findings.length).toBe(1);
  });

  it('does NOT remove taint after qs.parse()', () => {
    const findings = analyze(`
      const params = qs.parse(req.query);
      exec(params.cmd);
    `);
    expect(findings.length).toBe(1);
  });

  it('does NOT remove taint after JSON.parse', () => {
    const findings = analyze(`
      const data = JSON.parse(req.body);
      exec(data.cmd);
    `);
    expect(findings.length).toBe(1);
  });
});

describe('taint-tracker — per-CWE sanitization', () => {
  it('parseInt blocks SQLi but NOT XSS', () => {
    const sqli = analyze(`
      const id = parseInt(req.body.id);
      client.query(\`SELECT * FROM users WHERE id = \${id}\`);
    `);
    expect(sqli.length).toBe(0); // parseInt neutralizes CWE-89

    const xss = analyze(`
      const name = parseInt(req.body.name);
      res.send(name);
    `);
    expect(xss.length).toBe(1); // parseInt does NOT neutralize CWE-79
  });

  it('DOMPurify blocks XSS but NOT SQLi', () => {
    const xss = analyze(`
      const name = DOMPurify.sanitize(req.body.name);
      res.send(name);
    `);
    expect(xss.length).toBe(0); // DOMPurify neutralizes CWE-79

    const sqli = analyze(`
      const name = DOMPurify.sanitize(req.body.name);
      client.query(\`SELECT * FROM users WHERE name = '\${name}'\`);
    `);
    expect(sqli.length).toBe(1); // DOMPurify does NOT neutralize CWE-89
  });

  it('Zod .parse() blocks all vulnerability classes', () => {
    const cmd = analyze(`
      const data = schema.safeParse(req.body);
      exec(data.cmd);
    `);
    expect(cmd.length).toBe(0);

    const sqli = analyze(`
      const data = schema.safeParse(req.body);
      client.query(\`SELECT * FROM users WHERE id = \${data.id}\`);
    `);
    expect(sqli.length).toBe(0);
  });

  it('encodeURIComponent blocks SSRF but NOT SQLi', () => {
    const ssrf = analyze(`
      const url = encodeURIComponent(req.body.url);
      fetch(url);
    `);
    expect(ssrf.length).toBe(0); // encodeURIComponent neutralizes CWE-918

    const sqli = analyze(`
      const name = encodeURIComponent(req.body.name);
      client.query(\`SELECT * FROM users WHERE name = '\${name}'\`);
    `);
    expect(sqli.length).toBe(1); // encodeURIComponent does NOT neutralize CWE-89
  });
});

describe('taint-tracker — no false positives', () => {
  it('does NOT flag constant strings', () => {
    const findings = analyze(`
      const url = 'https://api.example.com';
      fetch(url);
    `);
    expect(findings.length).toBe(0);
  });

  it('does NOT flag number literals', () => {
    const findings = analyze(`
      const id = 42;
      client.query(\`SELECT * FROM users WHERE id = \${id}\`);
    `);
    expect(findings.length).toBe(0);
  });

  it('does NOT flag Supabase .from().eq()', () => {
    const findings = analyze(`
      const id = req.body.id;
      supabase.from('users').select('*').eq('id', id);
    `);
    expect(findings.length).toBe(0);
  });

  it('does NOT leak taint between sibling function scopes', () => {
    const findings = analyze(`
      function handler1() {
        const data = req.body;
        exec(data);
      }
      function handler2() {
        const data = 'safe-constant';
        exec(data);
      }
    `);
    expect(findings.length).toBe(1);
  });

  it('does NOT leak taint from outer scope when inner scope shadows with safe value', () => {
    const findings = analyze(`
      const data = req.body;
      function handler() {
        const data = 'safe';
        exec(data);
      }
    `);
    // Inner 'data' shadows outer tainted 'data' — should NOT flag
    expect(findings.length).toBe(0);
  });

  it('clears taint on re-assignment to safe value', () => {
    const findings = analyze(`
      let x = req.body.cmd;
      x = 'safe-value';
      exec(x);
    `);
    expect(findings.length).toBe(0);
  });

  it('does NOT flag process.env', () => {
    const findings = analyze(`
      const url = process.env.API_URL;
      fetch(url);
    `);
    expect(findings.length).toBe(0);
  });
});

describe('taint-tracker — same-file functions', () => {
  it('tracks taint through function return values', () => {
    const findings = analyze(`
      function getId(req: any) { return req.body.id; }
      const id = getId(req);
      exec(id);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through function returning a tainted local variable', () => {
    const findings = analyze(`
      function getInput() {
        const x = req.body.id;
        return x;
      }
      const id = getInput();
      exec(id);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through function with destructuring then return', () => {
    const findings = analyze(`
      function getCmd() {
        const { cmd } = req.body;
        return cmd;
      }
      const c = getCmd();
      exec(c);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through function with multi-hop then return', () => {
    const findings = analyze(`
      function getInput() {
        const a = req.body.id;
        const b = a;
        return b;
      }
      const id = getInput();
      exec(id);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through function returning property of tainted local', () => {
    const findings = analyze(`
      function getId() {
        const x = req.body;
        return x.id;
      }
      const id = getId();
      exec(id);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through function with array destructuring then return', () => {
    const findings = analyze(`
      function getFirst() {
        const [first] = req.body;
        return first;
      }
      const val = getFirst();
      exec(val);
    `);
    expect(findings.length).toBe(1);
  });
});

describe('taint-tracker — logical operator right-side taint', () => {
  it('detects taint on right side of ?? (nullish coalesce)', () => {
    const findings = analyze(`
      const id = null ?? req.body.id;
      exec(id);
    `);
    expect(findings.length).toBe(1);
  });

  it('detects taint on right side of || (logical OR)', () => {
    const findings = analyze(`
      const cmd = undefined || req.body.cmd;
      exec(cmd);
    `);
    expect(findings.length).toBe(1);
  });
});

describe('taint-tracker — arrow function return taint', () => {
  it('tracks taint through arrow function with expression body', () => {
    const findings = analyze(`
      const getBody = () => req.body;
      const data = getBody();
      exec(data.cmd);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(78);
  });

  it('tracks taint through arrow function with block body', () => {
    const findings = analyze(`
      const getInput = () => { return req.body.cmd; };
      const cmd = getInput();
      exec(cmd);
    `);
    expect(findings.length).toBe(1);
  });

  it('tracks taint through function expression', () => {
    const findings = analyze(`
      const getQuery = function() { return req.query.q; };
      const q = getQuery();
      exec(q);
    `);
    expect(findings.length).toBe(1);
  });
});

describe('taint-tracker — finding metadata', () => {
  it('includes source and sink line numbers', () => {
    const findings = analyze(`const id = req.body.id;
exec(id);`);
    expect(findings.length).toBe(1);
    expect(findings[0].sourceLine).toBe(1);
    expect(findings[0].sinkLine).toBe(2);
  });

  it('includes CWE and OWASP', () => {
    const findings = analyze(`
      const id = req.body.id;
      exec(id);
    `);
    expect(findings[0].cwe).toBe(78);
    expect(findings[0].owasp).toBe('A03:2021');
    expect(findings[0].severity).toBe('critical');
  });

  it('includes taint path', () => {
    const findings = analyze(`
      const id = req.body.id;
      const uid = id;
      exec(uid);
    `);
    expect(findings[0].sourceExpr).toContain('req.body');
    expect(findings[0].sinkName).toContain('exec');
    expect(findings[0].taintPath.length).toBeGreaterThan(1);
  });
});

describe('taint-tracker — array destructuring', () => {
  it('tracks taint through array destructuring', () => {
    const findings = analyze(`
      const [id, name] = req.body;
      exec(id);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(78);
  });

  it('tracks taint through array destructuring with skip', () => {
    const findings = analyze(`
      const [, cmd] = req.body;
      exec(cmd);
    `);
    expect(findings.length).toBe(1);
  });
});

describe('taint-tracker — code injection sinks', () => {
  it('detects eval with tainted input', () => {
    const findings = analyze(`
      const code = req.body.expression;
      eval(code);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(94);
    expect(findings[0].category).toContain('Code Injection');
  });

  it('detects new Function() with tainted input', () => {
    const findings = analyze(`
      const code = req.body.code;
      const fn = new Function(code);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(94);
    expect(findings[0].sinkName).toBe('new Function');
  });

  it('detects setTimeout with tainted string', () => {
    const findings = analyze(`
      const code = req.body.code;
      setTimeout(code, 1000);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(94);
  });
});

describe('taint-tracker — innerHTML / dangerouslySetInnerHTML', () => {
  it('detects tainted innerHTML assignment', () => {
    const findings = analyze(`
      const html = req.body.content;
      element.innerHTML = html;
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(79);
    expect(findings[0].sinkName).toBe('innerHTML');
  });

  it('detects tainted dangerouslySetInnerHTML in JSX', () => {
    const findings = trackTaint('test.tsx', `
      const content = req.body.html;
      const el = <div dangerouslySetInnerHTML={{ __html: content }} />;
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(79);
    expect(findings[0].sinkName).toBe('dangerouslySetInnerHTML');
  });

  it('does NOT flag sanitized dangerouslySetInnerHTML', () => {
    const findings = trackTaint('test.tsx', `
      const content = DOMPurify.sanitize(req.body.html);
      const el = <div dangerouslySetInnerHTML={{ __html: content }} />;
    `);
    expect(findings.length).toBe(0);
  });

  it('does NOT flag static innerHTML', () => {
    const findings = analyze(`
      element.innerHTML = '<p>Hello</p>';
    `);
    expect(findings.length).toBe(0);
  });
});

describe('taint-tracker — open redirect', () => {
  it('detects tainted redirect', () => {
    const findings = analyze(`
      const url = req.body.returnUrl;
      res.redirect(url);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(601);
  });
});

describe('taint-tracker — bracket notation access', () => {
  it('tracks taint through bracket access on tainted object', () => {
    const findings = analyze(`
      const body = req.body;
      const value = body['key'];
      exec(value);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(78);
  });

  it('tracks taint through dynamic key access', () => {
    const findings = analyze(`
      const key = req.body.key;
      const value = config[key];
      exec(value);
    `);
    expect(findings.length).toBe(1);
  });
});

describe('taint-tracker — prototype pollution', () => {
  it('detects Object.assign with tainted source', () => {
    const findings = analyze(`
      const body = req.body;
      Object.assign(target, body);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(1321);
    expect(findings[0].category).toContain('Prototype Pollution');
  });

  it('detects _.merge with tainted source', () => {
    const findings = analyze(`
      const data = req.body;
      _.merge(config, data);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(1321);
  });

  it('does NOT flag Object.assign with sanitized input', () => {
    const findings = analyze(`
      const data = schema.safeParse(req.body);
      Object.assign(target, data);
    `);
    expect(findings.length).toBe(0);
  });
});

describe('taint-tracker — .rpc() template interpolation', () => {
  it('detects tainted template literal in .rpc() function name', () => {
    const findings = analyze(`
      const { tableName } = req.body;
      supabase.rpc(\`search_\${tableName}\`, { filter_value: 'test' });
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(89);
    expect(findings[0].category).toContain('SQL Injection');
    expect(findings[0].sinkName).toBe('.rpc()');
  });

  it('detects tainted variable as .rpc() function name', () => {
    const findings = analyze(`
      const fnName = req.body.functionName;
      supabase.rpc(fnName, { id: 1 });
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(89);
  });

  it('does NOT flag .rpc() with static string', () => {
    const findings = analyze(`
      const id = req.body.id;
      supabase.rpc('search_users', { filter_value: id });
    `);
    expect(findings.length).toBe(0);
  });

  it('does NOT flag .rpc() with sanitized function name', () => {
    const findings = analyze(`
      const tableName = parseInt(req.body.tableName);
      supabase.rpc(\`search_\${tableName}\`, {});
    `);
    expect(findings.length).toBe(0);
  });

  it('detects tainted concat in .rpc() function name', () => {
    const findings = analyze(`
      const table = req.query.table;
      supabase.rpc('search_' + table, {});
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(89);
  });
});

describe('taint-tracker — critical spec test cases', () => {
  it('CASE 1: variable indirection SQL injection', () => {
    const findings = analyze(`
      const id = req.body.id;
      client.query(\`SELECT * FROM users WHERE id = \${id}\`);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(89);
    expect(findings[0].severity).toBe('critical');
  });

  it('CASE 3: destructuring SSRF', () => {
    const findings = analyze(`
      const { url } = req.body;
      fetch(url);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(918);
  });

  it('CASE 7: template literal chain XSS', () => {
    const findings = analyze(`
      const name = req.query.name;
      const html = \`<h1>\${name}</h1>\`;
      res.send(html);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(79);
  });

  it('CASE 9: path traversal via variable', () => {
    const findings = analyze(`
      const filePath = req.query.file;
      fs.readFileSync(filePath);
    `);
    expect(findings.length).toBe(1);
    expect(findings[0].cwe).toBe(22);
  });
});

// ── v0.7 Phase 2: cross-file taint propagation ─────────────────────────────
// These tests exercise the `trackTaintInProgramWithGraph` entry point that
// consumes function-summary lookups + ModuleGraph to detect taint flows
// that cross file boundaries. See docs/plans/v07-foundation.md §4 Phase 2.

describe('taint-tracker — cross-file taint (v0.7 Phase 2)', () => {
  afterEach(cleanup);

  it('flags sink reached via imported function', () => {
    const findings = analyzeCrossFile({
      'lib/cmd.ts':
        "import { exec } from 'child_process';\n" +
        'export function runCmd(cmd: string) { exec(cmd); }\n',
      'api/run.ts':
        "import { runCmd } from '../lib/cmd';\n" +
        'export function handler(req: { body: { command: string } }) {\n' +
        '  runCmd(req.body.command);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBeGreaterThan(0);
    expect(crossFile[0].cwe).toBe(78); // CWE-78 CmdInj
    expect(crossFile[0].crossFileOrigin).toMatch(/lib\/cmd\.ts$/);
    expect(crossFile[0].taintPath.some((p) => p.includes('cross-file'))).toBe(true);
  });

  it('propagates through re-export (barrel file)', () => {
    const findings = analyzeCrossFile({
      'lib/cmd.ts':
        "import { exec } from 'child_process';\n" +
        'export function runCmd(cmd: string) { exec(cmd); }\n',
      'lib/index.ts': "export { runCmd } from './cmd';\n",
      'api/run.ts':
        "import { runCmd } from '../lib';\n" +
        'export function handler(req: { body: { command: string } }) {\n' +
        '  runCmd(req.body.command);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBeGreaterThan(0);
    expect(crossFile[0].cwe).toBe(78);
  });

  it('detects SSRF via cross-file fetch wrapper', () => {
    const findings = analyzeCrossFile({
      'lib/http.ts':
        'export async function ship(url: string) { await fetch(url); }\n',
      'api/forward.ts':
        "import { ship } from '../lib/http';\n" +
        'export async function forward(req: { body: { target: string } }) {\n' +
        '  await ship(req.body.target);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true && f.cwe === 918);
    expect(crossFile.length).toBeGreaterThan(0);
  });

  it('detects cross-file SQL injection via db.query wrapper', () => {
    const findings = analyzeCrossFile({
      'lib/db.ts':
        'declare const db: { query: (sql: string) => Promise<unknown> };\n' +
        'export function run(sql: string) { return db.query(sql); }\n',
      'api/search.ts':
        "import { run } from '../lib/db';\n" +
        'export async function search(req: { body: { sql: string } }) {\n' +
        '  await run(req.body.sql);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true && f.cwe === 89);
    expect(crossFile.length).toBeGreaterThan(0);
  });

  it('does NOT flag when caller sanitizes before cross-file call', () => {
    // parseInt neutralizes SQLi/CmdInj before the tainted value reaches
    // the cross-file sink. The sanitizer registry handles this.
    const findings = analyzeCrossFile({
      'lib/cmd.ts':
        "import { exec } from 'child_process';\n" +
        'export function runCmd(cmd: string) { exec(cmd); }\n',
      'api/run.ts':
        "import { runCmd } from '../lib/cmd';\n" +
        'export function handler(req: { body: { command: string } }) {\n' +
        '  const safe = parseInt(req.body.command, 10);\n' +
        '  runCmd(String(safe));\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBe(0);
  });

  it('does NOT flag when the cross-file function is itself a sanitizer (Zod-style schema.parse)', () => {
    const findings = analyzeCrossFile({
      'lib/validate.ts':
        'declare const schema: { parse: (x: unknown) => string };\n' +
        'export function validate(x: unknown) { return schema.parse(x); }\n',
      'api/run.ts':
        "import { validate } from '../lib/validate';\n" +
        "import { exec } from 'child_process';\n" +
        'export function handler(req: { body: { command: string } }) {\n' +
        '  const safe = validate(req.body.command) as string;\n' +
        '  exec(safe);\n' +
        '}\n',
    });
    // validate() is a full-spectrum sanitizer in the summary — taint should be
    // considered sanitized after it. exec() in the local file still fires
    // on the taint going INTO validate, but the output of validate is clean.
    // We expect NO CROSS-FILE finding from validate itself (it has no sink).
    const crossFileOnValidate = findings.filter(
      (f) => f.crossFile === true && f.sinkName === 'validate',
    );
    expect(crossFileOnValidate.length).toBe(0);
  });

  it('does NOT propagate taint via global-state mutation (policy §6 regression guard)', () => {
    // Validator-surfaced regression: if a future impl adds global-state
    // tracking, this test catches it. A tainted value assigned to a
    // globalThis property in file A, then read + sunk in file B, MUST NOT
    // produce a cross-file finding from Phase 2 taint propagation. A
    // separate `global-state-mutation` scanner (out of Phase 2 scope) may
    // still warn about the mutation itself.
    const findings = analyzeCrossFile({
      'lib/state.ts':
        'export function store(req: { body: { cmd: string } }) {\n' +
        '  (globalThis as any).__cmd = req.body.cmd;\n' +
        '}\n',
      'api/run.ts':
        "import { store } from '../lib/state';\n" +
        "import { exec } from 'child_process';\n" +
        'export function handler(req: { body: { cmd: string } }) {\n' +
        '  store(req);\n' +
        '  exec((globalThis as any).__cmd);\n' +
        '}\n',
    });
    // We allow SAME-FILE findings (the exec on globalThis is its own concern)
    // but the cross-file finding specifically linking store() to exec MUST
    // NOT appear.
    const crossFile = findings.filter(
      (f) => f.crossFile === true && f.sinkName === 'store',
    );
    expect(crossFile.length).toBe(0);
  });

  it('handles default-exported cross-file functions', () => {
    const findings = analyzeCrossFile({
      'lib/cmd.ts':
        "import { exec } from 'child_process';\n" +
        'export default function (cmd: string) { exec(cmd); }\n',
      'api/run.ts':
        "import runCmd from '../lib/cmd';\n" +
        'export function handler(req: { body: { command: string } }) {\n' +
        '  runCmd(req.body.command);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBeGreaterThan(0);
  });

  it('handles arrow-function-variable exports (const fn = () => …)', () => {
    const findings = analyzeCrossFile({
      'lib/cmd.ts':
        "import { exec } from 'child_process';\n" +
        'export const runCmd = (cmd: string) => { exec(cmd); };\n',
      'api/run.ts':
        "import { runCmd } from '../lib/cmd';\n" +
        'export function handler(req: { body: { command: string } }) {\n' +
        '  runCmd(req.body.command);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBeGreaterThan(0);
  });

  it('does NOT flag when the cross-file callee is NOT an imported sink', () => {
    // Calling a local function with tainted input when the local function
    // itself calls no sinks. No finding expected — neither cross-file nor
    // same-file. Regression guard on false-positive noise.
    const findings = analyzeCrossFile({
      'lib/id.ts':
        'export function returnArg<T>(x: T): T { return x; }\n',
      'api/run.ts':
        "import { returnArg } from '../lib/id';\n" +
        'export function handler(req: { body: { name: string } }) {\n' +
        '  returnArg(req.body.name);\n' +
        '}\n',
    });
    expect(findings.length).toBe(0);
  });

  it('does NOT emit cross-file duplicate when callee name is also a local sink', () => {
    // If the local name `exec` is both the ambient child_process sink AND
    // matches an imported exec from somewhere else, the cross-file check
    // must NOT double-emit on top of the existing single-file finding.
    // checkCrossFileCallSink skips callees that are known local sinks.
    const findings = analyzeCrossFile({
      'lib/cmd.ts':
        'export function exec(cmd: string) { console.log(cmd); }\n',
      'api/run.ts':
        // NB: this imports exec FROM lib, not from child_process. Locally
        // the name "exec" is both a child_process sink AND an imported
        // function. Cross-file check short-circuits because `getSinkMeta`
        // returns non-null for `exec`.
        "import { exec } from '../lib/cmd';\n" +
        'export function handler(req: { body: { cmd: string } }) {\n' +
        '  exec(req.body.cmd);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBe(0);
  });

  it('does NOT propagate via type-only imports (policy §8)', () => {
    // `import type { fn }` brings no runtime value. The module-graph
    // marks such imports `isTypeOnly: true`, and `resolveSymbolOrigin`
    // skips them. A tainted arg passed through a locally-declared value
    // shouldn't generate a cross-file finding.
    const findings = analyzeCrossFile({
      'lib/types.ts': 'export type Handler = (x: string) => void;\n',
      'api/run.ts':
        "import type { Handler } from '../lib/types';\n" +
        "import { exec } from 'child_process';\n" +
        'declare const handler: Handler;\n' +
        'export function run(req: { body: { cmd: string } }) {\n' +
        '  handler(req.body.cmd);\n' +
        '  exec(req.body.cmd);\n' +
        '}\n',
    });
    // No cross-file finding — handler is type-only.
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBe(0);
    // Same-file exec IS flagged (regression guard — single-file still works).
    const sameFile = findings.filter((f) => f.crossFile !== true && f.sinkName === 'exec');
    expect(sameFile.length).toBeGreaterThan(0);
  });

  it('does NOT break when cross-file function has no body (interface / abstract method)', () => {
    // declare function has no body; buildSummary returns a valid but
    // empty-rule summary. No finding expected.
    const findings = analyzeCrossFile({
      'lib/decl.ts': 'export declare function doStuff(x: string): void;\n',
      'api/run.ts':
        "import { doStuff } from '../lib/decl';\n" +
        'export function handler(req: { body: { x: string } }) {\n' +
        '  doStuff(req.body.x);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBe(0);
  });

  it('preserves existing single-file behavior (regression guard)', () => {
    // When we exercise the cross-file path, single-file findings MUST
    // still be produced for local sinks. This is Phase 2's non-regression
    // contract: no existing finding drops.
    const findings = analyzeCrossFile({
      'api/local.ts':
        "import { exec } from 'child_process';\n" +
        'export function handler(req: { body: { cmd: string } }) {\n' +
        '  const cmd = req.body.cmd;\n' +
        '  exec(cmd);\n' +
        '}\n',
    });
    // Single-file exec finding (no crossFile flag) must appear.
    const sameFile = findings.filter((f) => f.crossFile !== true);
    expect(sameFile.length).toBeGreaterThan(0);
    expect(sameFile[0].sinkName).toContain('exec');
    expect(sameFile[0].cwe).toBe(78);
  });

  it('crossFileOrigin is set on every cross-file finding', () => {
    const findings = analyzeCrossFile({
      'lib/cmd.ts':
        "import { exec } from 'child_process';\n" +
        'export function runCmd(cmd: string) { exec(cmd); }\n',
      'api/run.ts':
        "import { runCmd } from '../lib/cmd';\n" +
        'export function handler(req: { body: { command: string } }) {\n' +
        '  runCmd(req.body.command);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBeGreaterThan(0);
    for (const f of crossFile) {
      expect(f.crossFileOrigin).toBeDefined();
      expect(f.crossFileOrigin).toMatch(/lib\/cmd\.ts$/);
    }
  });

  it('fallback to single-file analysis when module-graph is null (PROGRAM_MODE_MAX_FILES)', () => {
    // Simulated via passing moduleGraph=null directly. Same-file findings
    // must still fire; no cross-file findings possible (by definition).
    const { program, paths } = buildProgramFor({
      'api/local.ts':
        "import { exec } from 'child_process';\n" +
        'export function handler(req: { body: { cmd: string } }) {\n' +
        '  exec(req.body.cmd);\n' +
        '}\n',
    });
    const summaries = new SummaryCache();
    const sf = program!.getSourceFile(paths[0])!;
    const findings = trackTaintInProgramWithGraph(sf, program!, null, summaries);
    // Same-file finding still appears.
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.crossFile !== true)).toBe(true);
  });

  it('detects cross-file taint via `export { name }` declaration syntax (Hunter-surfaced)', () => {
    // Hunter Finding 1: findExportedFunction previously skipped the
    // `export { runUnsafe };` declaration-style export because it only
    // looked for inline `export function foo()` / `export const foo = ...`
    // / `export default …` patterns. Real codebases commonly declare the
    // function first and export it at the bottom of the file — AEGIS
    // silently missed those cross-file flows pre-fix.
    const findings = analyzeCrossFile({
      'lib/wrapper.ts':
        "import { exec } from 'child_process';\n" +
        'function runUnsafe(cmd: string) { exec(cmd); }\n' +
        'export { runUnsafe };\n',
      'api/route.ts':
        "import { runUnsafe } from '../lib/wrapper';\n" +
        'export function handler(req: { body: { cmd: string } }) {\n' +
        '  runUnsafe(req.body.cmd);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBeGreaterThan(0);
    expect(crossFile[0].cwe).toBe(78); // CWE-78 CmdInj
    expect(crossFile[0].crossFileOrigin).toMatch(/lib\/wrapper\.ts$/);
  });

  it('detects cross-file taint via aliased `export { foo as bar }` declaration (Hunter-surfaced)', () => {
    // Same gap class as the unaliased case, plus the alias-resolution step:
    // findExportedFunction resolves `bar` back through the ExportSpecifier's
    // propertyName to `foo`, then finds the local FunctionDeclaration.
    const findings = analyzeCrossFile({
      'lib/wrapper.ts':
        "import { exec } from 'child_process';\n" +
        'function internal(cmd: string) { exec(cmd); }\n' +
        'export { internal as runCmd };\n',
      'api/route.ts':
        "import { runCmd } from '../lib/wrapper';\n" +
        'export function handler(req: { body: { cmd: string } }) {\n' +
        '  runCmd(req.body.cmd);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBeGreaterThan(0);
    expect(crossFile[0].cwe).toBe(78);
  });

  it('resolves cross-file when callee name shadows a local-sink name (Hunter-surfaced)', () => {
    // Hunter Finding 2: the cross-file check previously bailed out on
    // any callee whose bare name matched a TAINT_SINKS key (fetch, exec,
    // eval, merge, …). Custom wrappers sharing a sink's name are common
    // in Next.js — auth-injecting fetch, logging-wrapped exec, etc.
    // Pre-fix, cross-file analysis was skipped entirely; the finding
    // was either missed or emitted only as a same-file match with the
    // WRONG CWE (the shadowed sink's, not the wrapper's actual sink).
    const findings = analyzeCrossFile({
      'lib/wrapper.ts':
        "import { exec } from 'child_process';\n" +
        // Wrapper's local name shadows TAINT_SINKS['fetch'] (CWE-918),
        // but its body actually calls child_process.exec (CWE-78).
        'export function fetch(url: string) { exec(url); }\n',
      'api/route.ts':
        "import { fetch } from '../lib/wrapper';\n" +
        'export function handler(req: { body: { url: string } }) {\n' +
        '  fetch(req.body.url);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    expect(crossFile.length).toBeGreaterThan(0);
    // The wrapper's actual sink is exec (CWE-78), not the shadowed
    // fetch (CWE-918). Cross-file path must reflect reality.
    expect(crossFile.some((f) => f.cwe === 78)).toBe(true);
    expect(crossFile[0].crossFileOrigin).toMatch(/lib\/wrapper\.ts$/);
  });

  it('emits one finding per CWE when a param reaches multiple sink classes (Hunter-surfaced)', () => {
    // Hunter Finding 3: the per-CWE loop broke after the first emit,
    // so a param flowing to both CWE-89 (db.query) and CWE-78 (exec)
    // inside the same imported function produced only the first
    // finding — severity / owasp attribution for the other class was
    // silently dropped. Rare in production code (a single arg reaching
    // two distinct sink classes) but reachable and incorrect when it
    // happens.
    const findings = analyzeCrossFile({
      'lib/dual.ts':
        "import { exec } from 'child_process';\n" +
        'declare const db: { query: (sql: string) => unknown };\n' +
        'export function dual(x: string) {\n' +
        '  db.query(x);\n' +
        '  exec(x);\n' +
        '}\n',
      'api/route.ts':
        "import { dual } from '../lib/dual';\n" +
        'export function handler(req: { body: { v: string } }) {\n' +
        '  dual(req.body.v);\n' +
        '}\n',
    });
    const crossFile = findings.filter((f) => f.crossFile === true);
    const cwes = new Set(crossFile.map((f) => f.cwe));
    expect(cwes.has(89)).toBe(true); // SQLi via db.query
    expect(cwes.has(78)).toBe(true); // CmdInj via exec
  });

  it('emits cross-file findings with confidence=medium; single-file findings retain default', () => {
    // Phase 5 calibration lever: n=2 pre-tag dogfood was below the plan
    // §3 TBD-3 n≥20 threshold, so the FP-rate zone is unmeasurable.
    // Cross-file findings ship at confidence='medium' as a conservative
    // hedge against measurement uncertainty, NOT as a Yellow-zone
    // reclassification. Single-file findings retain their scanner
    // default (undefined / implicit 'high').
    const findings = analyzeCrossFile({
      'lib/cmd.ts':
        "import { exec } from 'child_process';\n" +
        'export function runCmd(cmd: string) { exec(cmd); }\n',
      'api/run.ts':
        "import { runCmd } from '../lib/cmd';\n" +
        "import { exec } from 'child_process';\n" +
        'export function handler(req: { body: { cmd: string; local: string } }) {\n' +
        '  runCmd(req.body.cmd);\n' +       // cross-file — confidence=medium
        '  exec(req.body.local);\n' +        // same-file  — confidence undefined
        '}\n',
    });
    const crossFileFindings = findings.filter((f) => f.crossFile === true);
    const sameFileFindings = findings.filter((f) => f.crossFile !== true);

    expect(crossFileFindings.length).toBeGreaterThan(0);
    for (const f of crossFileFindings) {
      expect(f.confidence).toBe('medium');
    }

    expect(sameFileFindings.length).toBeGreaterThan(0);
    for (const f of sameFileFindings) {
      // Same-file taint analysis has no calibration concern in v0.7 —
      // established precision holds from v0.6.1 baseline.
      expect(f.confidence).toBeUndefined();
    }
  });
});
