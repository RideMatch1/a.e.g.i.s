/**
 * Custom Rules DSL — merges user-defined sources/sinks/sanitizers from
 * `aegis.config.json` into the built-in registries for the duration of one scan.
 *
 * Strategy: mutate module-level registries at scan start, snapshot for restore.
 * This keeps Phase 1b isolated from the TaintContext refactor (Phase 2).
 *
 * Conflict semantics:
 *   - Custom sanitizers that collide with PARSE_NOT_SANITIZER (e.g., `JSON.parse`)
 *     throw `AegisConfigError` unless `allowOverrides: true` is set.
 *     Rationale: PARSE_NOT_SANITIZER protects against past scanner-bypass patterns;
 *     overriding requires explicit opt-in.
 *   - Custom sinks with patterns that already exist in built-in registries
 *     are accepted — the custom entry wins. A warning is emitted.
 *   - Custom sources are purely additive.
 */
import type {
  AegisConfig,
  CustomSource,
  CustomSink,
  CustomSanitizer,
  Severity,
} from '@aegis-scan/core';
import { TAINT_SOURCES } from './sources.js';
import {
  TAINT_SINKS,
  CONSTRUCTOR_SINKS,
  PROPERTY_SINKS,
  type SinkMeta,
} from './sinks.js';
import {
  TAINT_SANITIZER_DEFS,
  PARSE_NOT_SANITIZER,
} from './sanitizers.js';

export class AegisConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AegisConfigError';
  }
}

/**
 * Parse "CWE-78" → 78. Returns NaN if malformed (caller should have validated).
 */
