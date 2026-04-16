import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AegisConfig } from '@aegis-scan/core';
import {
  applyCustomRules,
  validateCustomRules,
  AegisConfigError,
} from '../../src/ast/custom-rules.js';
import { TAINT_SOURCES } from '../../src/ast/sources.js';
import {
  TAINT_SINKS,
  CONSTRUCTOR_SINKS,
  PROPERTY_SINKS,
} from '../../src/ast/sinks.js';
import {
  TAINT_SANITIZER_DEFS,
  PARSE_NOT_SANITIZER,
  isSanitizer,
} from '../../src/ast/sanitizers.js';

function baseConfig(overrides: Partial<AegisConfig> = {}): AegisConfig {
  return {
    projectPath: '/tmp/x',
    stack: {} as AegisConfig['stack'],
    mode: 'scan',
    ...overrides,
  };
}

describe('validateCustomRules — conflict detection', () => {
  it('throws when custom sanitizer collides with PARSE_NOT_SANITIZER (no allowOverrides)', () => {
    const cfg = baseConfig({
      customSanitizers: [{ pattern: 'JSON.parse', cwes: ['CWE-89'] }],
    });
    expect(() => validateCustomRules(cfg)).toThrow(AegisConfigError);
    expect(() => validateCustomRules(cfg)).toThrow(/PARSE_NOT_SANITIZER/);
  });

  it('allows PARSE_NOT_SANITIZER override when allowOverrides=true', () => {
    const cfg = baseConfig({
      customSanitizers: [{ pattern: 'JSON.parse', cwes: ['CWE-89'] }],
      allowOverrides: true,
    });
    expect(() => validateCustomRules(cfg)).not.toThrow();
  });

  it('rejects invalid CWE format on custom sink', () => {
    const cfg = baseConfig({
      customSinks: [
        { pattern: 'badSink', cwe: 'CWE-bad' as any },
      ],
    });
    expect(() => validateCustomRules(cfg)).toThrow(/invalid cwe/);
  });

  it('rejects invalid CWE format on custom sanitizer', () => {
    const cfg = baseConfig({
      customSanitizers: [{ pattern: 'mySanitize', cwes: ['CWE-bogus'] }],
    });
    expect(() => validateCustomRules(cfg)).toThrow(/invalid cwe/);
  });

  it('accumulates multiple errors in one message', () => {
    const cfg = baseConfig({
      customSanitizers: [
        { pattern: 'JSON.parse', cwes: ['CWE-89'] },
        { pattern: 'URL.parse', cwes: ['CWE-918'] },
      ],
    });
    try {
      validateCustomRules(cfg);
      throw new Error('expected throw');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('JSON.parse');
      expect(msg).toContain('URL.parse');
    }
  });
});

