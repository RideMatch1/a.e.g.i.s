/**
 * AUDIT-AEGIS-SCAN-V0165 §1 C2 + §2 H1 — regression-guard tests for
 * the ci/github-action/action.yml + init-template workflow shape.
 *
 * Codifies the SC-2 + SC-3 fix-shape as test-asserted invariants:
 *   1. action.yml: no `${{ inputs.* }}` or `${{ github.event.* }}` in
 *      any `run:` block (must be in `env:` instead — the C2 fix-pattern).
 *   2. action.yml: `aegis-version` `default` matches strict v<semver>
 *      regex (forbids floating refs that would break SLSA-chain
 *      reproducibility — H1 fix-pattern).
 *   3. init-template: same template-injection regression-guard on the
 *      consumer-facing workflow shipped via `aegis init`.
 *
 * Implementation note: line-based parser (no yaml dep) walks the file
 * and tracks whether each line is inside a `run:` block (preserving the
 * indent of the `run:` key). A line is "inside the run-block" iff its
 * indent is strictly greater than the run-block's indent. We assert no
 * `${{ inputs.X }}` / `${{ github.event.X }}` patterns appear inside
 * any run-block. Also asserts the aegis-version default shape.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const ACTION_YML = resolve(REPO_ROOT, 'ci', 'github-action', 'action.yml');
const INIT_TEMPLATE = resolve(
  REPO_ROOT,
  'templates',
  'nextjs-supabase',
  'files',
  '.github',
  'workflows',
  'aegis.yml',
);

interface RunBlockHit {
  line: number;
  text: string;
  match: string;
}

/**
 * Walk a YAML workflow file and return any `${{ inputs.* }}` or
 * `${{ github.event.* }}` patterns that appear INSIDE a `run:` block
 * (and therefore would be shell-substituted, the C2 vector). Returns
 * empty array if the workflow is clean.
 */
function findInjectionsInRunBlocks(yamlSource: string): RunBlockHit[] {
  const hits: RunBlockHit[] = [];
  const lines = yamlSource.split('\n');
  let inRunBlock = false;
  let runBlockIndent = -1;
  const INJECTION_RE = /\$\{\{\s*(inputs|github\.event)\./;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const indent = rawLine.search(/\S|$/);
    const trimmed = rawLine.trim();

    // Skip pure-comment lines from the analysis — they're not shell-
    // executed even if they contain ${{ inputs.X }} (the C2-fix added
    // explanatory comments referencing the pattern textually).
    if (trimmed.startsWith('#')) continue;

    // Detect start of a `run:` block. YAML `run:` may use `run: |`,
    // `run: >`, or single-line `run: <cmd>`. Only multi-line forms
    // open a block we need to track; single-line `run:` puts the
    // command on the same line and we check it inline below.
    if (/^run:\s*[|>]/.test(trimmed)) {
      inRunBlock = true;
      runBlockIndent = indent;
      continue;
    }

    // Single-line run: scan its inline command for injections directly.
    const singleLineRun = /^run:\s+(.*)$/.exec(trimmed);
    if (singleLineRun && singleLineRun[1] && !singleLineRun[1].startsWith('|')) {
      const m = INJECTION_RE.exec(singleLineRun[1]);
      if (m) hits.push({ line: i + 1, text: rawLine, match: m[0] });
      continue;
    }

    if (inRunBlock) {
      // We're still inside the run-block iff the line's indent is
      // strictly greater than the run-block's indent OR the line is
      // blank (blank lines belong to the literal block).
      if (rawLine.trim() === '') continue;
      if (indent > runBlockIndent) {
        const m = INJECTION_RE.exec(rawLine);
        if (m) hits.push({ line: i + 1, text: rawLine, match: m[0] });
      } else {
        // Indent dropped to or below the run-key indent — block closed.
        inRunBlock = false;
        runBlockIndent = -1;
      }
    }
  }

  return hits;
}

/**
 * Find the value of a top-level `inputs.<key>.default` declaration in
 * an action.yml. Returns undefined if not found. Only handles the
 * shape used by AEGIS's action.yml (a flat 2-level inputs map).
 */
function findInputDefault(yamlSource: string, key: string): string | undefined {
  const lines = yamlSource.split('\n');
  let inTargetInput = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed === `${key}:`) {
      inTargetInput = true;
      continue;
    }
    if (inTargetInput) {
      const m = /^default:\s*['"]?([^'"]*)['"]?\s*$/.exec(trimmed);
      if (m) return m[1];
      // If we hit a sibling input (top-level key at lower-or-equal
      // indent) before finding default, abort to avoid mis-attribution.
      if (
        trimmed.length > 0 &&
        !trimmed.startsWith('#') &&
        /^[a-zA-Z_-]+:/.test(trimmed) &&
        trimmed !== `${key}:`
      ) {
        // Heuristic: any new key terminates the search.
        if (
          ['description:', 'required:', 'default:'].every((k) => !trimmed.startsWith(k))
        ) {
          inTargetInput = false;
        }
      }
    }
  }
  return undefined;
}

