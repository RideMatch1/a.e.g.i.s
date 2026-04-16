/**
 * CLEAN-08 support: identity function, no sink in body.
 * Re-exported via ./index.ts barrel to exercise module-graph re-export
 * traversal (max depth 5 per policy §3).
 */
export function identity<T>(x: T): T {
  return x;
}
