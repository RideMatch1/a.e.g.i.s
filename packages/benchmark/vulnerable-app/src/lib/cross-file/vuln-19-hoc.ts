/**
 * VULN-19 support: HOC that wraps its param and returns a function calling it.
 *
 * Policy §9 (HOC / curry consumption): when the outer function returns a
 * function that invokes one of the outer's params, summary.returnsFunction-
 * ThatCallsSink is set. Phase 2 emits a cross-file finding at any binding
 * site that passes an inline sink-calling fn as the wrapped argument.
 */
export function withAuth<A extends unknown[]>(
  fn: (...args: A) => unknown,
): (...args: A) => unknown {
  return (...args: A) => fn(...args);
}
