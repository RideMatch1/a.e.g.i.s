/**
 * Tests for packages/scanners/src/ast/guard-flow.ts.
 *
 * Scope: isolated unit tests driving `isCallGuardedByRegexTest` with
 * synthetic ts.SourceFile inputs. No file I/O, no ts.Program build, no
 * module-graph. Each test parses a tiny function body, locates the sink
 * CallExpression, and asserts the boolean result against the expected
 * dominator behaviour.
 *
 * These tests pin the extracted guard-flow module in place. The same
 * shapes are exercised end-to-end via function-summary.test.ts (builder-
 * side) and taint-tracker.test.ts (consumer-side), but driving the
 * helper directly catches shape-recognition regressions faster when the
 * module is later extended for v0.11 D4/D5/Z3 consumer-side guards.
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { isCallGuardedByRegexTest } from '../../src/ast/guard-flow.js';

/**
 * Parse a single-function source and return its body plus a helper to
 * locate the first CallExpression whose callee text contains `match`.
 * Parent pointers are populated so guard-flow's ancestor walks work.
 */
function parseFn(src: string): {
  body: ts.Block;
  findCall: (match: string) => ts.CallExpression;
} {
  const sf = ts.createSourceFile('t.ts', src, ts.ScriptTarget.Latest, /*setParentNodes*/ true);
  const fnDecl = sf.statements.find(ts.isFunctionDeclaration);
  if (fnDecl === undefined || fnDecl.body === undefined) {
    throw new Error('parseFn: source must contain a function declaration with a body');
  }
  const body = fnDecl.body;
  const findCall = (match: string): ts.CallExpression => {
    let found: ts.CallExpression | null = null;
    const visit = (n: ts.Node): void => {
      if (found !== null) return;
      if (ts.isCallExpression(n) && n.expression.getText(sf).includes(match)) {
        found = n;
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(body);
    if (found === null) throw new Error(`findCall: no call matching '${match}'`);
    return found;
  };
  return { body, findCall };
}

describe('guard-flow — isCallGuardedByRegexTest', () => {
  it('positive wrap — sink in then-branch of if(REGEX.test(param)) → true', () => {
    const { body, findCall } = parseFn(`
      function f(url) {
        const ALLOW = /^https:\\/\\//;
        if (ALLOW.test(url)) {
          fetch(url);
        }
      }
    `);
    expect(isCallGuardedByRegexTest(findCall('fetch'), body, 'url')).toBe(true);
  });

  it('negated early-exit with return — sink after if(!REGEX.test(param)) return → true', () => {
    const { body, findCall } = parseFn(`
      function f(url) {
        const ALLOW = /^https:\\/\\//;
        if (!ALLOW.test(url)) return;
        fetch(url);
      }
    `);
    expect(isCallGuardedByRegexTest(findCall('fetch'), body, 'url')).toBe(true);
  });

  it('negated early-exit with throw — sink after if(!REGEX.test(param)) throw → true', () => {
    const { body, findCall } = parseFn(`
      function f(url) {
        const ALLOW = /^https:\\/\\//;
        if (!ALLOW.test(url)) throw new Error('blocked');
        fetch(url);
      }
    `);
    expect(isCallGuardedByRegexTest(findCall('fetch'), body, 'url')).toBe(true);
  });

  it('no guard at all → false', () => {
    const { body, findCall } = parseFn(`
      function f(url) {
        fetch(url);
      }
    `);
    expect(isCallGuardedByRegexTest(findCall('fetch'), body, 'url')).toBe(false);
  });

  it('guard tests a different identifier → false', () => {
    const { body, findCall } = parseFn(`
      function f(url) {
        const ALLOW = /^https:\\/\\//;
        if (!ALLOW.test(other)) return;
        fetch(url);
      }
    `);
    expect(isCallGuardedByRegexTest(findCall('fetch'), body, 'url')).toBe(false);
  });

  it('positive guard but sink is NOT contained in the then-branch → false', () => {
    const { body, findCall } = parseFn(`
      function f(url) {
        const ALLOW = /^https:\\/\\//;
        if (ALLOW.test(url)) { log('ok'); }
        fetch(url);
      }
    `);
    expect(isCallGuardedByRegexTest(findCall('fetch'), body, 'url')).toBe(false);
  });

  it('negated if-check whose then-branch does NOT terminate → false', () => {
    const { body, findCall } = parseFn(`
      function f(url) {
        const ALLOW = /^https:\\/\\//;
        if (!ALLOW.test(url)) { log('warn'); }
        fetch(url);
      }
    `);
    expect(isCallGuardedByRegexTest(findCall('fetch'), body, 'url')).toBe(false);
  });

  it('guard in sibling branch does NOT apply to sink in the other branch → false', () => {
    const { body, findCall } = parseFn(`
      function f(url) {
        const ALLOW = /^https:\\/\\//;
        if (cond) {
          fetch(url);
        } else {
          if (ALLOW.test(url)) { log('ok'); }
        }
      }
    `);
    expect(isCallGuardedByRegexTest(findCall('fetch'), body, 'url')).toBe(false);
  });
});
