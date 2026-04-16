import { describe, it, expect } from 'vitest';
import {
  parseSuppressions,
  isSuppressed,
  getUnusedSuppressions,
  getNakedSuppressions,
} from '../src/suppressions.js';

describe('parseSuppressions — single-line', () => {
  it('parses a basic // aegis-ignore directive applying to next line', () => {
    const content = [
      'const cmd = req.body.cmd;',
      '// aegis-ignore — validated via whitelist',
      'exec(cmd);',
    ].join('\n');

    const sups = parseSuppressions(content);
    expect(sups).toHaveLength(1);
    expect(sups[0].startLine).toBe(3); // "// aegis-ignore" is on line 2, applies to line 3
    expect(sups[0].endLine).toBe(3);
    expect(sups[0].cwe).toBeUndefined();
    expect(sups[0].reason).toBe('validated via whitelist');
    expect(sups[0].kind).toBe('next-line');
  });

  it('parses CWE-specific suppression', () => {
    const content = [
      '// aegis-ignore CWE-918 — legitimer proxy call zu internal service',
      'fetch(url);',
    ].join('\n');

    const sups = parseSuppressions(content);
    expect(sups).toHaveLength(1);
    expect(sups[0].cwe).toBe(918);
    expect(sups[0].reason).toBe('legitimer proxy call zu internal service');
  });

  it('accepts em-dash, en-dash, double-dash, single-dash separators', () => {
    const content = [
      '// aegis-ignore — em-dash reason',
      'line2();',
      '// aegis-ignore – en-dash reason',
      'line4();',
      '// aegis-ignore -- double-dash reason',
      'line6();',
      '// aegis-ignore - single-dash reason',
      'line8();',
    ].join('\n');

    const sups = parseSuppressions(content);
    expect(sups).toHaveLength(4);
    expect(sups[0].reason).toBe('em-dash reason');
    expect(sups[1].reason).toBe('en-dash reason');
    expect(sups[2].reason).toBe('double-dash reason');
    expect(sups[3].reason).toBe('single-dash reason');
  });

  it('records naked (no-reason) suppression', () => {
    const content = ['// aegis-ignore', 'exec(x);'].join('\n');
    const sups = parseSuppressions(content);
    expect(sups).toHaveLength(1);
    expect(sups[0].reason).toBe('');
    expect(getNakedSuppressions(sups)).toHaveLength(1);
  });
});

describe('parseSuppressions — block mode', () => {
  it('parses /* aegis-ignore-block */ ... /* aegis-ignore-end */', () => {
    const content = [
      '/* aegis-ignore-block CWE-78 — internal DSL executor */',
      'exec(a);',
      'exec(b);',
      '/* aegis-ignore-end */',
      'exec(c);', // NOT suppressed
    ].join('\n');

    const sups = parseSuppressions(content);
    expect(sups).toHaveLength(1);
    expect(sups[0].kind).toBe('block');
    expect(sups[0].startLine).toBe(1);
    expect(sups[0].endLine).toBe(4);
    expect(sups[0].cwe).toBe(78);
    expect(sups[0].reason).toBe('internal DSL executor');
  });

  it('orphan block-start without end is dropped (no suppression recorded)', () => {
    const content = [
      '/* aegis-ignore-block — missing end */',
      'exec(a);',
      'exec(b);',
    ].join('\n');

    const sups = parseSuppressions(content);
    expect(sups).toHaveLength(0); // orphan block not materialized
  });

  it('catch-all block (no CWE) covers all findings in range', () => {
    const content = [
      '/* aegis-ignore-block — legacy migration shim */',
      'line2();',
      'line3();',
      '/* aegis-ignore-end */',
    ].join('\n');

    const sups = parseSuppressions(content);
    expect(sups[0].cwe).toBeUndefined();
  });
});

