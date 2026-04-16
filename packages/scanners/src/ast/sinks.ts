import type { Severity } from '@aegis-scan/core';

export interface SinkMeta {
  cwe: number;
  owasp: string;
  severity: Severity;
  category: string;
}

/**
 * Taint sinks — function/property names where tainted data becomes dangerous.
 * Key is the function name (without parens); value is metadata.
 *
 * Explicitly excluded: Supabase .from().select().eq() — parameterized by design.
 * Only .rpc() with template literal interpolation is a sink.
 */
export const TAINT_SINKS: Record<string, SinkMeta> = {
  // SQL Injection (CWE-89)
  'db.query': { cwe: 89, owasp: 'A03:2021', severity: 'critical', category: 'SQL Injection' },
  'client.query': { cwe: 89, owasp: 'A03:2021', severity: 'critical', category: 'SQL Injection' },
  'pool.query': { cwe: 89, owasp: 'A03:2021', severity: 'critical', category: 'SQL Injection' },
  'connection.query': { cwe: 89, owasp: 'A03:2021', severity: 'critical', category: 'SQL Injection' },
  '$queryRaw': { cwe: 89, owasp: 'A03:2021', severity: 'critical', category: 'SQL Injection' },
  '$executeRaw': { cwe: 89, owasp: 'A03:2021', severity: 'critical', category: 'SQL Injection' },

  // SSRF (CWE-918)
  'fetch': { cwe: 918, owasp: 'A10:2021', severity: 'high', category: 'SSRF' },
  'axios': { cwe: 918, owasp: 'A10:2021', severity: 'high', category: 'SSRF' },
  'axios.get': { cwe: 918, owasp: 'A10:2021', severity: 'high', category: 'SSRF' },
  'axios.post': { cwe: 918, owasp: 'A10:2021', severity: 'high', category: 'SSRF' },
  'got': { cwe: 918, owasp: 'A10:2021', severity: 'high', category: 'SSRF' },
  'http.request': { cwe: 918, owasp: 'A10:2021', severity: 'high', category: 'SSRF' },

  // XSS (CWE-79)
  'res.send': { cwe: 79, owasp: 'A03:2021', severity: 'high', category: 'XSS' },
  'res.write': { cwe: 79, owasp: 'A03:2021', severity: 'high', category: 'XSS' },
  'document.write': { cwe: 79, owasp: 'A03:2021', severity: 'high', category: 'XSS' },

  // Path Traversal (CWE-22)
  'fs.readFile': { cwe: 22, owasp: 'A01:2021', severity: 'high', category: 'Path Traversal' },
  'fs.readFileSync': { cwe: 22, owasp: 'A01:2021', severity: 'high', category: 'Path Traversal' },
  'fs.writeFile': { cwe: 22, owasp: 'A01:2021', severity: 'high', category: 'Path Traversal' },
  'fs.createReadStream': { cwe: 22, owasp: 'A01:2021', severity: 'high', category: 'Path Traversal' },

  // Command Injection (CWE-78)
  'exec': { cwe: 78, owasp: 'A03:2021', severity: 'critical', category: 'Command Injection' },
  'execSync': { cwe: 78, owasp: 'A03:2021', severity: 'critical', category: 'Command Injection' },
  'execAsync': { cwe: 78, owasp: 'A03:2021', severity: 'critical', category: 'Command Injection' },
  'spawn': { cwe: 78, owasp: 'A03:2021', severity: 'critical', category: 'Command Injection' },
  'execFile': { cwe: 78, owasp: 'A03:2021', severity: 'critical', category: 'Command Injection' },

  // Code Injection (CWE-94)
  'eval': { cwe: 94, owasp: 'A03:2021', severity: 'critical', category: 'Code Injection' },
  'setTimeout': { cwe: 94, owasp: 'A03:2021', severity: 'high', category: 'Code Injection' },
  'setInterval': { cwe: 94, owasp: 'A03:2021', severity: 'high', category: 'Code Injection' },

  // Open Redirect (CWE-601)
  'res.redirect': { cwe: 601, owasp: 'A01:2021', severity: 'medium', category: 'Open Redirect' },
  'redirect': { cwe: 601, owasp: 'A01:2021', severity: 'medium', category: 'Open Redirect' },

  // Prototype Pollution (CWE-1321) — deep merge/assign with tainted keys
  'Object.assign': { cwe: 1321, owasp: 'A08:2021', severity: 'high', category: 'Prototype Pollution' },
  'merge': { cwe: 1321, owasp: 'A08:2021', severity: 'high', category: 'Prototype Pollution' },
  'deepMerge': { cwe: 1321, owasp: 'A08:2021', severity: 'high', category: 'Prototype Pollution' },
  'defaultsDeep': { cwe: 1321, owasp: 'A08:2021', severity: 'high', category: 'Prototype Pollution' },
  '_.merge': { cwe: 1321, owasp: 'A08:2021', severity: 'high', category: 'Prototype Pollution' },
  '_.defaultsDeep': { cwe: 1321, owasp: 'A08:2021', severity: 'high', category: 'Prototype Pollution' },
  'lodash.merge': { cwe: 1321, owasp: 'A08:2021', severity: 'high', category: 'Prototype Pollution' },
};

