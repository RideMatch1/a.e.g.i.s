/**
 * Replace every occurrence of `{{KEY}}` in `input` with `values[KEY]`.
 *
 * Conservative by design:
 *   - Keys absent from `values` are left as literal `{{KEY}}` text (no crash,
 *     no silent deletion) so unresolved placeholders surface in the written
 *     file rather than as invisible gaps.
 *   - Replacement values are inserted literally — no recursive re-expansion.
 *     `{ A: '{{B}}', B: 'x' }` on input `{{A}}` returns `{{B}}`, never `x`.
 *
 * Matches the simplest v0.12 template need: two substitutions total
 * (`{{PROJECT_NAME}}`, `{{AEGIS_VERSION}}`). No templating library is added.
 */
export function substitute(input: string, values: Readonly<Record<string, string>>): string {
  return input.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });
}
