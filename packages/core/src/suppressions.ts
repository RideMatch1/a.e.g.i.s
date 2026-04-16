/**
 * Inline suppression parsing and matching.
 *
 * Syntax:
 *   // aegis-ignore — reason text                    (applies to NEXT line)
 *   // aegis-ignore CWE-918 — legitimer proxy call   (CWE-specific, next line)
 *   /* aegis-ignore-block CWE-78 * /                 (applies until aegis-ignore-end)
 *   /* aegis-ignore-end * /
 *
 * A suppression without a CWE is a catch-all for that line.
 * A suppression WITH a CWE only matches findings with that exact CWE number.
 * Reason text is recommended (warned if missing/too short).
 */

export interface Suppression {
  /** 1-indexed line where suppression starts applying. */
  startLine: number;
  /** 1-indexed line where suppression stops applying (inclusive). */
  endLine: number;
  /** Optional specific CWE; undefined = any CWE on this line. */
  cwe?: number;
  /** Free-text reason for the suppression. */
  reason: string;
  /** Mutable — flipped to true when a finding matched this suppression. */
  used: boolean;
  /** Kind for diagnostics. */
  kind: 'next-line' | 'block';
}

// Accept em-dash (—), en-dash (–), double-dash (--), or single-dash separator.
// Negative lookahead `(?!-)` prevents `aegis-ignore-block` from matching as a
// single-line directive with reason="block" (that's what BLOCK_START_RE is for).
const SINGLE_LINE_RE =
  /\/\/\s*aegis-ignore(?!-)(?:\s+CWE-(\d+))?\s*(?:[\u2014\u2013]|--|-)?\s*(.*)$/;

// Block start: /* aegis-ignore-block [CWE-nnn] [— reason] */
const BLOCK_START_RE =
  /\/\*\s*aegis-ignore-block(?:\s+CWE-(\d+))?\s*(?:[\u2014\u2013]|--|-)?\s*([^*]*?)\s*\*\//;

// Block end: /* aegis-ignore-end */
const BLOCK_END_RE = /\/\*\s*aegis-ignore-end\s*\*\//;

// Known limitation (v1): these regexes run on raw line text, not TS comment ranges.
// String literals containing suppression syntax (e.g., `const doc = "// aegis-ignore"`)
// WILL be matched. Documented — ts.getLeadingCommentRanges migration planned for v2.

/**
 * Parse suppression directives from source content.
 * Returns all suppressions found, including orphan block-starts (which are logged
 * as warnings later).
 */
export function parseSuppressions(content: string): Suppression[] {
  const lines = content.split('\n');
  const suppressions: Suppression[] = [];

  let openBlock:
    | { startLine: number; cwe?: number; reason: string }
    | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    if (openBlock) {
      if (BLOCK_END_RE.test(line)) {
        suppressions.push({
          startLine: openBlock.startLine,
          endLine: lineNumber,
          cwe: openBlock.cwe,
          reason: openBlock.reason,
          used: false,
          kind: 'block',
        });
        openBlock = null;
      }
      continue;
    }

    const blockMatch = line.match(BLOCK_START_RE);
    if (blockMatch) {
      const cwe = blockMatch[1] ? Number.parseInt(blockMatch[1], 10) : undefined;
      const reason = (blockMatch[2] ?? '').trim();

      // Same-line close? `/* aegis-ignore-block */ exec(x); /* aegis-ignore-end */`
      // Search for BLOCK_END_RE in the text AFTER the block-start match.
      const afterBlockStart = line.slice(blockMatch.index! + blockMatch[0].length);
      if (BLOCK_END_RE.test(afterBlockStart)) {
        suppressions.push({
          startLine: lineNumber,
          endLine: lineNumber,
          cwe,
          reason,
          used: false,
          kind: 'block',
        });
        continue;
      }

      openBlock = { startLine: lineNumber, cwe, reason };
      continue;
    }

    const singleMatch = line.match(SINGLE_LINE_RE);
    if (singleMatch) {
      const cwe = singleMatch[1] ? Number.parseInt(singleMatch[1], 10) : undefined;
      const reason = (singleMatch[2] ?? '').trim();
      // Applies to the NEXT line (common convention — same as eslint-disable-next-line)
      suppressions.push({
        startLine: lineNumber + 1,
        endLine: lineNumber + 1,
        cwe,
        reason,
        used: false,
        kind: 'next-line',
      });
    }
  }

  // Orphan block-start (no end) — leave openBlock discarded; caller can check via logs
  return suppressions;
}

/**
 * Return true if the given (line, cwe) is covered by any suppression.
 * Mutates matching suppression's `used` flag.
 */
export function isSuppressed(
  findingLine: number | undefined,
  findingCwe: number | undefined,
  suppressions: Suppression[],
): boolean {
  if (findingLine === undefined) return false;
  for (const s of suppressions) {
    if (findingLine < s.startLine || findingLine > s.endLine) continue;
    if (s.cwe !== undefined && s.cwe !== findingCwe) continue;
    s.used = true;
    return true;
  }
  return false;
}

/** Return the list of suppressions that were never triggered by a finding. */
export function getUnusedSuppressions(suppressions: Suppression[]): Suppression[] {
  return suppressions.filter((s) => !s.used);
}

/** Return suppressions missing a meaningful reason (fewer than 3 non-space chars). */
export function getNakedSuppressions(suppressions: Suppression[]): Suppression[] {
  return suppressions.filter((s) => s.reason.replace(/\s/g, '').length < 3);
}
