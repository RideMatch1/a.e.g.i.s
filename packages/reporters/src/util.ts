import type { FixGuidance } from '@aegis-scan/core';

/**
 * Flattened shape a reporter renders. `description` is always present.
 * `code` and `links` are optional and only set when the underlying
 * FixGuidance carries them.
 */
export interface NormalizedFix {
  description: string;
  code?: string;
  links?: string[];
}

/**
 * Normalize the Finding.fix union (`string | FixGuidance`) introduced in
 * v0.15.2 into a uniform structured shape for reporter rendering.
 * Returns `null` when no fix is set so call-sites can short-circuit.
 *
 * The string-arm (legacy, pre-v0.15.2 scanners) collapses into
 * `{ description: <original-string> }` so render-sites can treat every
 * finding identically and we keep backward-compat through v0.15.x.
 * The string-arm is slated for removal in v0.16.
 */
export function normalizeFix(
  fix: string | FixGuidance | undefined,
): NormalizedFix | null {
  if (fix == null) return null;
  if (typeof fix === 'string') return { description: fix };
  return {
    description: fix.description,
    ...(fix.code !== undefined ? { code: fix.code } : {}),
    ...(fix.links !== undefined ? { links: fix.links } : {}),
  };
}
