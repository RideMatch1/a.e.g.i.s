/**
 * CLEAN-07 support: cross-file sanitized wrapper.
 * Exported function wraps its raw param through parseInt() before reaching
 * db.query(). parseInt neutralizes CWE-89 (SQLi) per sanitizers.ts; the
 * identifier `raw` no longer appears inside the sink call's arg text, so
 * paramReachesSink yields [] AND summary.sanitizesCwes covers CWE-89.
 * Expected: NO cross-file finding.
 */
declare const db: { query: (sql: string) => Promise<unknown[]> };

export function safeUserQuery(raw: string): Promise<unknown[]> {
  const id = parseInt(raw, 10);
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
}