function cweToNum(cweString: string): number {
  const match = cweString.match(/^CWE-(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

/**
 * Detect conflicts before mutating. Throws AegisConfigError when strict mode.
 */
export function validateCustomRules(config: AegisConfig): void {
  const allowOverrides = config.allowOverrides === true;
  const errors: string[] = [];

  for (const sanitizer of config.customSanitizers ?? []) {
    if (PARSE_NOT_SANITIZER.has(sanitizer.pattern) && !allowOverrides) {
      errors.push(
        `Custom sanitizer "${sanitizer.pattern}" conflicts with built-in security default. ` +
          `This pattern is in PARSE_NOT_SANITIZER because it was historically abused to bypass scanners ` +
          `(e.g., URL.parse, JSON.parse do NOT sanitize user input). ` +
          `To override anyway, set "allowOverrides": true in aegis.config.json (not recommended).`,
      );
    }
  }

  for (const sink of config.customSinks ?? []) {
    if (Number.isNaN(cweToNum(sink.cwe))) {
      errors.push(`Custom sink "${sink.pattern}" has invalid cwe "${sink.cwe}" — expected CWE-<digits>.`);
    }
  }

  for (const sanitizer of config.customSanitizers ?? []) {
    for (const cwe of sanitizer.cwes) {
      if (Number.isNaN(cweToNum(cwe))) {
        errors.push(`Custom sanitizer "${sanitizer.pattern}" has invalid cwe "${cwe}" — expected CWE-<digits>.`);
      }
    }
  }

  if (errors.length > 0) {
    throw new AegisConfigError(
      `aegis.config.json validation failed:\n  - ${errors.join('\n  - ')}`,
    );
  }
}

/**
 * CWE → OWASP Top-10 (2021) mapping for built-in vulnerability classes.
 * Custom sinks with a known CWE get the right OWASP category in output.
 * Unknown CWEs default to A03:2021 (Injection) — the broadest category.
 */
const CWE_TO_OWASP: Record<number, string> = {
  22:  'A01:2021', // Path Traversal → Broken Access Control
  78:  'A03:2021', // OS Command Injection → Injection
  79:  'A03:2021', // XSS → Injection
  89:  'A03:2021', // SQL Injection → Injection
  94:  'A03:2021', // Code Injection → Injection
  287: 'A07:2021', // Improper Auth → Identification & Authentication
  352: 'A01:2021', // CSRF → Broken Access Control
  434: 'A04:2021', // Unrestricted Upload → Insecure Design
  502: 'A08:2021', // Deserialization → Software & Data Integrity
  522: 'A07:2021', // Insufficient Credential Protection → Identification & Authentication
  601: 'A01:2021', // Open Redirect → Broken Access Control
  611: 'A05:2021', // XXE → Security Misconfiguration
  693: 'A05:2021', // Protection Mechanism Failure → Security Misconfiguration
  918: 'A10:2021', // SSRF
  1321: 'A08:2021', // Prototype Pollution → Software & Data Integrity
};

/**
 * Build a SinkMeta from a CustomSink spec.
 */
function customSinkToMeta(sink: CustomSink): SinkMeta {
  const cweNum = cweToNum(sink.cwe);
  return {
    cwe: cweNum,
    owasp: CWE_TO_OWASP[cweNum] ?? 'A03:2021',
    severity: (sink.severity ?? 'high') as Severity,
    category: sink.category ?? 'Custom',
  };
}

/**
 * Diagnostic emission for conflicts that don't rise to errors.
 */
function warnOverride(message: string): void {
  process.stderr.write(`[aegis] ${message}\n`);
}

/**
 * Apply custom rules to the module-level registries.
 * Returns an undo function — caller MUST run it in finally to restore built-ins.
 *
 * Throws AegisConfigError if validation fails.
 */
export function applyCustomRules(config: AegisConfig): () => void {
  validateCustomRules(config);

  // Snapshot BEFORE any mutation so undo is exact.
  const snapshot = {
    sources: [...TAINT_SOURCES],
    sinks: { ...TAINT_SINKS },
    ctorSinks: { ...CONSTRUCTOR_SINKS },
    propSinks: { ...PROPERTY_SINKS },
    sanitizerDefs: TAINT_SANITIZER_DEFS.map((d) => ({ ...d, neutralizes: [...d.neutralizes] })),
    parseNotSanitizer: new Set(PARSE_NOT_SANITIZER),
  };

  // Sources — additive push
  for (const src of config.customSources ?? []) {
    if (!TAINT_SOURCES.includes(src.pattern)) {
      TAINT_SOURCES.push(src.pattern);
    }
  }

  // Sinks — route by type
  for (const sink of config.customSinks ?? []) {
    const meta = customSinkToMeta(sink);
    const type = sink.type ?? 'call';
    const target =
      type === 'constructor' ? CONSTRUCTOR_SINKS
      : type === 'property' ? PROPERTY_SINKS
      : TAINT_SINKS;

    if (target[sink.pattern] !== undefined) {
      warnOverride(
        `Custom sink "${sink.pattern}" (${type}) overrides built-in. ` +
          `Previous: CWE-${target[sink.pattern].cwe} ${target[sink.pattern].severity}. ` +
          `New: CWE-${meta.cwe} ${meta.severity}.`,
      );
    }
    target[sink.pattern] = meta;
  }

  // Sanitizers — allow override of PARSE_NOT_SANITIZER if opted in
  const allowOverrides = config.allowOverrides === true;
  for (const sanitizer of config.customSanitizers ?? []) {
    const cweNumbers = sanitizer.cwes.map(cweToNum);

    if (PARSE_NOT_SANITIZER.has(sanitizer.pattern)) {
      if (!allowOverrides) {
        // Should not reach — validateCustomRules would have thrown. Defensive.
        throw new AegisConfigError(
          `Internal: custom sanitizer "${sanitizer.pattern}" conflicts with PARSE_NOT_SANITIZER — validator should have caught this.`,
        );
      }
      PARSE_NOT_SANITIZER.delete(sanitizer.pattern);
      warnOverride(
        `Custom sanitizer "${sanitizer.pattern}" removed from PARSE_NOT_SANITIZER (allowOverrides=true).`,
      );
    }

    const existing = TAINT_SANITIZER_DEFS.findIndex((d) => d.name === sanitizer.pattern);
    if (existing >= 0) {
      TAINT_SANITIZER_DEFS[existing] = { name: sanitizer.pattern, neutralizes: cweNumbers };
    } else {
      TAINT_SANITIZER_DEFS.push({ name: sanitizer.pattern, neutralizes: cweNumbers });
    }
  }

  // Return undo — restore snapshot
  return function restoreCustomRules(): void {
    TAINT_SOURCES.length = 0;
    TAINT_SOURCES.push(...snapshot.sources);

    for (const key of Object.keys(TAINT_SINKS)) delete TAINT_SINKS[key];
    Object.assign(TAINT_SINKS, snapshot.sinks);

    for (const key of Object.keys(CONSTRUCTOR_SINKS)) delete CONSTRUCTOR_SINKS[key];
    Object.assign(CONSTRUCTOR_SINKS, snapshot.ctorSinks);

    for (const key of Object.keys(PROPERTY_SINKS)) delete PROPERTY_SINKS[key];
    Object.assign(PROPERTY_SINKS, snapshot.propSinks);

    TAINT_SANITIZER_DEFS.length = 0;
    TAINT_SANITIZER_DEFS.push(...snapshot.sanitizerDefs);

    PARSE_NOT_SANITIZER.clear();
    for (const p of snapshot.parseNotSanitizer) PARSE_NOT_SANITIZER.add(p);
  };
}
