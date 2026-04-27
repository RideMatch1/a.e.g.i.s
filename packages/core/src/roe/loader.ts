/**
 * RoE loader — read + validate from disk. Accepts JSON; YAML support deferred.
 *
 * Returns either a validated RoE or a structured ParseError (file-missing,
 * invalid-JSON, schema-violation) so the caller can surface a precise
 * operator-readable message.
 */
import { readFileSync, existsSync } from 'node:fs';
import { RoESchema, type RoE } from './types.js';

export interface RoEParseSuccess {
  ok: true;
  roe: RoE;
}

export interface RoEParseFailure {
  ok: false;
  /** Operator-readable error message safe to print to stderr. */
  error: string;
  /** Phase the error occurred in. */
  phase: 'file-missing' | 'json-parse' | 'schema-validation';
}

export type RoEParseResult = RoEParseSuccess | RoEParseFailure;

export function loadRoE(path: string): RoEParseResult {
  if (!existsSync(path)) {
    return {
      ok: false,
      error: `RoE file not found at ${path}`,
      phase: 'file-missing',
    };
  }

  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    return {
      ok: false,
      error: `RoE file unreadable at ${path}: ${err instanceof Error ? err.message : String(err)}`,
      phase: 'file-missing',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      error: `RoE file at ${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      phase: 'json-parse',
    };
  }

  const result = RoESchema.safeParse(parsed);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
        return `  ${path}: ${issue.message}`;
      })
      .join('\n');
    return {
      ok: false,
      error: `RoE schema validation failed:\n${formatted}`,
      phase: 'schema-validation',
    };
  }

  return { ok: true, roe: result.data };
}
