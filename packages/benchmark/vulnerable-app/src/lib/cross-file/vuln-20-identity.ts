/**
 * VULN-20 support: generic pass-through (identity) cross-file.
 *
 * Policy §2 (generic pass-through return-taint): when the exported fn's
 * summary has params[i].returnsTainted === true AND the function has no
 * sanitizesCwes, Phase 3 propagates taint from argument to return value
 * across module boundaries. A later in-file sink then emits.
 */
export function identity<T>(x: T): T {
  return x;
}