describe('CI hardening regression-guards (C2 + H1 closure verification, AUDIT-AEGIS-SCAN-V0165)', () => {
  it('action.yml: no ${{ inputs.* }} / ${{ github.event.* }} in any run: block (C2 regression-guard)', () => {
    const content = readFileSync(ACTION_YML, 'utf-8');
    const hits = findInjectionsInRunBlocks(content);
    if (hits.length > 0) {
      const detail = hits
        .map((h) => `  line ${h.line}: ${h.match} in: ${h.text.trim()}`)
        .join('\n');
      throw new Error(
        `C2 regression: ${hits.length} shell-template-injection(s) found in run-blocks:\n${detail}`,
      );
    }
    expect(hits).toEqual([]);
  });

  it('action.yml: aegis-version default matches strict v<semver> shape (H1 regression-guard)', () => {
    const content = readFileSync(ACTION_YML, 'utf-8');
    const def = findInputDefault(content, 'aegis-version');
    expect(def).toBeDefined();
    expect(def).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('action.yml: aegis-version default is at least v0.16.6 (post-emergency-fix floor)', () => {
    const content = readFileSync(ACTION_YML, 'utf-8');
    const def = findInputDefault(content, 'aegis-version') ?? '';
    const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(def);
    expect(m).not.toBeNull();
    if (!m) return;
    const [, major, minor, patch] = m.map((x) => parseInt(x ?? '0', 10));
    const numeric = (major ?? 0) * 1_000_000 + (minor ?? 0) * 1_000 + (patch ?? 0);
    const v_0_16_6 = 0 * 1_000_000 + 16 * 1_000 + 6;
    expect(numeric).toBeGreaterThanOrEqual(v_0_16_6);
  });

  it('init-template: no ${{ inputs.* }} / ${{ github.event.* }} in any run: block (C2 propagation regression-guard)', () => {
    const content = readFileSync(INIT_TEMPLATE, 'utf-8');
    const hits = findInjectionsInRunBlocks(content);
    if (hits.length > 0) {
      const detail = hits
        .map((h) => `  line ${h.line}: ${h.match} in: ${h.text.trim()}`)
        .join('\n');
      throw new Error(
        `C2 propagation regression: ${hits.length} shell-template-injection(s) found in init-template run-blocks:\n${detail}`,
      );
    }
    expect(hits).toEqual([]);
  });

  it('parser self-check: detects an injected ${{ inputs.X }} in a synthetic run-block', () => {
    // Sanity test: the parser correctly catches a deliberate injection.
    // If this test fails, all the above pass-by-default tests are
    // meaningless.
    const synthetic = `
runs:
  steps:
    - name: Bad step
      shell: bash
      run: |
        echo \${{ inputs.attacker }}
`;
    const hits = findInjectionsInRunBlocks(synthetic);
    expect(hits.length).toBe(1);
    expect(hits[0]?.match).toMatch(/\$\{\{\s*inputs\./);
  });

  it('parser self-check: does NOT flag ${{ inputs.X }} in env: bindings (the C2 fix pattern)', () => {
    const synthetic = `
runs:
  steps:
    - name: Good step
      shell: bash
      env:
        SAFE: \${{ inputs.from-env }}
      run: |
        echo "$SAFE"
`;
    const hits = findInjectionsInRunBlocks(synthetic);
    expect(hits.length).toBe(0);
  });
});