describe('applyCustomRules — merge + undo lifecycle', () => {
  let restore: (() => void) | null = null;

  afterEach(() => {
    // Defensive restore in case a test forgot
    if (restore) {
      restore();
      restore = null;
    }
  });

  it('adds custom source to TAINT_SOURCES and restores on undo', () => {
    const before = [...TAINT_SOURCES];
    restore = applyCustomRules(
      baseConfig({ customSources: [{ pattern: 'internalCtx.userInput' }] }),
    );
    expect(TAINT_SOURCES).toContain('internalCtx.userInput');
    restore();
    restore = null;
    expect(TAINT_SOURCES).toEqual(before);
  });

  it('does not duplicate source if already present', () => {
    const before = TAINT_SOURCES.length;
    restore = applyCustomRules(
      // req.body is built-in — must not be added twice
      baseConfig({ customSources: [{ pattern: 'req.body' }] }),
    );
    expect(TAINT_SOURCES.length).toBe(before);
    restore();
    restore = null;
  });

  it('adds call-sink to TAINT_SINKS with correct CWE/severity', () => {
    restore = applyCustomRules(
      baseConfig({
        customSinks: [
          {
            pattern: 'internalDbRaw',
            type: 'call',
            cwe: 'CWE-89',
            severity: 'critical',
            category: 'Internal SQLi',
          },
        ],
      }),
    );
    expect(TAINT_SINKS['internalDbRaw']).toBeDefined();
    expect(TAINT_SINKS['internalDbRaw'].cwe).toBe(89);
    expect(TAINT_SINKS['internalDbRaw'].severity).toBe('critical');
    expect(TAINT_SINKS['internalDbRaw'].category).toBe('Internal SQLi');
    restore();
    restore = null;
    expect(TAINT_SINKS['internalDbRaw']).toBeUndefined();
  });

  it('routes constructor-type to CONSTRUCTOR_SINKS', () => {
    restore = applyCustomRules(
      baseConfig({
        customSinks: [
          { pattern: 'InternalBuilder', type: 'constructor', cwe: 'CWE-94' },
        ],
      }),
    );
    expect(CONSTRUCTOR_SINKS['InternalBuilder']).toBeDefined();
    expect(TAINT_SINKS['InternalBuilder']).toBeUndefined(); // NOT in call sinks
    restore();
    restore = null;
  });

  it('routes property-type to PROPERTY_SINKS', () => {
    restore = applyCustomRules(
      baseConfig({
        customSinks: [
          { pattern: 'dangerousProp', type: 'property', cwe: 'CWE-79' },
        ],
      }),
    );
    expect(PROPERTY_SINKS['dangerousProp']).toBeDefined();
    restore();
    restore = null;
  });

  it('default sink type is "call" when omitted', () => {
    restore = applyCustomRules(
      baseConfig({
        customSinks: [{ pattern: 'xyz', cwe: 'CWE-78' }], // no type → call
      }),
    );
    expect(TAINT_SINKS['xyz']).toBeDefined();
    restore();
    restore = null;
  });

  it('adds custom sanitizer to TAINT_SANITIZER_DEFS', () => {
    restore = applyCustomRules(
      baseConfig({
        customSanitizers: [
          { pattern: 'validateAndSanitize', cwes: ['CWE-78', 'CWE-89'] },
        ],
      }),
    );
    const def = TAINT_SANITIZER_DEFS.find((d) => d.name === 'validateAndSanitize');
    expect(def).toBeDefined();
    expect(def?.neutralizes).toEqual([78, 89]);
    expect(isSanitizer('validateAndSanitize')).toBe(true);
    restore();
    restore = null;
    expect(isSanitizer('validateAndSanitize')).toBe(false); // gone after restore
  });

  it('allowOverrides removes pattern from PARSE_NOT_SANITIZER and restores it', () => {
    expect(PARSE_NOT_SANITIZER.has('JSON.parse')).toBe(true); // baseline
    restore = applyCustomRules(
      baseConfig({
        customSanitizers: [{ pattern: 'JSON.parse', cwes: ['CWE-89'] }],
        allowOverrides: true,
      }),
    );
    expect(PARSE_NOT_SANITIZER.has('JSON.parse')).toBe(false);
    expect(isSanitizer('JSON.parse')).toBe(true); // now sanitizes
    restore();
    restore = null;
    expect(PARSE_NOT_SANITIZER.has('JSON.parse')).toBe(true); // restored
    expect(isSanitizer('JSON.parse')).toBe(false);
  });

  it('throws before mutating when allowOverrides is missing', () => {
    const sinkCountBefore = Object.keys(TAINT_SINKS).length;
    expect(() =>
      applyCustomRules(
        baseConfig({
          customSinks: [{ pattern: 'validSink', cwe: 'CWE-89' }], // this is fine
          customSanitizers: [{ pattern: 'JSON.parse', cwes: ['CWE-89'] }], // BAD
        }),
      ),
    ).toThrow(AegisConfigError);
    // Scanner registries untouched
    expect(TAINT_SINKS['validSink']).toBeUndefined();
    expect(Object.keys(TAINT_SINKS).length).toBe(sinkCountBefore);
  });

  it('undo is idempotent (running twice is safe)', () => {
    const before = [...TAINT_SOURCES];
    restore = applyCustomRules(
      baseConfig({ customSources: [{ pattern: 'ctx.input' }] }),
    );
    restore();
    restore(); // called again — must not throw
    restore = null;
    expect(TAINT_SOURCES).toEqual(before);
  });

  it('no-op when config has no custom rules', () => {
    const before = {
      sources: [...TAINT_SOURCES],
      sinks: { ...TAINT_SINKS },
    };
    restore = applyCustomRules(baseConfig());
    expect(TAINT_SOURCES).toEqual(before.sources);
    expect(TAINT_SINKS).toEqual(before.sinks);
    restore();
    restore = null;
  });
});