describe('isSuppressed', () => {
  it('catch-all suppression matches any CWE on the target line', () => {
    const sups = parseSuppressions('// aegis-ignore — reason text\nexec(x);');
    expect(isSuppressed(2, 78, sups)).toBe(true);
    expect(isSuppressed(2, 918, sups)).toBe(true);
    expect(isSuppressed(3, 78, sups)).toBe(false); // wrong line
  });

  it('CWE-specific suppression only matches the specified CWE', () => {
    const sups = parseSuppressions('// aegis-ignore CWE-918 — proxy only\nfetch(x);');
    expect(isSuppressed(2, 918, sups)).toBe(true);
    expect(isSuppressed(2, 78, sups)).toBe(false); // wrong CWE
  });

  it('block suppression covers multiple lines', () => {
    const sups = parseSuppressions(
      [
        '/* aegis-ignore-block CWE-78 — reason */',
        'a;',
        'b;',
        'c;',
        '/* aegis-ignore-end */',
      ].join('\n'),
    );
    expect(isSuppressed(2, 78, sups)).toBe(true);
    expect(isSuppressed(3, 78, sups)).toBe(true);
    expect(isSuppressed(4, 78, sups)).toBe(true);
    expect(isSuppressed(2, 918, sups)).toBe(false); // wrong CWE
    expect(isSuppressed(6, 78, sups)).toBe(false); // outside block
  });

  it('returns false when finding has no line', () => {
    const sups = parseSuppressions('// aegis-ignore — reason\nfoo();');
    expect(isSuppressed(undefined, 78, sups)).toBe(false);
  });

  it('flips the `used` flag on matching suppression', () => {
    const sups = parseSuppressions('// aegis-ignore — reason\nexec(x);');
    expect(sups[0].used).toBe(false);
    isSuppressed(2, 78, sups);
    expect(sups[0].used).toBe(true);
  });
});

describe('getUnusedSuppressions', () => {
  it('returns suppressions that no finding matched', () => {
    const sups = parseSuppressions(
      [
        '// aegis-ignore — used',
        'line2();',
        '// aegis-ignore — never used',
        'line4();',
      ].join('\n'),
    );
    isSuppressed(2, 78, sups); // only trigger the first
    const unused = getUnusedSuppressions(sups);
    expect(unused).toHaveLength(1);
    expect(unused[0].startLine).toBe(4);
  });
});

describe('parseSuppressions — parser edge-cases', () => {
  it('does NOT parse // aegis-ignore-block as single-line directive (word boundary)', () => {
    // Regression: without (?!-) lookahead, SINGLE_LINE_RE would match `aegis-ignore-block`
    // as an ignore with reason="block" and silently suppress the next line.
    const content = [
      '// aegis-ignore-block — typo; user meant /* ... */ block syntax',
      'exec(req.body.x);', // must NOT be suppressed
    ].join('\n');

    const sups = parseSuppressions(content);
    expect(sups).toHaveLength(0);
  });

  it('parses same-line block (start + end on one line) as single-line block', () => {
    const content = [
      '/* aegis-ignore-block CWE-78 — inline */ exec(body.cmd); /* aegis-ignore-end */',
      'exec(other);', // outside block — NOT suppressed
    ].join('\n');

    const sups = parseSuppressions(content);
    expect(sups).toHaveLength(1);
    expect(sups[0].kind).toBe('block');
    expect(sups[0].startLine).toBe(1);
    expect(sups[0].endLine).toBe(1); // same line — block closed immediately
    expect(sups[0].cwe).toBe(78);
    expect(isSuppressed(1, 78, sups)).toBe(true);
    expect(isSuppressed(2, 78, sups)).toBe(false); // next line is NOT covered
  });

  it('known limitation (v1): suppression syntax inside string literals IS matched', () => {
    // Documented limitation — regex runs on raw line text, not TS comment ranges.
    // A migration to ts.getLeadingCommentRanges() is planned for v2.
    // This test locks down current behavior so future refactor can change it intentionally.
    const content = [
      'const docs = "// aegis-ignore — example in docs";',
      'exec(x);', // will be mistakenly suppressed
    ].join('\n');

    const sups = parseSuppressions(content);
    expect(sups).toHaveLength(1);
    expect(sups[0].reason).toBe('example in docs";'); // messy but documents behavior
  });
});
