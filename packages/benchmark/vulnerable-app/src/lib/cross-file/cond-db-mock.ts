/**
 * CLEAN-09 support: mock branch. No sink — returns an empty array
 * regardless of input.
 */
export function query(_sql: string): Promise<unknown[]> {
  return Promise.resolve([]);
}
