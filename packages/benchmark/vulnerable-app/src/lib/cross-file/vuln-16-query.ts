/**
 * VULN-16 support: cross-file SQL injection wrapper.
 * Exported function interpolates its param directly into a db.query() template.
 * Called from ../app/api/vuln-16-cross-file-sqli/route.ts with tainted input.
 */
declare const db: { query: (sql: string) => Promise<unknown[]> };

export function runUserQuery(id: string): Promise<unknown[]> {
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
}
