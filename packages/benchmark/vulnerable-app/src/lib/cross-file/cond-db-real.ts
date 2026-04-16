/**
 * CLEAN-09 support: one branch of a dynamic-import pair. The exported
 * `query` is a conventional sink wrapper — Phase 5 must NOT flag it at
 * high confidence when the import is behind a conditional expression,
 * because the scanner can't prove that branch is taken at runtime.
 */
declare const db: { query: (sql: string) => Promise<unknown[]> };

export function query(sql: string): Promise<unknown[]> {
  return db.query(sql);
}