/**
 * Constructor sinks — `new Response(tainted)`, `new NextResponse(tainted)`
 * where tainted data flows into the response body.
 */
export const CONSTRUCTOR_SINKS: Record<string, SinkMeta> = {
  'Response': { cwe: 79, owasp: 'A03:2021', severity: 'high', category: 'XSS' },
  'NextResponse': { cwe: 79, owasp: 'A03:2021', severity: 'high', category: 'XSS' },
  'Function': { cwe: 94, owasp: 'A03:2021', severity: 'critical', category: 'Code Injection' },
};

/**
 * Supabase .rpc() — safe when function name is static, SQL injection when
 * the function name argument contains tainted template interpolation.
 * Handled specially in taint-tracker (not a normal sink).
 */
export const RPC_SINK_META: SinkMeta = {
  cwe: 89, owasp: 'A03:2021', severity: 'critical', category: 'SQL Injection via .rpc()',
};

/**
 * Property assignment sinks — `element.innerHTML = tainted`
 * where tainted data flows into a DOM property.
 */
export const PROPERTY_SINKS: Record<string, SinkMeta> = {
  'innerHTML': { cwe: 79, owasp: 'A03:2021', severity: 'critical', category: 'XSS' },
  'outerHTML': { cwe: 79, owasp: 'A03:2021', severity: 'critical', category: 'XSS' },
};

/**
 * JSX attribute sinks — `dangerouslySetInnerHTML={{ __html: tainted }}`
 * React-specific XSS vector.
 */
export const JSX_ATTRIBUTE_SINKS: Record<string, SinkMeta> = {
  'dangerouslySetInnerHTML': { cwe: 79, owasp: 'A03:2021', severity: 'critical', category: 'XSS' },
};

/**
 * Look up sink metadata by function name.
 */
export function getSinkMeta(callName: string): SinkMeta | undefined {
  return TAINT_SINKS[callName];
}

/**
 * Sink identifiers that come from Node.js built-in modules.
 * These names are sinks ONLY when the identifier resolves to an @types/node
 * declaration — a local function with the same name is shadowed and must
 * NOT flag. See resolveSinkSymbol in type-resolve.ts.
 */
export const TYPED_SINK_MODULES: Record<string, readonly string[]> = {
  child_process: [
    'exec', 'execSync', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork',
  ],
  fs: [
    'readFile', 'readFileSync', 'writeFile', 'writeFileSync',
    'createReadStream', 'createWriteStream',
    'unlink', 'unlinkSync', 'rmdir', 'rmdirSync', 'mkdir', 'mkdirSync',
  ],
  'fs/promises': [
    'readFile', 'writeFile', 'unlink', 'rmdir', 'mkdir',
  ],
  path: [
    'join', 'resolve',
  ],
  crypto: [
    'createSign', 'createVerify', 'pbkdf2', 'pbkdf2Sync',
  ],
  http: [
    'request', 'get',
  ],
  https: [
    'request', 'get',
  ],
};

const AMBIENT_SINK_NAMES = new Set(
  Object.values(TYPED_SINK_MODULES).flat(),
);

/**
 * Fast pre-check: is this callee name a candidate for type-aware resolution?
 * Used to gate the (more expensive) checker.getSymbolAtLocation call —
 * only ambient-module sink names benefit from shadow detection.
 */
export function isAmbientSinkCandidate(name: string): boolean {
  return AMBIENT_SINK_NAMES.has(name);
}
